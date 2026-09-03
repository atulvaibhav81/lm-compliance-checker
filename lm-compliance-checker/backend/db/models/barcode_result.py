"""db/models/barcode_result.py — Barcode/QR scan result per analysis."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base


class BarcodeResult(Base):
    """Stores decoded barcode / QR code data linked to an analysis."""
    __tablename__ = "barcode_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    analysis_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    symbology: Mapped[str | None] = mapped_column(String(64), nullable=True)   # e.g. EAN-13, QR Code
    raw_data: Mapped[str | None] = mapped_column(Text, nullable=True)           # Decoded payload
    is_valid: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    checksum_valid: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    match_status: Mapped[str | None] = mapped_column(String(32), nullable=True)  # MATCH/MISMATCH/UNVERIFIED
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    location: Mapped[str | None] = mapped_column(String(128), nullable=True)    # Bounding polygon coords as string
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    analysis: Mapped["Analysis"] = relationship("Analysis", backref="barcode_results")  # type: ignore[name-defined]
