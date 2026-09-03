import re
from rule_engine.base_rule import BaseRule, FindingResult
from services.ocr_service import OcrResult

class DateRule(BaseRule):
    rule_code = "R6-D"
    rule_name = "Date of Manufacture/Packing"

    def check(self, text: str, ocr_result: OcrResult | None = None, scale_factor: float = 1.0, **kwargs) -> FindingResult:
        pattern = r"(mfg|pkd|mfd|packed\s*on|manufactured\s*on|date\s*of\s*mfg|use\s*by|exp|expiry|best\s*before)\s*[:.\-]?\s*([0-9]{2}[/\-][0-9]{2}[/\-][0-9]{2,4}|[a-zA-Z]{3,}\s+[0-9]{4})"
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return self._pass(extracted=match.group(0).strip(), msg="Manufacturing or expiry date found.")
        return self._fail(msg="Could not detect date of manufacture/packing.")
