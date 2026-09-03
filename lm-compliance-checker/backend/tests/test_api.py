"""
tests/test_api.py — Integration tests for FastAPI endpoints.

Uses the session-scoped `client` fixture from conftest.py.
Pipeline tests mock image_processor and ocr_service at the module level
so no OpenCV or Tesseract installation is required.
"""
from __future__ import annotations

from unittest.mock import patch, MagicMock

import pytest

# ---------------------------------------------------------------------------
# Minimal valid image bytes (no Pillow needed)
# ---------------------------------------------------------------------------
_PNG = (
    b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01'
    b'\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00'
    b'\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
)

_FAKE_OCR_TEXT = (
    "Tasty Biscuits Premium\n"
    "Net Weight: 200 g\n"
    "MRP Rs. 30 (Inclusive of all taxes)\n"
    "Manufactured by: ABC Foods Pvt. Ltd.\n"
    "123, Industrial Area, Phase 2, Delhi - 110001\n"
    "Mfg. Date: 03/2024  Best Before: 03/2025\n"
    "Customer Care: 1800-123-4567"
)


# ---------------------------------------------------------------------------
# Health / Root
# ---------------------------------------------------------------------------

def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_root(client):
    resp = client.get("/")
    assert resp.status_code == 200
    body = resp.json()
    assert "service" in body
    assert "status" in body


# ---------------------------------------------------------------------------
# POST /api/upload
# ---------------------------------------------------------------------------

def test_upload_invalid_type(client):
    """Non-image file → HTTP 415."""
    resp = client.post(
        "/api/upload",
        files={"file": ("test.pdf", b"%PDF-1.4", "application/pdf")},
    )
    assert resp.status_code == 415


