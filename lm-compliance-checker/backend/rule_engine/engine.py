"""
rule_engine/engine.py
RuleEngine — discovers and runs all compliance rules against OCR text.
"""
from __future__ import annotations

import logging

from rule_engine.base_rule import BaseRule, FindingResult
from services.ocr_service import OcrResult
from rule_engine.rules.font_size_rule import FontSizeRule
from rule_engine.rules.barcode_rule import BarcodeRule

logger = logging.getLogger(__name__)

# Ordered list of all rules (order = display order in report)
_ALL_RULES: list[type[BaseRule]] = [
    FontSizeRule,
    BarcodeRule,
]


class RuleEngine:
    """Instantiates and runs all registered compliance rules."""

    def __init__(self, rules: list[type[BaseRule]] | None = None):
        rule_classes = rules or _ALL_RULES
        self._rules: list[BaseRule] = [cls() for cls in rule_classes]
        logger.info("RuleEngine initialised with %d rules", len(self._rules))

    def run(self, ocr_text: str, ocr_result: OcrResult | None = None, scale_factor: float = 1.0, **kwargs) -> list[FindingResult]:
        """
        Run all rules against *ocr_text*.

        Returns:
            List of FindingResult, one per rule, in registration order.
        """
        findings: list[FindingResult] = []
        for rule in self._rules:
            try:
                result = rule.check(ocr_text, ocr_result=ocr_result, scale_factor=scale_factor, **kwargs)
                findings.append(result)
                logger.debug("[%s] %s → %s", rule.rule_code, rule.rule_name, result.status)
            except Exception:
                logger.exception("Rule %s raised an unexpected error", rule.rule_code)
        return findings

    @property
    def rule_count(self) -> int:
        return len(self._rules)
