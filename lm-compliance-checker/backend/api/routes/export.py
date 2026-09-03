"""api/routes/export.py — PDF and CSV export endpoints"""
from __future__ import annotations

import csv
import io
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session, joinedload

from api.deps import get_db
from db.models.analysis import Analysis
from db.models.batch_job import BatchJob
from db.models.upload import Upload
from services.batch_service import batch_service
from services.pdf_report_service import pdf_report_service
from services.audit_log_service import audit_log_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/export", tags=["export"])


# ── PDF export ────────────────────────────────────────────────────────────────

@router.get("/pdf/{analysis_id}", response_class=Response)
def export_pdf(
    analysis_id: int,
    include_penalty: bool = False,
    is_repeat_offense: bool = False,
    db: Session = Depends(get_db),
) -> Response:
    """
    Generate and stream a professional audit report PDF for an analysis.
    Optionally includes penalty calculation section.
    """
    analysis = (
        db.query(Analysis)
        .options(joinedload(Analysis.findings))
        .filter(Analysis.id == analysis_id)
        .first()
    )
    if not analysis:
        raise HTTPException(status_code=404, detail=f"Analysis id={analysis_id} not found.")

    upload = db.query(Upload).filter(Upload.id == analysis.upload_id).first()

    # ── Build report data dict ────────────────────────────────────────────
    findings = sorted(analysis.findings, key=lambda f: f.rule_code)
    counts = {"PASS": 0, "FAIL": 0, "WARN": 0, "SKIP": 0}
    for f in findings:
        counts[f.status.value] = counts.get(f.status.value, 0) + 1
    total = len(findings)
    score = round((counts["PASS"] / total) * 100, 1) if total else 0.0

    report_data = {
        "analysis_id": analysis_id,
        "upload_id": analysis.upload_id,
        "filename": upload.original_filename if upload else "Unknown",
        "ocr_confidence": (analysis.ocr_confidence or 0) * 100
                          if (analysis.ocr_confidence or 0) <= 1 else (analysis.ocr_confidence or 0),
        "image_quality_confidence": (analysis.image_quality_confidence or 0),
        "created_at": analysis.created_at,
        "company_name": analysis.company_name,
        "product_name": analysis.product_name,
        "auditor_notes": analysis.auditor_notes,
        "annotated_image_path": analysis.annotated_image_path,
        "preprocessed_image_path": analysis.preprocessed_image_path,
        "summary": {
            "total_rules": total,
            "PASS": counts["PASS"],
            "FAIL": counts["FAIL"],
            "WARN": counts["WARN"],
            "compliance_score": score,
        },
        "findings": [
            {
                "rule_code": f.rule_code,
                "rule_name": f.rule_name,
                "status": f.status.value,
                "extracted_value": f.extracted_value,
                "message": f.message,
            }
            for f in findings
        ],
    }

    # Optionally add penalty section
    if include_penalty and counts["FAIL"] > 0:
        from services.penalty_service import penalty_service
        penalty_result = penalty_service.calculate_from_findings(
            analysis_id=analysis_id,
            findings=analysis.findings,
            is_repeat_offense=is_repeat_offense,
        )
        report_data["penalty"] = {
            "violation_count": penalty_result.violation_count,
            "total_fine_min": penalty_result.total_fine_min,
            "total_fine_max": penalty_result.total_fine_max,
            "is_repeat_offense": is_repeat_offense,
            "violations": penalty_service.to_db_breakdown(penalty_result),
        }

    try:
        pdf_bytes = pdf_report_service.generate(report_data)
    except Exception as exc:
        logger.exception("PDF generation failed for analysis_id=%d", analysis_id)
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {exc}") from exc

    audit_log_service.log_success(
        db, "EXPORT_PDF", "analysis", analysis_id,
        details={"bytes": len(pdf_bytes), "include_penalty": include_penalty}
    )

    filename = f"lm_compliance_report_{analysis_id}_{datetime.now().strftime('%Y%m%d')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── CSV export — batch ────────────────────────────────────────────────────────

@router.get("/csv/batch/{batch_id}")
def export_batch_csv(
    batch_id: int,
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """Export batch scan results as a downloadable CSV file."""
    batch_job = db.query(BatchJob).filter(BatchJob.id == batch_id).first()
    if not batch_job:
        raise HTTPException(status_code=404, detail=f"Batch id={batch_id} not found.")

    try:
        rows = batch_service.to_csv_rows(batch_id, db)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    output = io.StringIO()
    if rows:
        writer = csv.DictWriter(output, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    else:
        output.write("No data available")

    output.seek(0)
    filename = f"batch_{batch_id}_results_{datetime.now().strftime('%Y%m%d')}.csv"

    audit_log_service.log_success(db, "EXPORT_CSV", "batch_job", batch_id)

    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8-sig")),  # UTF-8-BOM for Excel compatibility
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── CSV export — all analyses ─────────────────────────────────────────────────

@router.get("/csv/all")
def export_all_csv(
    limit: int = 100,
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """Export all analyses as a CSV report (newest first, up to `limit`)."""
    analyses = (
        db.query(Analysis)
        .options(joinedload(Analysis.findings), joinedload(Analysis.upload))
        .order_by(Analysis.created_at.desc())
        .limit(limit)
        .all()
    )

    rows = []
    for a in analyses:
        upload = db.query(Upload).filter(Upload.id == a.upload_id).first()
        findings = a.findings or []
        counts = {"PASS": 0, "FAIL": 0, "WARN": 0}
        for f in findings:
            counts[f.status.value] = counts.get(f.status.value, 0) + 1
        total = len(findings)
        score = round((counts["PASS"] / total) * 100, 1) if total else 0.0
        fail_rules = ", ".join(
            f.rule_code for f in findings if f.status.value == "FAIL"
        )

        rows.append({
            "Analysis ID": a.id,
            "Upload ID": a.upload_id,
            "Filename": upload.original_filename if upload else "N/A",
            "Scan Date": a.created_at.strftime("%Y-%m-%d %H:%M") if a.created_at else "",
            "OCR Confidence": f"{(a.ocr_confidence or 0):.1f}",
            "Image Quality": f"{(a.image_quality_confidence or 0):.1f}",
            "Total Rules": total,
            "Pass": counts["PASS"],
            "Fail": counts["FAIL"],
            "Warn": counts["WARN"],
            "Compliance Score (%)": score,
            "Failed Rules": fail_rules,
        })

    output = io.StringIO()
    if rows:
        writer = csv.DictWriter(output, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    output.seek(0)
    filename = f"all_analyses_{datetime.now().strftime('%Y%m%d')}.csv"

    audit_log_service.log_success(db, "EXPORT_CSV", details={"type": "all", "count": len(rows)})

    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8-sig")),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
