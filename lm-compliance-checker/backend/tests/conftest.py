"""
tests/conftest.py — Shared pytest fixtures.

Key design:
  - In-memory SQLite uses a SINGLE shared connection so all operations see
    the same in-flight data (in-memory DBs are per-connection in SQLite).
  - FastAPI dependency override routes every request through that same connection.
  - Each test rolls back after it runs, keeping isolation without re-creating tables.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

# ── Make backend/ the import root ────────────────────────────────────────────
BACKEND_DIR = Path(__file__).parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# ── Override settings *before* any app import ─────────────────────────────────
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["UPLOAD_DIR"] = str(Path(__file__).parent / "_uploads_test")
os.environ["DEBUG"] = "false"
os.environ["TESSERACT_CMD"] = "tesseract"  # placeholder; OCR tests skip anyway


# ── Shared in-memory engine (single connection) ───────────────────────────────

@pytest.fixture(scope="session")
def engine():
    """
    One in-memory SQLite engine for the whole test session.

    Uses a single underlying connection (StaticPool) so that every
    session/transaction sees the same data — critical for in-memory SQLite.
    """
    from sqlalchemy.pool import StaticPool
    from db.session import Base
    # Import models to register them on Base.metadata
    import db.models.upload     # noqa: F401
    import db.models.analysis   # noqa: F401
    import db.models.compliance # noqa: F401

    eng = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # Enable foreign keys for SQLite
    @event.listens_for(eng, "connect")
    def set_pragmas(dbapi_conn, _):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()

    Base.metadata.create_all(bind=eng)
    yield eng
    eng.dispose()


@pytest.fixture(scope="session")
def TestingSessionLocal(engine):
    return sessionmaker(bind=engine, autocommit=False, autoflush=False)


@pytest.fixture()
def db_session(TestingSessionLocal):
    """Per-test DB session; rolls back after each test."""
    session = TestingSessionLocal()
    yield session
    session.rollback()
    session.close()


# ── FastAPI TestClient ────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def client(TestingSessionLocal):
    """
    session-scoped TestClient with DB dependency override.
    Tables persist for the session; individual tests clean up with rollback
    via the db_session fixture (or the test's own logic).
    """
    from fastapi.testclient import TestClient
    from main import app
    from api.deps import get_db

    def override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app, raise_server_exceptions=True) as c:
        yield c

    app.dependency_overrides.clear()


# ── Image helpers ─────────────────────────────────────────────────────────────

@pytest.fixture()
def minimal_png() -> bytes:
    """Minimal valid 1×1 white PNG."""
    return (
        b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01'
        b'\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00'
        b'\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
    )


@pytest.fixture()
def label_png(tmp_path: Path) -> Path:
    """400×250 label PNG with realistic text (requires Pillow)."""
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        pytest.skip("Pillow not installed")

    text = (
        "Tasty Biscuits Premium\n"
        "Net Weight: 200 g\n"
        "MRP Rs. 30 (Inclusive of all taxes)\n"
        "Manufactured by: ABC Foods Pvt. Ltd.\n"
        "123, Industrial Area, Phase 2, Delhi - 110001\n"
        "Mfg. Date: 03/2024  Best Before: 03/2025\n"
        "Customer Care: 1800-123-4567"
    )
    img = Image.new("RGB", (600, 250), color="white")
    ImageDraw.Draw(img).text((10, 10), text, fill="black")
    path = tmp_path / "label.png"
    img.save(str(path))
    return path
