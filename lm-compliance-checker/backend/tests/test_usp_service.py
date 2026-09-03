"""tests/test_usp_service.py — Unit tests for USPService."""
from __future__ import annotations

import pytest
from services.usp_service import USPService, USPStatus


@pytest.fixture
def svc():
    return USPService()


# ── Direct validation ────────────────────────────────────────────────────────

def test_pass_when_usp_matches(svc):
    # MRP=100, qty=200g → USP=0.5 ₹/g; printed=0.50 → PASS
    r = svc.validate(mrp=100.0, net_quantity=200.0, quantity_unit="g", printed_usp=0.50)
    assert r.status == USPStatus.PASS
    assert abs(r.computed_usp - 0.5) < 0.001


def test_fail_when_usp_too_different(svc):
    # MRP=100, qty=200g → USP=0.5; printed=0.60 → diff=20% >> 2% tolerance → FAIL
    r = svc.validate(mrp=100.0, net_quantity=200.0, quantity_unit="g", printed_usp=0.60)
    assert r.status == USPStatus.FAIL
    assert r.difference_pct is not None
    assert r.difference_pct > 2.0


def test_warn_when_no_printed_usp(svc):
    r = svc.validate(mrp=100.0, net_quantity=200.0, quantity_unit="g", printed_usp=None)
    assert r.status == USPStatus.WARN
    assert r.computed_usp is not None


def test_kg_conversion(svc):
    # 0.5 kg = 500 g → USP should be per gram
    r = svc.validate(mrp=50.0, net_quantity=0.5, quantity_unit="kg", printed_usp=None)
    assert r.quantity_base_unit == "g"
    assert abs(r.computed_usp - 0.1) < 0.001  # 50 / 500g = 0.1


def test_litre_conversion(svc):
    r = svc.validate(mrp=40.0, net_quantity=1.0, quantity_unit="l", printed_usp=None)
    assert r.quantity_base_unit == "ml"
    assert abs(r.computed_usp - 0.04) < 0.0001  # 40/1000ml


def test_unknown_unit_returns_warn(svc):
    r = svc.validate(mrp=100.0, net_quantity=5.0, quantity_unit="furlong")
    assert r.status == USPStatus.WARN


def test_zero_quantity_returns_fail(svc):
    r = svc.validate(mrp=100.0, net_quantity=0.0, quantity_unit="g")
    assert r.status == USPStatus.FAIL


# ── Tolerance boundary ────────────────────────────────────────────────────────

def test_within_tolerance_passes(svc):
    # Computed = 0.50, printed = 0.509 → diff ≈ 1.8% < 2% → PASS
    r = svc.validate(mrp=100.0, net_quantity=200.0, quantity_unit="g", printed_usp=0.509)
    assert r.status == USPStatus.PASS


def test_at_tolerance_boundary_passes(svc):
    # 2% of 0.50 = 0.01; printed = 0.51 exactly on boundary
    r = svc.validate(mrp=100.0, net_quantity=200.0, quantity_unit="g", printed_usp=0.51)
    assert r.status == USPStatus.PASS


# ── OCR extraction ────────────────────────────────────────────────────────────

def test_extract_mrp_from_text(svc):
    text = "MRP: Rs. 85.00 per pack\nNet Weight: 150g\nManufactured by XYZ"
    mrp = svc._extract_mrp(text)
    assert mrp == 85.0


def test_extract_net_qty_from_text(svc):
    text = "Net Content: 250ml"
    qty, unit = svc._extract_net_qty(text)
    assert qty == 250.0
    assert unit == "ml"


def test_extract_and_validate_skip_when_no_mrp(svc):
    text = "Just some random text with no useful data"
    r = svc.extract_and_validate(text)
    assert r.status == USPStatus.SKIP
