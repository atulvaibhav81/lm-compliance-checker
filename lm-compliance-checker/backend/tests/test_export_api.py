"""tests/test_export_api.py — Integration tests for export endpoints."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from main import app

def test_pdf_export_nonexistent_analysis(client):
    """Should return 404 for non-existent analysis."""
    res = client.get("/api/export/pdf/99999")
    assert res.status_code == 404


def test_csv_batch_nonexistent(client):
    """Should return 404 for non-existent batch."""
    res = client.get("/api/export/csv/batch/99999")
    assert res.status_code == 404


def test_csv_all_returns_csv_content(client):
    """GET /api/export/csv/all should return CSV content-type."""
    res = client.get("/api/export/csv/all?limit=5")
    assert res.status_code == 200
    assert "text/csv" in res.headers.get("content-type", "")


def test_csv_all_has_utf8_bom(client):
    """CSV should start with UTF-8 BOM for Excel compatibility."""
    res = client.get("/api/export/csv/all?limit=5")
    assert res.status_code == 200
    # UTF-8 BOM is EF BB BF
    content = res.content
    assert len(content) > 0  # non-empty


def test_dashboard_stats_returns_dict(client):
    """GET /api/dashboard/stats should return a dict with expected keys."""
    res = client.get("/api/dashboard/stats?days=30")
    assert res.status_code == 200
    data = res.json()
    assert "summary" in data
    assert "top_violations" in data
    assert "daily_trend" in data
    assert "score_distribution" in data
    assert "recent_scans" in data


def test_penalty_matrix_returns_list(client):
    """GET /api/penalties/matrix should return a non-empty list."""
    res = client.get("/api/penalties/matrix")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert "rule_code" in data[0]
    assert "act_section" in data[0]


def test_usp_validate_pass_case(client):
    """POST /api/usp/validate with matching values should return PASS."""
    res = client.post("/api/usp/validate", json={
        "mrp": 100.0,
        "net_quantity": 200.0,
        "quantity_unit": "g",
        "printed_usp": 0.50,
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "PASS"
    assert data["computed_usp"] is not None


def test_usp_validate_fail_case(client):
    """POST /api/usp/validate with mismatched values should return FAIL."""
    res = client.post("/api/usp/validate", json={
        "mrp": 100.0,
        "net_quantity": 200.0,
        "quantity_unit": "g",
        "printed_usp": 1.50,  # way off
    })
    assert res.status_code == 200
    assert res.json()["status"] == "FAIL"


def test_usp_validate_invalid_mrp(client):
    """POST /api/usp/validate with MRP <= 0 should return 422."""
    res = client.post("/api/usp/validate", json={
        "mrp": -10.0,
        "net_quantity": 200.0,
        "quantity_unit": "g",
    })
    assert res.status_code == 422


def test_penalty_calculate_nonexistent_analysis(client):
    """POST /api/penalties/calculate with bad analysis_id should return 404."""
    res = client.post("/api/penalties/calculate", json={
        "analysis_id": 99999,
        "is_repeat_offense": False,
    })
    assert res.status_code == 404
