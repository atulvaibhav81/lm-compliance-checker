import re
from rule_engine.base_rule import BaseRule, FindingResult
from services.ocr_service import OcrResult

class MRPRule(BaseRule):
    rule_code = "R6-E"
    rule_name = "Maximum Retail Price (MRP)"

    def check(self, text: str, ocr_result: OcrResult | None = None, scale_factor: float = 1.0, **kwargs) -> FindingResult:
        text_lower = text.lower()
        
        # Simple regex to find MRP and a price
        mrp_pattern = r"(mrp|m\.r\.p|retail price|rs\.?|₹|inr)\s*[:.\-]?\s*(\d+(?:\.\d{1,2})?)"
        match = re.search(mrp_pattern, text_lower, re.IGNORECASE)
        
        if match:
            extracted = match.group(0).strip()
            return self._pass(extracted=extracted, msg="MRP declaration found on label.")
        
        return self._fail(msg="Could not detect MRP declaration (keywords: MRP, Rs., ₹).")
