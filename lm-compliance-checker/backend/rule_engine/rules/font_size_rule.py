"""
rule_engine/rules/font_size_rule.py
LM-PC Rule 8: Font Size Compliance.
Estimates text height using OCR bounding boxes and DPI.
"""
from __future__ import annotations

import re
from typing import Any

from db.models.compliance import RuleStatus
from rule_engine.base_rule import BaseRule, FindingResult
from rule_engine.config_loader import rules_config
from services.ocr_service import OcrResult

class FontSizeRule(BaseRule):
    rule_code = "R8"
    rule_name = "Font Size Compliance"

    def check(self, text: str, ocr_result: OcrResult | None = None, scale_factor: float = 1.0, **kwargs) -> FindingResult:
        if not ocr_result or not ocr_result.lines:
            return self._skip("OCR bounding boxes are required for font size validation.")

        # Fallback to 300 DPI if EXIF DPI is missing
        dpi = ocr_result.dpi or 300
        tolerance_pct = rules_config.font_tolerance_pct
        
        pdp_area = kwargs.get("pdp_area")
        thresholds = rules_config.get_font_thresholds(pdp_area)

        targets = {
            "MRP": (re.compile(r"(?i)(?:MRP|Price|Rs\.?|₹)"), thresholds["mrp_min_height_mm"]),
            "Net Quantity": (re.compile(r"(?i)(?:Net\s+Qty|Net\s+Weight|Volume)"), thresholds["net_qty_min_height_mm"]),
            "Manufacturer": (re.compile(r"(?i)(?:Mfd|Manufactured|Packed|Imported)"), thresholds["manufacturer_min_height_mm"]),
        }

        issues: list[str] = []
        passed: list[str] = []

        for line_text, box in ocr_result.lines:
            # Box format: [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
            try:
                y_coords = [pt[1] for pt in box]
                box_height_px = max(y_coords) - min(y_coords)
            except Exception:
                continue

            # Convert to original image pixels, then to mm
            original_px_height = box_height_px / scale_factor
            height_mm = (original_px_height / dpi) * 25.4

            for target_name, (pattern, min_mm) in targets.items():
                if pattern.search(line_text):
                    # Apply tolerance
                    threshold_with_tolerance = min_mm * (1 - (tolerance_pct / 100.0))

                    result_str = f"{target_name} ({height_mm:.1f}mm / req {min_mm}mm)"
                    if height_mm >= threshold_with_tolerance:
                        if result_str not in passed:
                            passed.append(result_str)
                    else:
                        if result_str not in issues:
                            issues.append(result_str)

        if not passed and not issues:
            return self._skip("Could not locate key declarations to measure font size.")

        if issues:
            return self._fail(
                extracted=" | ".join(issues + passed),
                msg=f"Font size violations detected: {', '.join(issues)}"
            )
        
        return self._pass(
            extracted=" | ".join(passed),
            msg="All detected declarations meet minimum font size requirements."
        )
