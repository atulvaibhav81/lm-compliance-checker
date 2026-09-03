"""db/models/batch_job.py — BatchJob and BatchItem ORM models."""
from __future__ import annotations

import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base


class BatchJobStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    DONE = "done"
    PARTIAL = "partial"       # Some images failed, some succeeded
    ERROR = "error"


class BatchJob(Base):
    """Tracks a bulk scan batch (10–20 images)."""
    __tablename__ = "batch_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    batch_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[BatchJobStatus] = mapped_column(
        Enum(BatchJobStatus), default=BatchJobStatus.PENDING, nullable=False
    )
    total_images: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    processed_images: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_images: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    avg_compliance_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Aggregated summary JSON
    summary: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    items: Mapped[list["BatchItem"]] = relationship(
        "BatchItem", back_populates="batch_job", cascade="all, delete-orphan"
    )


class BatchItem(Base):
    """One image within a batch job."""
    __tablename__ = "batch_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    batch_job_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("batch_jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    upload_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("uploads.id", ondelete="SET NULL"), nullable=True, index=True
    )
    analysis_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("analyses.id", ondelete="SET NULL"), nullable=True
    )
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    compliance_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    pass_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fail_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    warn_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    batch_job: Mapped["BatchJob"] = relationship("BatchJob", back_populates="items")
