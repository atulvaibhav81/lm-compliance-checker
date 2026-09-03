"""api/routes/reports.py — GET /api/reports and GET /api/reports/{analysis_id}"""
from __future__ import annotations

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from api.deps import get_db
from db.models.analysis import Analysis
from db.models.upload import Upload

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/reports", tags=["reports"])


# ── Pydantic response schemas ─────────────────────────────────────────────────

class FindingOut(BaseModel):
    rule_code: str
    rule_name: str
    status: str
    extracted_value: str | None
    message: str

    model_config = {"from_attributes": True}


class ReportSummaryOut(BaseModel):
    analysis_id: int
    upload_id: int
    original_filename: str
    upload_status: str
    ocr_confidence: float | None
    image_quality_confidence: float | None
    created_at: datetime
    total_rules: int
    passed: int
    failed: int
    warned: int
    compliance_score: float

    model_config = {"from_attributes": True}


class ReportDetailOut(ReportSummaryOut):
    ocr_text: str
    findings: list[FindingOut]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_summary(analysis: Analysis, upload: Upload) -> dict:
    counts = {"PASS": 0, "FAIL": 0, "WARN": 0, "SKIP": 0}
    for f in analysis.findings:
        counts[f.status.value] = counts.get(f.status.value, 0) + 1
    total = len(analysis.findings)
    score = round((counts["PASS"] / total) * 100, 1) if total else 0.0
    return {
        "analysis_id": analysis.id,
        "upload_id": analysis.upload_id,
        "original_filename": upload.original_filename,
        "upload_status": upload.status.value,
        "ocr_confidence": analysis.ocr_confidence,
        "image_quality_confidence": analysis.image_quality_confidence,
        "created_at": analysis.created_at,
        "total_rules": total,
        "passed": counts["PASS"],
        "failed": counts["FAIL"],
        "warned": counts["WARN"],
        "compliance_score": score,
    }


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[ReportSummaryOut])
def list_reports(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> list[ReportSummaryOut]:
    """Paginated list of all past analyses (newest first)."""
    analyses = (
        db.query(Analysis)
        .options(joinedload(Analysis.findings), joinedload(Analysis.upload))
        .order_by(Analysis.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    results = []
    for a in analyses:
        upload = db.query(Upload).filter(Upload.id == a.upload_id).first()
        if upload:
            results.append(ReportSummaryOut(**_build_summary(a, upload)))
    return results


@router.get("/{analysis_id}", response_model=ReportDetailOut)
def get_report(
    analysis_id: int,
    db: Session = Depends(get_db),
) -> ReportDetailOut:
    """Detailed compliance report for a single analysis."""
    analysis = (
        db.query(Analysis)
        .options(joinedload(Analysis.findings))
        .filter(Analysis.id == analysis_id)
        .first()
    )
    if not analysis:
        raise HTTPException(status_code=404, detail=f"Analysis id={analysis_id} not found.")

    upload = db.query(Upload).filter(Upload.id == analysis.upload_id).first()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload record missing.")

    summary = _build_summary(analysis, upload)
    findings_out = [
        FindingOut(
            rule_code=f.rule_code,
            rule_name=f.rule_name,
            status=f.status.value,
            extracted_value=f.extracted_value,
            message=f.message,
        )
        for f in sorted(analysis.findings, key=lambda x: x.rule_code)
    ]
    return ReportDetailOut(**summary, ocr_text=analysis.raw_ocr_text or "", findings=findings_out)
