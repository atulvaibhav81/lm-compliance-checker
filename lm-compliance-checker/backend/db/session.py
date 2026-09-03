"""db/session.py — SQLAlchemy engine and session factory (SQLite, async-compatible)."""
from __future__ import annotations

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from core.config import settings

# SQLite: enable WAL mode and foreign keys
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=settings.DEBUG,
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragmas(dbapi_conn, _conn_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""
    pass


def init_db() -> None:
    """Create all tables on startup (idempotent)."""
    # Import all models so they are registered on Base.metadata
    from db.models import upload, analysis, compliance  # noqa: F401
    Base.metadata.create_all(bind=engine)
