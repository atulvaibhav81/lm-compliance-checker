import re
from rule_engine.base_rule import BaseRule, FindingResult
from services.ocr_service import OcrResult

class ManufacturerRule(BaseRule):
    rule_code = "R6-B"
    rule_name = "Manufacturer/Packer Details"

    def check(self, text: str, ocr_result: OcrResult | None = None, scale_factor: float = 1.0, **kwargs) -> FindingResult:
        pattern = r"(manufactured by|pkd by|packed by|marketed by|mfg\.?\s*by|imported by|mfd\.?\s*by)"
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return self._pass(extracted=match.group(0), msg="Manufacturer or packer details found.")
        return self._fail(msg="Could not detect manufacturer/packer declaration.")
