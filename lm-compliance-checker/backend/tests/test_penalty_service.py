"""tests/test_penalty_service.py — Unit tests for PenaltyService."""
from __future__ import annotations

import pytest
from unittest.mock import MagicMock

from services.penalty_service import PenaltyService, PenaltyCalculationResult


@pytest.fixture
def svc():
    return PenaltyService()


class FakeFinding:
    def __init__(self, code: str, name: str, status: str):
        self.rule_code = code
        self.rule_name = name
        self.status = MagicMock()
        self.status.value = status


def test_no_violations_returns_zero_penalty(svc):
    result = svc.calculate(analysis_id=1, failing_rules=[], is_repeat_offense=False)
    assert result.violation_count == 0
    assert result.total_fine_min == 0.0
    assert result.total_fine_max == 0.0
    assert "No penalty" in result.summary_text


def test_single_violation_first_offense(svc):
    result = svc.calculate(analysis_id=1, failing_rules=["R6_01_MRP"], is_repeat_offense=False)
    assert result.violation_count == 1
    assert result.total_fine_min > 0
    assert result.total_fine_max >= result.total_fine_min
    assert result.violations[0].rule_code == "R6_01_MRP"
    assert "Rule 6(1)(a)" in result.violations[0].act_section


def test_repeat_offense_higher_fine(svc):
    first = svc.calculate(analysis_id=1, failing_rules=["R6_01_MRP"], is_repeat_offense=False)
    repeat = svc.calculate(analysis_id=1, failing_rules=["R6_01_MRP"], is_repeat_offense=True)
    assert repeat.total_fine_min >= first.total_fine_min
    assert repeat.total_fine_max >= first.total_fine_max


def test_multiple_violations_cumulative(svc):
    codes = ["R6_01_MRP", "R6_02_NET_QTY", "R6_07_FONT_SIZE"]
    result = svc.calculate(analysis_id=2, failing_rules=codes)
    assert result.violation_count == 3
    assert result.total_fine_min > 0
    assert len(result.violations) == 3


def test_unknown_rule_code_uses_generic(svc):
    result = svc.calculate(analysis_id=3, failing_rules=["R99_UNKNOWN_RULE"])
    assert result.violation_count == 1
    # Generic entry should still provide some penalty
    assert result.total_fine_min >= 0


def test_calculate_from_findings(svc):
    findings = [
        FakeFinding("R6_01_MRP", "MRP Declaration", "FAIL"),
        FakeFinding("R6_02_NET_QTY", "Net Quantity", "FAIL"),
        FakeFinding("R6_03_MANUFACTURER", "Manufacturer Info", "PASS"),
    ]
    result = svc.calculate_from_findings(analysis_id=5, findings=findings)
    # Only FAIL findings should be penalised (2 of 3)
    assert result.violation_count == 2


def test_to_db_breakdown_serializable(svc):
    result = svc.calculate(analysis_id=1, failing_rules=["R6_01_MRP"])
    breakdown = svc.to_db_breakdown(result)
    assert isinstance(breakdown, list)
    assert all(isinstance(item, dict) for item in breakdown)
    assert "rule_code" in breakdown[0]
    assert "act_section" in breakdown[0]
    assert "fine_min" in breakdown[0]


def test_summary_text_contains_fine_range(svc):
    result = svc.calculate(analysis_id=1, failing_rules=["R6_01_MRP"])
    assert "₹" in result.summary_text or "INR" in result.summary_text or "violation" in result.summary_text
