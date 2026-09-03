"""api/routes/upload.py — POST /api/upload"""
from __future__ import annotations

import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.deps import get_db
from core.config import settings
from db.models.upload import Upload, UploadStatus

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/upload", tags=["upload"])

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/tiff", "image/bmp"}


class UploadResponse(BaseModel):
    upload_id: int
    filename: str
    status: str
    message: str

    model_config = {"from_attributes": True}


@router.post("", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> UploadResponse:
    """
    Accept a packaged commodity label image and save it to disk.
    Returns an upload_id to use with POST /api/analyze/{upload_id}.
    """
    print(">>> INCOMING SCAN REQUEST RECEIVED FOR FILE:", file.filename)
    
    # ── Validate ────────────────────────────────────────────────────────
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type '{file.content_type}'. "
                   f"Allowed: {', '.join(ALLOWED_TYPES)}",
        )

    # Read file and check size
    content = await file.read()
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum size of {settings.MAX_UPLOAD_SIZE_MB} MB.",
        )

    # ── Save to disk ────────────────────────────────────────────────────
    suffix = Path(file.filename or "upload.jpg").suffix.lower() or ".jpg"
    stored_name = f"{uuid.uuid4().hex}{suffix}"
    dest_path = settings.upload_path / stored_name

    dest_path.write_bytes(content)
    logger.info("Saved upload: %s (%d bytes)", stored_name, len(content))

    # ── Persist metadata ────────────────────────────────────────────────
    upload = Upload(
        original_filename=file.filename or "upload",
        stored_filename=stored_name,
        file_path=str(dest_path),
        mime_type=file.content_type,
        status=UploadStatus.PENDING,
    )
    db.add(upload)
    db.commit()
    db.refresh(upload)

    return UploadResponse(
        upload_id=upload.id,
        filename=upload.original_filename,
        status=upload.status.value,
        message="Image uploaded successfully. Use the upload_id to trigger analysis.",
    )
