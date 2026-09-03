"""api/routes/batch.py — Bulk batch scan API"""
from __future__ import annotations

import logging
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.deps import get_db
from core.config import settings
from db.models.upload import Upload, UploadStatus
from db.models.batch_job import BatchJob, BatchJobStatus
from services.batch_service import batch_service, MAX_BATCH_SIZE
from services.audit_log_service import audit_log_service

import uuid
import aiofiles

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/batch", tags=["batch"])

_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/bmp", "image/tiff"}


# ── Schemas ───────────────────────────────────────────────────────────────────

class BatchItemOut(BaseModel):
    item_id: int
    upload_id: int | None
    analysis_id: int | None
    filename: str
    status: str
    compliance_score: float | None
    pass_count: int | None
    fail_count: int | None
    warn_count: int | None
    error_message: str | None


class BatchJobOut(BaseModel):
    batch_id: int
    batch_name: str | None
    status: str
    total_images: int
    processed_images: int
    failed_images: int
    avg_compliance_score: float | None
    created_at: str | None
    items: list[BatchItemOut]


class BatchCreateResponse(BaseModel):
    batch_id: int
    message: str
    total_images: int


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/upload", response_model=BatchCreateResponse)
async def upload_batch(
    files: list[UploadFile] = File(...),
    batch_name: str | None = Form(default=None),
    db: Session = Depends(get_db),
) -> BatchCreateResponse:
    """
    Upload 1–20 images as a batch scan job.
    Images are saved and linked to a new BatchJob.
    Use POST /api/batch/{batch_id}/process to start scanning.
    """
    if len(files) > MAX_BATCH_SIZE:
        raise HTTPException(
            status_code=422,
            detail=f"Maximum {MAX_BATCH_SIZE} files allowed per batch. Got {len(files)}."
        )
    if len(files) == 0:
        raise HTTPException(status_code=422, detail="No files provided.")

    upload_dir = settings.upload_path
    upload_ids: list[int] = []

    for file in files:
        # Validate type
        if file.content_type not in _ALLOWED_TYPES:
            raise HTTPException(
                status_code=415,
                detail=f"Unsupported file type '{file.content_type}' for '{file.filename}'. "
                       f"Allowed: JPEG, PNG, WebP, BMP, TIFF."
            )

        # Read & check size
        content = await file.read()
        if len(content) > settings.max_upload_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"File '{file.filename}' exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit."
            )

        # Save file
        ext = Path(file.filename or "image").suffix or ".jpg"
        stored_name = f"{uuid.uuid4().hex}{ext}"
        dest = upload_dir / stored_name

        async with aiofiles.open(dest, "wb") as f_out:
            await f_out.write(content)

        upload = Upload(
            original_filename=file.filename or stored_name,
            stored_filename=stored_name,
            file_path=str(dest),
            mime_type=file.content_type,
            status=UploadStatus.PENDING,
        )
        db.add(upload)
        db.flush()
        upload_ids.append(upload.id)

    db.commit()

    # Create batch job
    batch_job = batch_service.create_batch(db, upload_ids, batch_name=batch_name)

    return BatchCreateResponse(
        batch_id=batch_job.id,
        message=f"Batch created with {len(files)} images. Call POST /api/batch/{batch_job.id}/process to start scanning.",
        total_images=len(files),
    )


from fastapi import BackgroundTasks

def _process_batch_background(batch_id: int):
    from db.session import SessionLocal
    db = SessionLocal()
    try:
        batch_service.process_batch(batch_id, db)
    except Exception as exc:
        logger.exception("Batch processing failed in background for batch_id=%d", batch_id)
    finally:
        db.close()

@router.post("/{batch_id}/process", response_model=BatchJobOut)
def process_batch(
    batch_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> BatchJobOut:
    """
    Start processing all images in the batch asynchronously.
    Returns the current pending/processing state immediately.
    """
    batch_job = db.query(BatchJob).filter(BatchJob.id == batch_id).first()
    if not batch_job:
        raise HTTPException(status_code=404, detail=f"Batch id={batch_id} not found.")
    if batch_job.status == BatchJobStatus.PROCESSING:
        raise HTTPException(status_code=409, detail="Batch is already being processed.")

    # Mark as processing immediately so UI knows it started
    batch_job.status = BatchJobStatus.PROCESSING
    db.commit()

    background_tasks.add_task(_process_batch_background, batch_id)
    return _job_to_out(batch_job)


@router.get("/{batch_id}", response_model=BatchJobOut)
def get_batch(batch_id: int, db: Session = Depends(get_db)) -> BatchJobOut:
    """Get current status and results of a batch job."""
    batch_job = db.query(BatchJob).filter(BatchJob.id == batch_id).first()
    if not batch_job:
        raise HTTPException(status_code=404, detail=f"Batch id={batch_id} not found.")
    return _job_to_out(batch_job)


@router.get("", response_model=list[dict])
def list_batches(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
) -> list[dict]:
    """List all batch jobs (newest first)."""
    jobs = (
        db.query(BatchJob)
        .order_by(BatchJob.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [
        {
            "batch_id": j.id,
            "batch_name": j.batch_name,
            "status": j.status.value,
            "total_images": j.total_images,
            "processed_images": j.processed_images,
            "failed_images": j.failed_images,
            "avg_compliance_score": j.avg_compliance_score,
            "created_at": j.created_at.isoformat() if j.created_at else None,
        }
        for j in jobs
    ]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _job_to_out(batch_job: BatchJob) -> BatchJobOut:
    items_out = [
        BatchItemOut(
            item_id=item.id,
            upload_id=item.upload_id,
            analysis_id=item.analysis_id,
            filename=item.original_filename,
            status=item.status,
            compliance_score=item.compliance_score,
            pass_count=item.pass_count,
            fail_count=item.fail_count,
            warn_count=item.warn_count,
            error_message=item.error_message,
        )
        for item in batch_job.items
    ]
    return BatchJobOut(
        batch_id=batch_job.id,
        batch_name=batch_job.batch_name,
        status=batch_job.status.value,
        total_images=batch_job.total_images,
        processed_images=batch_job.processed_images,
        failed_images=batch_job.failed_images,
        avg_compliance_score=batch_job.avg_compliance_score,
        created_at=batch_job.created_at.isoformat() if batch_job.created_at else None,
        items=items_out,
    )
