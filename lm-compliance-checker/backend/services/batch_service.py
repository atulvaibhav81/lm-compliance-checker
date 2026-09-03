"""
services/batch_service.py
Bulk Batch Scan Orchestrator — processes 10–20 images sequentially.

Accepts a list of uploaded file IDs, runs the full compliance pipeline
on each, aggregates results into a BatchJob, and provides export data.
"""
from __future__ import annotations

import logging
import time
from pathlib import Path

from sqlalchemy.orm import Session

from db.models.batch_job import BatchJob, BatchItem, BatchJobStatus
from db.models.upload import Upload, UploadStatus
from services.compliance_service import compliance_service
from services.audit_log_service import audit_log_service

logger = logging.getLogger(__name__)

MAX_BATCH_SIZE = 20
MIN_BATCH_SIZE = 1


class BatchService:
    """
    Orchestrates bulk compliance scans for multiple images.

    Usage:
        batch_job = batch_service.create_batch(db, upload_ids=[1,2,3], name="Batch Jan")
        batch_service.process_batch(batch_job.id, db)
    """

    def create_batch(
        self,
        db: Session,
        upload_ids: list[int],
        batch_name: str | None = None,
    ) -> BatchJob:
        """
        Create a BatchJob and link the given uploads as BatchItems.

        Args:
            db:          Database session.
            upload_ids:  List of Upload.id values (max 20).
            batch_name:  Optional human-friendly name for the batch.

        Returns:
            Created BatchJob ORM object.
        """
        if len(upload_ids) > MAX_BATCH_SIZE:
            raise ValueError(f"Batch size {len(upload_ids)} exceeds maximum {MAX_BATCH_SIZE}.")
        if len(upload_ids) < MIN_BATCH_SIZE:
            raise ValueError("Batch must contain at least 1 image.")

        # Verify all uploads exist
        uploads = db.query(Upload).filter(Upload.id.in_(upload_ids)).all()
        found_ids = {u.id for u in uploads}
        missing = set(upload_ids) - found_ids
        if missing:
            raise ValueError(f"Upload IDs not found: {sorted(missing)}")

        batch_job = BatchJob(
            batch_name=batch_name or f"Batch {time.strftime('%Y-%m-%d %H:%M')}",
            status=BatchJobStatus.PENDING,
            total_images=len(upload_ids),
        )
        db.add(batch_job)
        db.flush()  # get batch_job.id

        upload_map = {u.id: u for u in uploads}
        for uid in upload_ids:
            upload = upload_map[uid]
            item = BatchItem(
                batch_job_id=batch_job.id,
                upload_id=uid,
                original_filename=upload.original_filename,
                status="pending",
            )
            db.add(item)

        db.commit()
        db.refresh(batch_job)
        logger.info("Created BatchJob id=%d with %d images", batch_job.id, len(upload_ids))
        return batch_job

    def process_batch(self, batch_id: int, db: Session) -> BatchJob:
        """
        Process all items in a batch synchronously.
        For production, this would be delegated to a Celery task.

        Args:
            batch_id:  BatchJob.id to process.
            db:        Database session.

        Returns:
            Updated BatchJob with results.
        """
        batch_job = db.query(BatchJob).filter(BatchJob.id == batch_id).first()
        if not batch_job:
            raise ValueError(f"BatchJob id={batch_id} not found.")

        if batch_job.status == BatchJobStatus.PROCESSING:
            raise RuntimeError("Batch is already being processed.")

        batch_job.status = BatchJobStatus.PROCESSING
        db.commit()

        audit_log_service.log_success(
            db, "BATCH_SCAN", "batch_job", batch_id,
            details={"total_images": batch_job.total_images}
        )

        scores = []
        processed = 0
        failed = 0

        for item in batch_job.items:
            try:
                upload = db.query(Upload).filter(Upload.id == item.upload_id).first()
                if not upload:
                    raise ValueError(f"Upload id={item.upload_id} not found")

                item.status = "processing"
                db.commit()

                analysis = compliance_service.run_analysis(upload, db)
                item.analysis_id = analysis.id

                # Compute compliance score for this item
                findings = analysis.findings
                total = len(findings)
                pass_count = sum(1 for f in findings if f.status.value == "PASS")
                fail_count = sum(1 for f in findings if f.status.value == "FAIL")
                warn_count = sum(1 for f in findings if f.status.value == "WARN")
                score = round((pass_count / total) * 100, 1) if total else 0.0

                item.status = "done"
                item.compliance_score = score
                item.pass_count = pass_count
                item.fail_count = fail_count
                item.warn_count = warn_count
                scores.append(score)
                processed += 1

            except Exception as exc:
                logger.exception("BatchItem id=%d failed: %s", item.id, exc)
                item.status = "error"
                item.error_message = str(exc)[:512]
                failed += 1

            db.commit()

        # ── Aggregate batch results ──────────────────────────────────────
        avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0
        batch_job.processed_images = processed
        batch_job.failed_images = failed
        batch_job.avg_compliance_score = avg_score
        batch_job.status = (
            BatchJobStatus.DONE if failed == 0
            else (BatchJobStatus.PARTIAL if processed > 0 else BatchJobStatus.ERROR)
        )

        # Build aggregated summary
        batch_job.summary = self._build_summary(batch_job, db)
        db.commit()
        db.refresh(batch_job)

        logger.info(
            "Batch id=%d complete — processed=%d, failed=%d, avg_score=%.1f",
            batch_id, processed, failed, avg_score
        )
        return batch_job

    def get_batch_results(self, batch_id: int, db: Session) -> dict:
        """
        Return full batch results including per-item breakdown.
        """
        batch_job = db.query(BatchJob).filter(BatchJob.id == batch_id).first()
        if not batch_job:
            raise ValueError(f"BatchJob id={batch_id} not found.")

        items_out = []
        for item in batch_job.items:
            items_out.append({
                "item_id": item.id,
                "upload_id": item.upload_id,
                "analysis_id": item.analysis_id,
                "filename": item.original_filename,
                "status": item.status,
                "compliance_score": item.compliance_score,
                "pass_count": item.pass_count,
                "fail_count": item.fail_count,
                "warn_count": item.warn_count,
                "error_message": item.error_message,
            })

        return {
            "batch_id": batch_job.id,
            "batch_name": batch_job.batch_name,
            "status": batch_job.status.value,
            "total_images": batch_job.total_images,
            "processed_images": batch_job.processed_images,
            "failed_images": batch_job.failed_images,
            "avg_compliance_score": batch_job.avg_compliance_score,
            "created_at": batch_job.created_at.isoformat() if batch_job.created_at else None,
            "items": items_out,
        }

    def to_csv_rows(self, batch_id: int, db: Session) -> list[dict]:
        """Return list of dicts suitable for CSV export."""
        results = self.get_batch_results(batch_id, db)
        rows = []
        for item in results["items"]:
            rows.append({
                "Batch ID": results["batch_id"],
                "Batch Name": results["batch_name"],
                "Filename": item["filename"],
                "Status": item["status"].upper(),
                "Compliance Score (%)": item["compliance_score"] or "",
                "Pass": item["pass_count"] or "",
                "Fail": item["fail_count"] or "",
                "Warn": item["warn_count"] or "",
                "Analysis ID": item["analysis_id"] or "",
                "Error": item["error_message"] or "",
            })
        return rows

    def _build_summary(self, batch_job: BatchJob, db: Session) -> dict:
        """Build a JSON-serialisable summary dict for the batch."""
        all_violations: dict[str, int] = {}
        for item in batch_job.items:
            if item.analysis_id:
                from db.models.analysis import Analysis
                analysis = db.query(Analysis).filter(Analysis.id == item.analysis_id).first()
                if analysis:
                    for f in analysis.findings:
                        if f.status.value == "FAIL":
                            all_violations[f.rule_name] = all_violations.get(f.rule_name, 0) + 1

        top_violations = sorted(all_violations.items(), key=lambda x: -x[1])[:5]
        return {
            "total": batch_job.total_images,
            "processed": batch_job.processed_images,
            "failed": batch_job.failed_images,
            "avg_compliance_score": batch_job.avg_compliance_score,
            "top_violations": [{"name": k, "count": v} for k, v in top_violations],
        }


batch_service = BatchService()
