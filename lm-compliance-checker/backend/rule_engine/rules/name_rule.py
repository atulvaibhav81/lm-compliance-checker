import re
from rule_engine.base_rule import BaseRule, FindingResult
from services.ocr_service import OcrResult

class NameRule(BaseRule):
    rule_code = "R6-A"
    rule_name = "Name of Commodity"

    def check(self, text: str, ocr_result: OcrResult | None = None, scale_factor: float = 1.0, **kwargs) -> FindingResult:
        if len(text.strip()) > 10:
            return self._pass(msg="Sufficient text detected; assumed commodity name present.")
        return self._fail(msg="Insufficient text to detect commodity name.")
