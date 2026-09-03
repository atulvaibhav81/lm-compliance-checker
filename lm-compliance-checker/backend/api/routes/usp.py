"""api/routes/usp.py — POST /api/usp/validate and POST /api/usp/extract"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from api.deps import get_db
from db.models.analysis import Analysis
from services.audit_log_service import audit_log_service
from services.usp_service import usp_service, USPStatus

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/usp", tags=["usp"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class USPValidateRequest(BaseModel):
    mrp: float = Field(..., gt=0, description="Maximum Retail Price in INR")
    net_quantity: float = Field(..., gt=0, description="Numeric quantity value")
    quantity_unit: str = Field(..., description="Unit string: g, kg, ml, l, nos")
    printed_usp: float | None = Field(default=None, description="Printed USP on label (optional)")

    @field_validator("quantity_unit")
    @classmethod
    def unit_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("quantity_unit cannot be empty")
        return v.strip().lower()


class USPExtractRequest(BaseModel):
    analysis_id: int = Field(..., description="Existing analysis ID to extract from")


class USPValidationResponse(BaseModel):
    status: str
    mrp: float | None
    net_quantity: float | None
    quantity_unit: str | None
    quantity_base_unit: str | None
    printed_usp: float | None
    computed_usp: float | None
    difference_pct: float | None
    tolerance_pct: float
    message: str
    confidence: float


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/validate", response_model=USPValidationResponse)
def validate_usp(
    req: USPValidateRequest,
    db: Session = Depends(get_db),
) -> USPValidationResponse:
    """
    Validate Unit Sale Price (USP) from explicit MRP, quantity and printed USP.

    USP = MRP ÷ Net Quantity (in base unit).
    Validates printed USP against computed value within ±tolerance%.
    """
    result = usp_service.validate(
        mrp=req.mrp,
        net_quantity=req.net_quantity,
        quantity_unit=req.quantity_unit,
        printed_usp=req.printed_usp,
    )

    audit_log_service.log_success(
        db, "USP_VALIDATE", details={
            "status": result.status.value,
            "mrp": req.mrp,
            "computed_usp": result.computed_usp,
            "difference_pct": result.difference_pct,
        }
    )

    return USPValidationResponse(
        status=result.status.value,
        mrp=result.mrp,
        net_quantity=result.net_quantity,
        quantity_unit=result.quantity_unit,
        quantity_base_unit=result.quantity_base_unit,
        printed_usp=result.printed_usp,
        computed_usp=result.computed_usp,
        difference_pct=result.difference_pct,
        tolerance_pct=result.tolerance_pct,
        message=result.message,
        confidence=result.confidence,
    )


@router.post("/extract-validate", response_model=USPValidationResponse)
def extract_and_validate_usp(
    req: USPExtractRequest,
    db: Session = Depends(get_db),
) -> USPValidationResponse:
    """
    Auto-extract MRP, Net Quantity, and printed USP from an existing analysis's
    OCR text, then validate. Useful for re-checking past scans.
    """
    analysis = db.query(Analysis).filter(Analysis.id == req.analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail=f"Analysis id={req.analysis_id} not found.")

    if not analysis.raw_ocr_text:
        raise HTTPException(status_code=422, detail="No OCR text available for this analysis.")

    result = usp_service.extract_and_validate(analysis.raw_ocr_text)

    audit_log_service.log_success(
        db, "USP_VALIDATE", "analysis", req.analysis_id,
        details={"status": result.status.value, "confidence": result.confidence}
    )

    return USPValidationResponse(
        status=result.status.value,
        mrp=result.mrp,
        net_quantity=result.net_quantity,
        quantity_unit=result.quantity_unit,
        quantity_base_unit=result.quantity_base_unit,
        printed_usp=result.printed_usp,
        computed_usp=result.computed_usp,
        difference_pct=result.difference_pct,
        tolerance_pct=result.tolerance_pct,
        message=result.message,
        confidence=result.confidence,
    )
