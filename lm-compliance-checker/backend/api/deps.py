"""api/deps.py — Shared FastAPI dependencies."""
from __future__ import annotations

from typing import Generator

from sqlalchemy.orm import Session

from db.session import SessionLocal


def get_db() -> Generator[Session, None, None]:
    """Yield a SQLAlchemy session; close it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
