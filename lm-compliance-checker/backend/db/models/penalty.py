"""db/models/penalty.py — PenaltyRecord ORM model."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base


class PenaltyRecord(Base):
    """Stores calculated penalty for an analysis."""
    __tablename__ = "penalty_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    analysis_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    is_repeat_offense: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    total_fine_min: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    total_fine_max: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    violation_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # JSON list of per-violation penalty breakdowns
    breakdown: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    calculated_by: Mapped[str | None] = mapped_column(String(128), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    analysis: Mapped["Analysis"] = relationship("Analysis", backref="penalty_records")  # type: ignore[name-defined]
