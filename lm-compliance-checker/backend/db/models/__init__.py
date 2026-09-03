"""db/models/__init__.py — Registers all ORM models for Alembic auto-detection."""
from db.models.upload import Upload, UploadStatus
from db.models.analysis import Analysis
from db.models.compliance import ComplianceFinding
from db.models.penalty import PenaltyRecord
from db.models.batch_job import BatchJob, BatchItem, BatchJobStatus
from db.models.audit_log import AuditLog
from db.models.barcode_result import BarcodeResult

__all__ = [
    "Upload",
    "UploadStatus",
    "Analysis",
    "ComplianceFinding",
    "PenaltyRecord",
    "BatchJob",
    "BatchItem",
    "BatchJobStatus",
    "AuditLog",
    "BarcodeResult",
]
