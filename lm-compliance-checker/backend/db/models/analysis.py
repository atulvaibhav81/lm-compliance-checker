"""db/models/analysis.py — Analysis ORM model."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    upload_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("uploads.id", ondelete="CASCADE"), nullable=False, index=True
    )
    raw_ocr_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    preprocessed_image_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    ocr_confidence: Mapped[float | None] = mapped_column(nullable=True)
    image_quality_confidence: Mapped[float | None] = mapped_column(nullable=True)
    
    # PDF Report Metadata
    company_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    product_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    auditor_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    annotated_image_path: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # relationships
    upload: Mapped["Upload"] = relationship("Upload", backref="analyses")  # type: ignore[name-defined]
    findings: Mapped[list["ComplianceFinding"]] = relationship(  # type: ignore[name-defined]
        "ComplianceFinding", back_populates="analysis", cascade="all, delete-orphan"
    )
