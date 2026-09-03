"""api/routes/analyze.py — POST /api/analyze/{upload_id}"""
from __future__ import annotations

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.deps import get_db
from db.models.upload import Upload, UploadStatus
from services.compliance_service import compliance_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analyze", tags=["analyze"])


class FindingOut(BaseModel):
    rule_code: str
    rule_name: str
    status: str
    extracted_value: str | None
    message: str

    model_config = {"from_attributes": True}


class AnalyzeResponse(BaseModel):
    analysis_id: int
    upload_id: int
    ocr_text: str
    ocr_confidence: float
    image_quality_confidence: float
    company_name: str | None = None
    product_name: str | None = None
    auditor_notes: str | None = None
    annotated_image_path: str | None = None
    findings: list[FindingOut]
    summary: dict

    model_config = {"from_attributes": True}


class MetadataUpdate(BaseModel):
    company_name: str | None = None
    product_name: str | None = None
    auditor_notes: str | None = None


@router.post("/{upload_id}", response_model=AnalyzeResponse)
def analyze_upload(
    upload_id: int,
    pdp_area: float | None = None,
    db: Session = Depends(get_db),
) -> AnalyzeResponse:
    """
    Run the full compliance pipeline on an uploaded image:
      1. OpenCV preprocessing
      2. Tesseract OCR
      3. LM-PC Rule Engine (Rule 6 checks)

    Returns a detailed compliance report.
    """
    print(">>> INCOMING SCAN REQUEST RECEIVED FOR ANALYSIS ID:", upload_id)
    
    # ── Fetch upload ────────────────────────────────────────────────────
    upload = db.query(Upload).filter(Upload.id == upload_id).first()
    if not upload:
        raise HTTPException(status_code=404, detail=f"Upload id={upload_id} not found.")

    if upload.status == UploadStatus.PROCESSING:
        raise HTTPException(status_code=409, detail="Analysis already in progress.")

    # ── Run pipeline ────────────────────────────────────────────────────
    try:
        analysis = compliance_service.run_analysis(upload, db, pdp_area=pdp_area)
    except Exception as exc:
        logger.exception("Pipeline error for upload_id=%d", upload_id)
        raise HTTPException(status_code=500, detail=f"Analysis failed: {exc}") from exc

    # ── Build summary ───────────────────────────────────────────────────
    findings_out = [
        FindingOut(
            rule_code=f.rule_code,
            rule_name=f.rule_name,
            status=f.status.value,
            extracted_value=f.extracted_value,
            message=f.message,
        )
        for f in analysis.findings
    ]

    counts = {"PASS": 0, "FAIL": 0, "WARN": 0, "SKIP": 0}
    for f in findings_out:
        counts[f.status] = counts.get(f.status, 0) + 1

    total = len(findings_out)
    compliance_score = round((counts["PASS"] / total) * 100, 1) if total else 0

    return AnalyzeResponse(
        analysis_id=analysis.id,
        upload_id=upload_id,
        ocr_text=analysis.raw_ocr_text or "",
        ocr_confidence=analysis.ocr_confidence or 0.0,
        image_quality_confidence=analysis.image_quality_confidence or 0.0,
        findings=findings_out,
        summary={
            "total_rules": total,
            **counts,
            "compliance_score": compliance_score,
        },
        company_name=analysis.company_name,
        product_name=analysis.product_name,
        auditor_notes=analysis.auditor_notes,
        annotated_image_path=analysis.annotated_image_path,
    )


@router.put("/{analysis_id}/metadata", response_model=dict)
def update_metadata(
    analysis_id: int,
    data: MetadataUpdate,
    db: Session = Depends(get_db),
):
    from db.models.analysis import Analysis
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    if data.company_name is not None:
        analysis.company_name = data.company_name
    if data.product_name is not None:
        analysis.product_name = data.product_name
    if data.auditor_notes is not None:
        analysis.auditor_notes = data.auditor_notes
        
    db.commit()
    return {"message": "Metadata updated successfully"}
