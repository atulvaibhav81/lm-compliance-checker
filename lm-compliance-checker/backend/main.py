"""
main.py — FastAPI application entry point.
Legal Metrology (Packaged Commodities) Rules 2011 — Compliance Checker
Enterprise Edition v2.0
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from api.routes import upload, analyze, reports, penalties, usp, batch, export, dashboard
from core.config import settings
from core.logging import setup_logging
from db.session import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown hooks."""
    setup_logging(debug=settings.DEBUG)
    init_db()
    # Ensure upload dirs exist
    settings.upload_path.mkdir(parents=True, exist_ok=True)
    (settings.upload_path / "preprocessed").mkdir(parents=True, exist_ok=True)
    (settings.upload_path / "debug").mkdir(parents=True, exist_ok=True)
    yield
    # Nothing to tear down for SQLite


app = FastAPI(
    title="LM Compliance Checker API",
    description=(
        "Enterprise-grade compliance checker for packaged commodity labels. "
        "Checks compliance with Legal Metrology (Packaged Commodities) Rules, 2011. "
        "Features: OCR analysis, penalty calculator, USP validator, font size verifier, "
        "barcode/QR validator, bulk batch scan, and PDF/CSV export."
    ),
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ───────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Existing Routers ──────────────────────────────────────────────────────────
app.include_router(upload.router, prefix="/api")
app.include_router(analyze.router, prefix="/api")
app.include_router(reports.router, prefix="/api")

# ── New Enterprise Routers ────────────────────────────────────────────────────
app.include_router(penalties.router, prefix="/api")
app.include_router(usp.router, prefix="/api")
app.include_router(batch.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")


@app.get("/", tags=["health"])
def root():
    return {
        "service": settings.APP_NAME,
        "version": "2.0.0",
        "status": "running",
        "docs": "/docs",
        "modules": [
            "upload", "analyze", "reports",
            "penalties", "usp", "batch", "export", "dashboard"
        ],
    }


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}
