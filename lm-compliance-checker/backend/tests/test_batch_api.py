"""tests/test_batch_api.py — Integration tests for batch scan API."""
from __future__ import annotations

import io
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from main import app

client = TestClient(app)


def make_image_bytes():
    """Create minimal 1×1 white PNG bytes."""
    import struct, zlib
    def chunk(name, data):
        c = name + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr_data = struct.pack('>IIBBBBB', 1, 1, 8, 2, 0, 0, 0)
    idat_data = zlib.compress(b'\x00\xff\xff\xff')
    return sig + chunk(b'IHDR', ihdr_data) + chunk(b'IDAT', idat_data) + chunk(b'IEND', b'')


def test_batch_upload_no_files():
    """Should return 422 when no files provided."""
    res = client.post("/api/batch/upload")
    assert res.status_code == 422


def test_batch_upload_too_many_files():
    """Should return 422 when more than 20 files are provided."""
    img = make_image_bytes()
    files = [("files", (f"img_{i}.png", io.BytesIO(img), "image/png")) for i in range(21)]
    res = client.post("/api/batch/upload", files=files)
    assert res.status_code == 422
    assert "20" in res.text


def test_batch_list_returns_list():
    """GET /api/batch should return a list."""
    res = client.get("/api/batch")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_batch_get_nonexistent():
    """GET /api/batch/99999 should return 404."""
    res = client.get("/api/batch/99999")
    assert res.status_code == 404


def test_batch_process_nonexistent():
    """POST /api/batch/99999/process should return 404."""
    res = client.post("/api/batch/99999/process")
    assert res.status_code == 404
