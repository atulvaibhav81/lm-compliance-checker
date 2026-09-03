from __future__ import annotations

from db.models.compliance import RuleStatus
from rule_engine.base_rule import BaseRule, FindingResult
from services.barcode_service import barcode_service
from services.ocr_service import OcrResult

class BarcodeRule(BaseRule):
    rule_code = "R6-09"
    rule_name = "Barcode / QR Validation"

    def check(self, text: str, ocr_result: OcrResult | None = None, scale_factor: float = 1.0, **kwargs) -> FindingResult:
        image_path = kwargs.get("image_path")
        if not image_path:
            return self._skip("No image path provided for barcode validation.")

        result = barcode_service.validate_image(image_path, ocr_text=text)

        extracted = " | ".join([f"{c.symbology}: {c.raw_data}" for c in result.found_codes])
        if not extracted:
            extracted = None

        if result.overall_status == "PASS":
            return self._pass(extracted=extracted, msg=result.message)
        elif result.overall_status == "FAIL":
            return self._fail(extracted=extracted, msg=result.message)
        elif result.overall_status == "WARN":
            return self._warn(extracted=extracted, msg=result.message)
        else:
            return self._skip(msg=result.message)
