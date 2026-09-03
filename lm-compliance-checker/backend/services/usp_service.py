"""
services/usp_service.py
Unit Sale Price (USP) Validator — LM-PC Rule 18.

USP = MRP / Net Quantity (converted to standard base unit)
Printed USP is validated against computed USP within ±tolerance%.

The service also provides OCR-based auto-extraction of MRP,
net quantity and printed USP from raw OCR text.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from enum import Enum

from rule_engine.config_loader import rules_config

logger = logging.getLogger(__name__)


class USPStatus(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    WARN = "WARN"
    SKIP = "SKIP"   # Could not extract enough data


@dataclass
class USPValidationResult:
    status: USPStatus
    mrp: float | None
    net_quantity: float | None
    quantity_unit: str | None
    quantity_base_unit: str | None
    printed_usp: float | None
    computed_usp: float | None
    difference_pct: float | None
    tolerance_pct: float
    message: str
    confidence: float  # 0–1 extraction confidence


class USPService:
    """
    Validates Unit Sale Price declarations on packaged commodity labels.

    Supports two modes:
      1. Direct validation — caller provides MRP, qty, printed USP
      2. OCR extraction + validation — extracts values from raw OCR text

    Unit conversion table (to base unit):
      g  → g   (base: g per 100g = g/100)
      kg → g   (×1000)
      ml → ml
      l  → ml  (×1000)
      nos → nos
    """

    # ── Conversion factors to base unit ────────────────────────────────────
    _CONVERSIONS: dict[str, tuple[str, float]] = {
        "g":    ("g",  1.0),
        "gm":   ("g",  1.0),
        "gram": ("g",  1.0),
        "grams":("g",  1.0),
        "kg":   ("g",  1000.0),
        "kilogram": ("g", 1000.0),
        "kilograms": ("g", 1000.0),
        "ml":   ("ml", 1.0),
        "millilitre": ("ml", 1.0),
        "millilitres": ("ml", 1.0),
        "l":    ("ml", 1000.0),
        "litre":("ml", 1000.0),
        "litres": ("ml", 1000.0),
        "liter":("ml", 1000.0),
        "liters": ("ml", 1000.0),
        "nos":  ("nos", 1.0),
        "no":   ("nos", 1.0),
        "number": ("nos", 1.0),
        "piece":("nos", 1.0),
        "pieces":("nos", 1.0),
        "pc":   ("nos", 1.0),
        "pcs":  ("nos", 1.0),
    }

    # ── OCR extraction patterns ─────────────────────────────────────────────
    _MRP_PATTERN = re.compile(
        r"(?i)(?:MRP|M\.?R\.?P\.?)\s*[:\-]?\s*(?:Rs\.?|INR|₹)?\s*(\d+(?:[.,]\d{1,2})?)"
    )
    _NET_QTY_PATTERN = re.compile(
        r"(?i)(?:net\s+(?:qty|quantity|wt|weight|vol|volume|content)[:\s]*)?(\d+(?:\.\d+)?)\s*"
        r"(g|gm|grams?|kg|kilograms?|ml|mL|l|L|litres?|liters?|nos?|pcs?|pieces?)\b"
    )
    _USP_PATTERN = re.compile(
        r"(?i)(?:USP|unit\s+sale\s+price|unit\s+price)[:\s]*(?:Rs\.?|INR|₹)?\s*(\d+(?:[.,]\d{1,2})?)"
        r"\s*/\s*(?:\d+(?:\.\d+)?\s*)?(g|gm|grams?|kg|ml|l|L|nos?|pcs?)?"
    )

    def validate(
        self,
        mrp: float,
        net_quantity: float,
        quantity_unit: str,
        printed_usp: float | None = None,
    ) -> USPValidationResult:
        """
        Validate USP from explicit values.

        Args:
            mrp:           Maximum Retail Price (INR)
            net_quantity:  Numeric quantity value on label
            quantity_unit: Unit string (g, kg, ml, l, nos, etc.)
            printed_usp:   Optional — printed USP value to validate against

        Returns:
            USPValidationResult
        """
        tolerance = rules_config.usp_tolerance_pct
        unit_lower = quantity_unit.strip().lower()
        conversion = self._CONVERSIONS.get(unit_lower)

        if conversion is None:
            return USPValidationResult(
                status=USPStatus.WARN,
                mrp=mrp,
                net_quantity=net_quantity,
                quantity_unit=quantity_unit,
                quantity_base_unit=None,
                printed_usp=printed_usp,
                computed_usp=None,
                difference_pct=None,
                tolerance_pct=tolerance,
                message=f"Unknown unit '{quantity_unit}' — cannot compute USP. Supported: g, kg, ml, l, nos.",
                confidence=0.5,
            )

        base_unit, factor = conversion
        base_qty = net_quantity * factor

        if base_qty <= 0:
            return USPValidationResult(
                status=USPStatus.FAIL,
                mrp=mrp,
                net_quantity=net_quantity,
                quantity_unit=quantity_unit,
                quantity_base_unit=base_unit,
                printed_usp=printed_usp,
                computed_usp=None,
                difference_pct=None,
                tolerance_pct=tolerance,
                message="Net quantity must be > 0 to compute USP.",
                confidence=0.9,
            )

        computed_usp = round(mrp / base_qty, 4)

        if printed_usp is None:
            return USPValidationResult(
                status=USPStatus.WARN,
                mrp=mrp,
                net_quantity=net_quantity,
                quantity_unit=quantity_unit,
                quantity_base_unit=base_unit,
                printed_usp=None,
                computed_usp=computed_usp,
                difference_pct=None,
                tolerance_pct=tolerance,
                message=(
                    f"USP not printed on label. Computed USP = ₹{computed_usp:.4f}/{base_unit}. "
                    f"Label should declare USP per Rule 18."
                ),
                confidence=0.9,
            )

        diff_pct = abs(printed_usp - computed_usp) / computed_usp * 100
        if round(diff_pct, 4) <= tolerance:
            status = USPStatus.PASS
            message = (
                f"USP PASS — Printed ₹{printed_usp:.4f}/{base_unit} matches "
                f"computed ₹{computed_usp:.4f}/{base_unit} (diff {diff_pct:.2f}% ≤ {tolerance}% tolerance)."
            )
        else:
            status = USPStatus.FAIL
            message = (
                f"USP FAIL — Printed ₹{printed_usp:.4f}/{base_unit} does NOT match "
                f"computed ₹{computed_usp:.4f}/{base_unit} "
                f"(diff {diff_pct:.2f}% exceeds {tolerance}% tolerance). "
                f"MRP=₹{mrp}, Net Qty={net_quantity}{quantity_unit}."
            )

        return USPValidationResult(
            status=status,
            mrp=mrp,
            net_quantity=net_quantity,
            quantity_unit=quantity_unit,
            quantity_base_unit=base_unit,
            printed_usp=printed_usp,
            computed_usp=computed_usp,
            difference_pct=round(diff_pct, 2),
            tolerance_pct=tolerance,
            message=message,
            confidence=0.95,
        )

    def extract_and_validate(self, ocr_text: str) -> USPValidationResult:
        """
        Auto-extract MRP, net quantity, and printed USP from raw OCR text,
        then validate them.
        """
        mrp = self._extract_mrp(ocr_text)
        net_qty, unit = self._extract_net_qty(ocr_text)
        printed_usp = self._extract_usp(ocr_text)

        if mrp is None or net_qty is None or unit is None:
            missing = []
            if mrp is None: missing.append("MRP")
            if net_qty is None or unit is None: missing.append("Net Quantity")
            return USPValidationResult(
                status=USPStatus.SKIP,
                mrp=mrp, net_quantity=net_qty, quantity_unit=unit,
                quantity_base_unit=None,
                printed_usp=printed_usp, computed_usp=None, difference_pct=None,
                tolerance_pct=rules_config.usp_tolerance_pct,
                message=f"Could not extract {', '.join(missing)} from OCR text. USP validation skipped.",
                confidence=0.3,
            )

        result = self.validate(mrp, net_qty, unit, printed_usp)
        # Lower confidence since values came from OCR
        result.confidence = min(result.confidence, 0.75)
        return result

    # ── Private extraction helpers ─────────────────────────────────────────

    def _extract_mrp(self, text: str) -> float | None:
        m = self._MRP_PATTERN.search(text)
        if m:
            try:
                return float(m.group(1).replace(",", ""))
            except ValueError:
                pass
        return None

    def _extract_net_qty(self, text: str) -> tuple[float | None, str | None]:
        for m in self._NET_QTY_PATTERN.finditer(text):
            try:
                qty = float(m.group(1))
                unit = m.group(2).strip().lower()
                return qty, unit
            except ValueError:
                continue
        return None, None

    def _extract_usp(self, text: str) -> float | None:
        m = self._USP_PATTERN.search(text)
        if m:
            try:
                return float(m.group(1).replace(",", ""))
            except ValueError:
                pass
        return None


usp_service = USPService()
