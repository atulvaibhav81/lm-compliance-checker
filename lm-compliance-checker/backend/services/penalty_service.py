"""
services/penalty_service.py
Penalty & Fine Calculator for LM-PC Rules violations.

Maps each rule_code (from ComplianceFinding) to its Act/Rules section
and computes the estimated fine range per the Legal Metrology Act 2009.

Penalty thresholds are read from rule_engine/rules_config.yaml — fully
configurable without code changes.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from rule_engine.config_loader import rules_config

logger = logging.getLogger(__name__)


# ── Data classes ─────────────────────────────────────────────────────────────

@dataclass
class ViolationPenalty:
    """Penalty breakdown for a single violation."""
    rule_code: str
    rule_name: str
    act_section: str
    description: str
    is_repeat_offense: bool
    fine_min: float
    fine_max: float
    imprisonment_months: int = 0
    notes: str | None = None


@dataclass
class PenaltyCalculationResult:
    """Full penalty calculation for an analysis."""
    analysis_id: int
    is_repeat_offense: bool
    violation_count: int
    violations: list[ViolationPenalty] = field(default_factory=list)
    total_fine_min: float = 0.0
    total_fine_max: float = 0.0
    summary_text: str = ""
    applicable_act: str = "Legal Metrology Act, 2009 & LM-PC Rules, 2011"


# ── Service ───────────────────────────────────────────────────────────────────

class PenaltyService:
    """
    Calculates penalties for all FAIL findings in an analysis.

    Usage:
        result = penalty_service.calculate(
            analysis_id=42,
            failing_rules=["R6_01_MRP", "R6_02_NET_QTY"],
            rule_names={"R6_01_MRP": "MRP Declaration", ...},
            is_repeat_offense=False,
        )
    """

    # Fallback entry when a rule_code isn't in the penalty matrix
    _GENERIC_CODE = "R6_10_GENERIC_VIOLATION"

    def calculate(
        self,
        analysis_id: int,
        failing_rules: list[str],
        rule_names: dict[str, str] | None = None,
        is_repeat_offense: bool = False,
    ) -> PenaltyCalculationResult:
        """
        Calculate penalties for a list of failing rule codes.

        Args:
            analysis_id:     The Analysis DB id this relates to.
            failing_rules:   List of rule_code strings with status=FAIL.
            rule_names:      Optional mapping of rule_code → human name.
            is_repeat_offense: Whether the entity is a repeat offender.

        Returns:
            PenaltyCalculationResult with full breakdown.
        """
        rule_names = rule_names or {}
        violations: list[ViolationPenalty] = []
        total_min = 0.0
        total_max = 0.0

        for code in failing_rules:
            entry = rules_config.get_penalty_entry(code)
            if entry is None:
                # Fallback to generic violation
                entry = rules_config.get_penalty_entry(self._GENERIC_CODE) or {}
                logger.warning("No penalty matrix entry for rule_code=%s — using generic", code)

            if is_repeat_offense:
                fine_min = float(entry.get("repeat_offense_min", 5000))
                fine_max = float(entry.get("repeat_offense_max", 25000))
            else:
                fine_min = float(entry.get("first_offense_min", 500))
                fine_max = float(entry.get("first_offense_max", 5000))

            vp = ViolationPenalty(
                rule_code=code,
                rule_name=rule_names.get(code, code),
                act_section=entry.get("act_section", "Section 36 — Legal Metrology Act 2009"),
                description=entry.get("description", "Compliance violation"),
                is_repeat_offense=is_repeat_offense,
                fine_min=fine_min,
                fine_max=fine_max,
                imprisonment_months=int(entry.get("imprisonment_months", 0)),
                notes=entry.get("notes", None),
            )
            violations.append(vp)
            total_min += fine_min
            total_max += fine_max

        result = PenaltyCalculationResult(
            analysis_id=analysis_id,
            is_repeat_offense=is_repeat_offense,
            violation_count=len(violations),
            violations=violations,
            total_fine_min=total_min,
            total_fine_max=total_max,
        )
        result.summary_text = self._build_summary_text(result)
        logger.info(
            "Penalty calc for analysis_id=%d: %d violations, INR %.0f–%.0f",
            analysis_id, len(violations), total_min, total_max,
        )
        return result

    def calculate_from_findings(
        self,
        analysis_id: int,
        findings: list[Any],  # ComplianceFinding ORM objects
        is_repeat_offense: bool = False,
    ) -> PenaltyCalculationResult:
        """Convenience wrapper that accepts ComplianceFinding ORM objects."""
        failing = [f for f in findings if f.status.value == "FAIL"]
        failing_codes = [f.rule_code for f in failing]
        rule_names = {f.rule_code: f.rule_name for f in failing}
        return self.calculate(
            analysis_id=analysis_id,
            failing_rules=failing_codes,
            rule_names=rule_names,
            is_repeat_offense=is_repeat_offense,
        )

    def to_db_breakdown(self, result: PenaltyCalculationResult) -> list[dict]:
        """Serialize violation list to JSON-serialisable dicts for DB storage."""
        return [
            {
                "rule_code": v.rule_code,
                "rule_name": v.rule_name,
                "act_section": v.act_section,
                "description": v.description,
                "fine_min": v.fine_min,
                "fine_max": v.fine_max,
                "imprisonment_months": v.imprisonment_months,
                "is_repeat_offense": v.is_repeat_offense,
            }
            for v in result.violations
        ]

    @staticmethod
    def _build_summary_text(result: PenaltyCalculationResult) -> str:
        if result.violation_count == 0:
            return "No violations found. No penalty applicable."
        offense_type = "repeat" if result.is_repeat_offense else "first"
        return (
            f"{result.violation_count} violation(s) found "
            f"({'repeat offense' if result.is_repeat_offense else 'first offense'}). "
            f"Estimated penalty: ₹{result.total_fine_min:,.0f} – ₹{result.total_fine_max:,.0f}. "
            f"Under {result.applicable_act}."
        )


penalty_service = PenaltyService()
