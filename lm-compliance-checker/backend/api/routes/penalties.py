"""api/routes/penalties.py — POST /api/penalties/calculate"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from api.deps import get_db
from db.models.analysis import Analysis
from db.models.penalty import PenaltyRecord
from services.audit_log_service import audit_log_service
from services.penalty_service import penalty_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/penalties", tags=["penalties"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class PenaltyCalculateRequest(BaseModel):
    analysis_id: int
    is_repeat_offense: bool = False
    custom_violations: list[str] | None = Field(
        default=None,
        description="Optional: override with specific rule_codes to penalise"
    )


class ViolationPenaltyOut(BaseModel):
    rule_code: str
    rule_name: str
    act_section: str
    description: str
    fine_min: float
    fine_max: float
    imprisonment_months: int
    is_repeat_offense: bool
    notes: str | None = None


class PenaltyCalculateResponse(BaseModel):
    analysis_id: int
    record_id: int | None
    is_repeat_offense: bool
    violation_count: int
    total_fine_min: float
    total_fine_max: float
    violations: list[ViolationPenaltyOut]
    summary_text: str
    applicable_act: str


class PenaltyMatrixEntry(BaseModel):
    rule_code: str
    act_section: str
    description: str
    first_offense_min: float
    first_offense_max: float
    repeat_offense_min: float
    repeat_offense_max: float
    notes: str | None = None


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/calculate", response_model=PenaltyCalculateResponse)
def calculate_penalty(
    req: PenaltyCalculateRequest,
    db: Session = Depends(get_db),
) -> PenaltyCalculateResponse:
    """
    Calculate penalties for all FAIL findings in an analysis.

    Maps each violated rule to its Legal Metrology Act/Rules section
    and computes the estimated fine range per the LM Act 2009.
    """
    # Fetch analysis with findings
    analysis = (
        db.query(Analysis)
        .options(joinedload(Analysis.findings))
        .filter(Analysis.id == req.analysis_id)
        .first()
    )
    if not analysis:
        raise HTTPException(status_code=404, detail=f"Analysis id={req.analysis_id} not found.")

    # Calculate
    if req.custom_violations:
        result = penalty_service.calculate(
            analysis_id=req.analysis_id,
            failing_rules=req.custom_violations,
            is_repeat_offense=req.is_repeat_offense,
        )
    else:
        result = penalty_service.calculate_from_findings(
            analysis_id=req.analysis_id,
            findings=analysis.findings,
            is_repeat_offense=req.is_repeat_offense,
        )

    # Persist penalty record
    breakdown = penalty_service.to_db_breakdown(result)
    record = PenaltyRecord(
        analysis_id=req.analysis_id,
        is_repeat_offense=req.is_repeat_offense,
        total_fine_min=result.total_fine_min,
        total_fine_max=result.total_fine_max,
        violation_count=result.violation_count,
        breakdown=breakdown,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    audit_log_service.log_success(
        db, "PENALTY_CALCULATE", "penalty_record", record.id,
        details={
            "analysis_id": req.analysis_id,
            "violations": result.violation_count,
            "fine_range": f"{result.total_fine_min}-{result.total_fine_max}",
        }
    )

    violations_out = [
        ViolationPenaltyOut(
            rule_code=v.rule_code,
            rule_name=v.rule_name,
            act_section=v.act_section,
            description=v.description,
            fine_min=v.fine_min,
            fine_max=v.fine_max,
            imprisonment_months=v.imprisonment_months,
            is_repeat_offense=v.is_repeat_offense,
            notes=getattr(v, 'notes', None)
        )
        for v in result.violations
    ]

    return PenaltyCalculateResponse(
        analysis_id=req.analysis_id,
        record_id=record.id,
        is_repeat_offense=req.is_repeat_offense,
        violation_count=result.violation_count,
        total_fine_min=result.total_fine_min,
        total_fine_max=result.total_fine_max,
        violations=violations_out,
        summary_text=result.summary_text,
        applicable_act=result.applicable_act,
    )


@router.get("/matrix", response_model=list[PenaltyMatrixEntry])
def get_penalty_matrix() -> list[PenaltyMatrixEntry]:
    """Return the full configurable penalty matrix from rules_config.yaml."""
    from rule_engine.config_loader import rules_config
    entries = []
    for code, entry in rules_config.penalty_matrix.items():
        entries.append(PenaltyMatrixEntry(
            rule_code=code,
            act_section=entry.get("act_section", ""),
            description=entry.get("description", ""),
            first_offense_min=entry.get("first_offense_min", 0),
            first_offense_max=entry.get("first_offense_max", 0),
            repeat_offense_min=entry.get("repeat_offense_min", 0),
            repeat_offense_max=entry.get("repeat_offense_max", 0),
            notes=entry.get("notes", None)
        ))
    return entries


@router.get("/history/{analysis_id}", response_model=list[dict])
def get_penalty_history(analysis_id: int, db: Session = Depends(get_db)) -> list[dict]:
    """Get all penalty calculations for a given analysis."""
    records = (
        db.query(PenaltyRecord)
        .filter(PenaltyRecord.analysis_id == analysis_id)
        .order_by(PenaltyRecord.created_at.desc())
        .all()
    )
    return [
        {
            "record_id": r.id,
            "analysis_id": r.analysis_id,
            "is_repeat_offense": r.is_repeat_offense,
            "violation_count": r.violation_count,
            "total_fine_min": r.total_fine_min,
            "total_fine_max": r.total_fine_max,
            "breakdown": r.breakdown,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in records
    ]
