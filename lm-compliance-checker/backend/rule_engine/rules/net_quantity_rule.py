import re
from rule_engine.base_rule import BaseRule, FindingResult
from services.ocr_service import OcrResult

class NetQuantityRule(BaseRule):
    rule_code = "R6-C"
    rule_name = "Net Quantity"

    def check(self, text: str, ocr_result: OcrResult | None = None, scale_factor: float = 1.0, **kwargs) -> FindingResult:
        pattern = r"(net\s*qty|net\s*quantity|net\s*weight|net\s*wt|volume|content|qty)\s*[:.\-]?\s*(\d+(?:\.\d+)?\s*(g|kg|ml|l|mg|oz|lb|pcs|units))"
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return self._pass(extracted=match.group(0).strip(), msg="Net quantity declaration found.")
        
        # fallback just for number + unit without keywords
        pattern2 = r"\b(\d+(?:\.\d+)?\s*(g|kg|ml|l)\b)"
        match2 = re.search(pattern2, text, re.IGNORECASE)
        if match2:
            return self._warn(extracted=match2.group(0).strip(), msg="Found quantity-like string but missing 'Net Qty' prefix.")
            
        return self._fail(msg="Could not detect net quantity declaration.")
