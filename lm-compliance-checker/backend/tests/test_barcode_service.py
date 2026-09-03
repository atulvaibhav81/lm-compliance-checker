"""tests/test_barcode_service.py — Unit tests for BarcodeService.
Note: pyzbar 1D barcode tests are skipped if the native libzbar DLL is not installed.
QR code detection via OpenCV does not require any native libraries.
"""
from __future__ import annotations

import pytest

# ── Check for native zbar availability ───────────────────────────────────────
try:
    from pyzbar import pyzbar as _pyzbar_mod
    _ZBAR_AVAILABLE = True
except (ImportError, OSError, FileNotFoundError):
    _ZBAR_AVAILABLE = False

from services.barcode_service import BarcodeService


@pytest.fixture
def svc():
    return BarcodeService()


# ── EAN-13 checksum validation ────────────────────────────────────────────────

def test_valid_ean13(svc):
    assert svc._validate_ean13("5901234123457") is True


def test_invalid_ean13_bad_check_digit(svc):
    assert svc._validate_ean13("5901234123458") is False


def test_ean13_wrong_length(svc):
    assert svc._validate_ean13("590123412345") is False
    assert svc._validate_ean13("59012341234578") is False


def test_ean13_non_numeric(svc):
    assert svc._validate_ean13("590123412345X") is False


# ── EAN-8 checksum validation ─────────────────────────────────────────────────

def test_valid_ean8(svc):
    assert svc._validate_ean8("96385074") is True


def test_invalid_ean8(svc):
    assert svc._validate_ean8("96385075") is False


# ── Symbology normalisation ───────────────────────────────────────────────────

def test_normalise_ean13(svc):
    assert svc._normalise_symbology("EAN13") == "EAN-13"


def test_normalise_qrcode(svc):
    assert svc._normalise_symbology("QRCODE") == "QR Code"


def test_normalise_code128(svc):
    assert svc._normalise_symbology("CODE128") == "CODE-128"


def test_normalise_unknown_passthrough(svc):
    assert svc._normalise_symbology("AZTEC") == "AZTEC"


# ── Cross-reference ───────────────────────────────────────────────────────────

def test_cross_reference_match(svc):
    from services.barcode_service import DecodedCode
    codes = [DecodedCode("EAN-13", "5901234123457", "", None, 0.9)]
    status, msg = svc._cross_reference(codes, "Product code: 5901234123457 — MRP Rs.99")
    assert status == "MATCH"


def test_cross_reference_unverified_no_ocr(svc):
    from services.barcode_service import DecodedCode
    codes = [DecodedCode("EAN-13", "5901234123457", "", None, 0.9)]
    status, msg = svc._cross_reference(codes, None)
    assert status == "UNVERIFIED"


def test_cross_reference_no_codes(svc):
    status, msg = svc._cross_reference([], "MRP Rs. 99 Net Qty 200g")
    assert status == "UNVERIFIED"


# ── Image validation — graceful degradation ───────────────────────────────────

def test_validate_nonexistent_image_returns_skip(svc):
    """Should return SKIP when image cannot be loaded."""
    result = svc.validate_image("/nonexistent/path/to/image.jpg")
    assert result.overall_status == "SKIP"
    assert "Could not load" in result.message