def test_upload_valid_png(client):
    """Minimal PNG upload → 201 with upload_id and status=pending."""
    resp = client.post(
        "/api/upload",
        files={"file": ("label.png", _PNG, "image/png")},
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert "upload_id" in data
    assert isinstance(data["upload_id"], int)
    assert data["status"] == "pending"
    assert "message" in data


def test_upload_valid_jpeg(client):
    """JPEG content-type is accepted."""
    resp = client.post(
        "/api/upload",
        files={"file": ("photo.jpg", _PNG, "image/jpeg")},
    )
    assert resp.status_code == 201, resp.text


def test_upload_valid_webp(client):
    """WebP content-type is accepted."""
    resp = client.post(
        "/api/upload",
        files={"file": ("photo.webp", _PNG, "image/webp")},
    )
    assert resp.status_code == 201, resp.text


def test_upload_returns_unique_ids(client):
    """Each upload gets a distinct upload_id."""
    ids = set()
    for _ in range(3):
        resp = client.post(
            "/api/upload",
            files={"file": ("label.png", _PNG, "image/png")},
        )
        assert resp.status_code == 201
        ids.add(resp.json()["upload_id"])
    assert len(ids) == 3


# ---------------------------------------------------------------------------
# GET /api/reports
# ---------------------------------------------------------------------------

def test_reports_returns_list(client):
    resp = client.get("/api/reports")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_reports_pagination_skip_limit(client):
    resp = client.get("/api/reports?skip=0&limit=5")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_reports_invalid_limit(client):
    """limit > 100 should be rejected."""
    resp = client.get("/api/reports?limit=200")
    assert resp.status_code == 422  # Pydantic validation error


def test_report_not_found(client):
    resp = client.get("/api/reports/999999")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /api/analyze/{upload_id}
# ---------------------------------------------------------------------------

def test_analyze_not_found(client):
    """Non-existent upload_id → 404."""
    resp = client.post("/api/analyze/999999")
    assert resp.status_code == 404


def _mock_pipeline(fake_preprocessed_path):
    """Context manager that patches image_processor + ocr_service."""
    from services.ocr_service import OcrResult
    from services.image_processor import PreprocessResult
    return (
        patch(
            "services.image_processor.image_processor.preprocess",
            return_value=PreprocessResult(
                output_path=fake_preprocessed_path,
                confidence=95.0,
                pipeline_stages=[],
                debug_dir=None,
                stage_paths={},
                metrics={},
            ),
        ),
        patch(
            "services.ocr_service.ocr_service.extract",
            return_value=OcrResult(
                text=_FAKE_OCR_TEXT,
                confidence=88.5,
                word_count=38,
            ),
        ),
    )


def test_analyze_full_pipeline(client, tmp_path):
    """
    End-to-end: upload → analyze.
    Image processing and OCR are mocked; rule engine runs for real.
    """
    fake_img = tmp_path / "pre_label.png"
    fake_img.write_bytes(_PNG)

    patch_preprocess, patch_ocr = _mock_pipeline(fake_img)

    with patch_preprocess, patch_ocr:
        # 1. Upload
        up = client.post(
            "/api/upload",
            files={"file": ("label.png", _PNG, "image/png")},
        )
        assert up.status_code == 201, up.text
        upload_id = up.json()["upload_id"]

        # 2. Analyze
        resp = client.post(f"/api/analyze/{upload_id}")
        assert resp.status_code == 200, resp.text
        data = resp.json()

    # Top-level structure
    assert "analysis_id" in data
    assert data["upload_id"] == upload_id
    assert isinstance(data["ocr_text"], str)
    assert isinstance(data["ocr_confidence"], float)
    assert 0.0 <= data["ocr_confidence"] <= 100.0

    # Findings — all 7 rules should run
    findings = data["findings"]
    assert len(findings) == 7

    rule_codes = {f["rule_code"] for f in findings}
    assert rule_codes == {"R6-A", "R6-B", "R6-C", "R6-D", "R6-E", "R6-F", "R18"}

    for f in findings:
        assert f["status"] in ("PASS", "FAIL", "WARN", "SKIP")
        assert isinstance(f["message"], str)
        assert len(f["message"]) > 0

    # Summary
    summary = data["summary"]
    assert summary["total_rules"] == 7
    assert 0.0 <= summary["compliance_score"] <= 100.0
    assert summary["PASS"] + summary["FAIL"] + summary["WARN"] + summary["SKIP"] == 7

    # With our FAKE_OCR_TEXT most rules should PASS
    assert summary["PASS"] >= 4

    # 3. Report should now be retrievable
    report = client.get(f"/api/reports/{data['analysis_id']}")
    assert report.status_code == 200
    rdata = report.json()
    assert rdata["analysis_id"] == data["analysis_id"]
    assert len(rdata["findings"]) == 6
    assert "ocr_text" in rdata


def test_analyze_duplicate_returns_409(client, tmp_path):
    """
    Analyzing an upload already in PROCESSING state → 409.
    """
    from db.models.upload import Upload, UploadStatus
    from api.deps import get_db
    from main import app

    fake_img = tmp_path / "dup.png"
    fake_img.write_bytes(_PNG)

    patch_preprocess, patch_ocr = _mock_pipeline(fake_img)

    with patch_preprocess, patch_ocr:
        # Upload
        up = client.post(
            "/api/upload",
            files={"file": ("dup.png", _PNG, "image/png")},
        )
        assert up.status_code == 201
        upload_id = up.json()["upload_id"]

    # Manually set status to PROCESSING via the override DB
    db_gen = app.dependency_overrides[get_db]()
    db = next(db_gen)
    try:
        row = db.query(Upload).filter(Upload.id == upload_id).first()
        row.status = UploadStatus.PROCESSING
        db.commit()
    finally:
        try:
            next(db_gen)
        except StopIteration:
            pass

    # Should now return 409
    resp = client.post(f"/api/analyze/{upload_id}")
    assert resp.status_code == 409


def test_analyze_ocr_text_stored_in_report(client, tmp_path):
    """OCR text returned by analyze must match what's stored in the report."""
    fake_img = tmp_path / "label2.png"
    fake_img.write_bytes(_PNG)

    patch_preprocess, patch_ocr = _mock_pipeline(fake_img)

    with patch_preprocess, patch_ocr:
        up = client.post(
            "/api/upload",
            files={"file": ("label2.png", _PNG, "image/png")},
        )
        assert up.status_code == 201
        upload_id = up.json()["upload_id"]

        analyze_resp = client.post(f"/api/analyze/{upload_id}")
        assert analyze_resp.status_code == 200
        analysis_id = analyze_resp.json()["analysis_id"]

    report_resp = client.get(f"/api/reports/{analysis_id}")
    assert report_resp.status_code == 200
    assert report_resp.json()["ocr_text"] == _FAKE_OCR_TEXT.strip()


def test_reports_list_contains_new_analysis(client, tmp_path):
    """A completed analysis appears in the paginated reports list."""
    fake_img = tmp_path / "list_label.png"
    fake_img.write_bytes(_PNG)

    patch_preprocess, patch_ocr = _mock_pipeline(fake_img)

    with patch_preprocess, patch_ocr:
        up = client.post(
            "/api/upload",
            files={"file": ("list_label.png", _PNG, "image/png")},
        )
        assert up.status_code == 201
        upload_id = up.json()["upload_id"]

        ar = client.post(f"/api/analyze/{upload_id}")
        assert ar.status_code == 200
        analysis_id = ar.json()["analysis_id"]

    reports = client.get("/api/reports?limit=100").json()
    ids = [r["analysis_id"] for r in reports]
    assert analysis_id in ids
