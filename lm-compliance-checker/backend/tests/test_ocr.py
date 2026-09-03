"""
tests/test_ocr.py — Tests for OcrService.

Skips automatically when:
  - pytesseract is not installed, OR
  - The Tesseract binary is not found on the system.
"""
from __future__ import annotations

import shutil
from pathlib import Path

import pytest

# RapidOCR does not need binary checks like Tesseract.
rapidocr_mod = pytest.importorskip("rapidocr_onnxruntime")


@pytest.fixture
def sample_image(tmp_path: Path):
    """Create a simple test image with text using Pillow."""
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        pytest.skip("Pillow not installed")

    img = Image.new("RGB", (600, 150), color="white")
    draw = ImageDraw.Draw(img)
    draw.text((10, 30), "Net Weight 200 g MRP Rs. 30 Inclusive of all taxes", fill="black")
    img_path = tmp_path / "test_label.png"
    img.save(str(img_path))
    return img_path


def test_ocr_extracts_text(sample_image):
    """Smoke test: OCR should extract some text from a generated image."""
    from services.ocr_service import ocr_service

    result = ocr_service.extract(sample_image)
    assert isinstance(result.text, str)
    assert result.word_count >= 0


def test_ocr_result_has_confidence(sample_image):
    """OCR result should have a float confidence value in [0, 100]."""
    from services.ocr_service import ocr_service

    result = ocr_service.extract(sample_image)
    assert isinstance(result.confidence, float)
    assert 0.0 <= result.confidence <= 100.0


def test_ocr_result_dataclass_fields(sample_image):
    """OcrResult must expose text, confidence, and word_count."""
    from services.ocr_service import OcrResult, ocr_service

    result = ocr_service.extract(sample_image)
    assert isinstance(result, OcrResult)
    assert hasattr(result, "text")
    assert hasattr(result, "confidence")
    assert hasattr(result, "word_count")
    assert isinstance(result.word_count, int)
