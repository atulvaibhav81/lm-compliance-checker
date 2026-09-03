"""
rule_engine/base_rule.py
Abstract base class for all LM-PC compliance rules.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

from db.models.compliance import RuleStatus
from services.ocr_service import OcrResult


@dataclass
class FindingResult:
    """Returned by every rule's check() method."""
    rule_code: str
    rule_name: str
    status: RuleStatus
    extracted_value: str | None
    message: str


class BaseRule(ABC):
    """
    All compliance rules inherit from this class.

    Subclasses must define:
      - rule_code  (str)  e.g. "R6-C"
      - rule_name  (str)  e.g. "Maximum Retail Price (MRP)"
      - check(text: str) -> FindingResult
    """

    rule_code: str
    rule_name: str

    @abstractmethod
    def check(self, text: str, ocr_result: OcrResult | None = None, scale_factor: float = 1.0, **kwargs) -> FindingResult:
        """
        Run the compliance check against raw OCR text.

        Args:
            text: Full OCR-extracted text from the label.

        Returns:
            FindingResult with PASS / FAIL / WARN / SKIP status.
        """
        ...

    def _pass(self, extracted: str | None = None, msg: str = "Requirement met.") -> FindingResult:
        return FindingResult(self.rule_code, self.rule_name, RuleStatus.PASS, extracted, msg)

    def _fail(self, extracted: str | None = None, msg: str = "Requirement not met.") -> FindingResult:
        return FindingResult(self.rule_code, self.rule_name, RuleStatus.FAIL, extracted, msg)

    def _warn(self, extracted: str | None = None, msg: str = "Partial / uncertain match.") -> FindingResult:
        return FindingResult(self.rule_code, self.rule_name, RuleStatus.WARN, extracted, msg)

    def _skip(self, msg: str = "Rule not applicable.") -> FindingResult:
        return FindingResult(self.rule_code, self.rule_name, RuleStatus.SKIP, None, msg)
