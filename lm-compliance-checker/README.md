# LM Compliance Checker — Enterprise Edition v2.0

> **Legal Metrology (Packaged Commodities) Rules, 2011** — Automated compliance platform for packaged commodity label verification.

---

## Features

### Core Modules (v1.0)
- **Image Upload** — JPEG, PNG, WebP, BMP, TIFF support (up to 10 MB)
- **OpenCV Preprocessing** — 10-stage pipeline (orient, CLAHE, denoise, sharpen, deskew, threshold)
- **RapidOCR** — Text extraction with confidence scoring
- **Rule Engine** — Configurable checks for MRP, Net Quantity, Manufacturer, Date, Consumer Care, Country of Origin

### Enterprise Modules (v2.0)
| Module | Endpoint | Description |
|---|---|---|
| **Penalty Calculator** | `POST /api/penalties/calculate` | Maps violations to LM Act 2009 sections + fine ranges |
| **Audit PDF Export** | `GET /api/export/pdf/{id}` | Professional branded PDF reports via ReportLab |
| **USP Validator** | `POST /api/usp/validate` | Unit Sale Price validation per Rule 18 |
| **Font Verifier** | Integrated in analyze pipeline | Minimum 1mm character height per Rule 8 |
| **Barcode/QR Validator** | `POST /api/batch/…` | pyzbar + OpenCV QR, EAN-13 checksum |
| **Bulk Batch Scan** | `POST /api/batch/upload` | 1–20 images in one job |
| **CSV Export** | `GET /api/export/csv/…` | Per-batch + all-analyses CSV |
| **Dashboard** | `GET /api/dashboard/stats` | KPIs, trend charts, top violations |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Tailwind CSS (Vite) |
| Backend | FastAPI + Uvicorn |
| Database | SQLite (dev) / PostgreSQL (prod) via SQLAlchemy + Alembic |
| OCR | RapidOCR (ONNX runtime) |
| Image Processing | OpenCV 4.9 |
| PDF Generation | ReportLab 4 |
| Barcode/QR | pyzbar (libzbar) + OpenCV QRCodeDetector |
| Charts | Recharts |
| Routing | React Router DOM v6 |

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- (Optional) libzbar DLL for 1D barcode decoding on Windows

### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start backend server
uvicorn main:app --reload --port 8000
```

The API docs are at: **http://localhost:8000/docs**

### Frontend

```bash
cd frontend

# Install Node dependencies
npm install

# Start dev server
npm run dev
```

Open: **http://localhost:5173**

---

## Project Structure

```
lm-compliance-checker/
├── backend/
│   ├── main.py                      # FastAPI app entry point
│   ├── requirements.txt
│   ├── alembic/                     # Database migrations
│   │   └── versions/
│   │       ├── 409e1cfed49e_…       # v1 migration
│   │       └── b7f3e9d2c1a8_…       # v2 enterprise modules
│   ├── api/routes/
│   │   ├── upload.py                # File upload
│   │   ├── analyze.py               # Single image analysis
│   │   ├── reports.py               # Report listing
│   │   ├── penalties.py             # [NEW] Penalty calculator
│   │   ├── usp.py                   # [NEW] USP validator
│   │   ├── batch.py                 # [NEW] Bulk batch scan
│   │   ├── export.py                # [NEW] PDF/CSV export
│   │   └── dashboard.py             # [NEW] Dashboard stats
│   ├── services/
│   │   ├── compliance_service.py    # Main analysis pipeline
│   │   ├── image_processor.py       # OpenCV preprocessing
│   │   ├── ocr_service.py           # RapidOCR wrapper
│   │   ├── penalty_service.py       # [NEW] Penalty calculation
│   │   ├── usp_service.py           # [NEW] USP validation
│   │   ├── font_verifier.py         # [NEW] Font size verification
│   │   ├── barcode_service.py       # [NEW] Barcode/QR validation
│   │   ├── batch_service.py         # [NEW] Batch orchestration
│   │   ├── pdf_report_service.py    # [NEW] PDF generation
│   │   └── audit_log_service.py     # [NEW] Audit logging
│   ├── db/models/
│   │   ├── upload.py                # Upload table
│   │   ├── analysis.py              # Analysis table
│   │   ├── compliance.py            # Findings table
│   │   ├── penalty.py               # [NEW] Penalty records
│   │   ├── batch_job.py             # [NEW] Batch jobs + items
│   │   ├── audit_log.py             # [NEW] Audit log
│   │   └── barcode_result.py        # [NEW] Barcode results
│   ├── rule_engine/
│   │   ├── engine.py                # Rule runner
│   │   ├── rules/                   # Individual rule modules
│   │   ├── config_loader.py         # [NEW] YAML config loader
│   │   └── rules_config.yaml        # [NEW] Configurable thresholds
│   └── tests/
│       ├── test_penalty_service.py  # [NEW]
│       ├── test_usp_service.py      # [NEW]
│       ├── test_barcode_service.py  # [NEW]
│       ├── test_batch_api.py        # [NEW]
│       └── test_export_api.py       # [NEW]
│
└── frontend/
    └── src/
        ├── App.tsx                  # Router + Sidebar layout
        ├── services/api.ts          # All API methods
        ├── components/
        │   ├── Sidebar.tsx          # [NEW] Navigation sidebar
        │   ├── UploadPanel.tsx      # Single scan upload
        │   ├── AnalysisPanel.tsx    # Results display
        │   └── HistoryPanel.tsx     # Scan history
        └── pages/
            ├── Dashboard.tsx        # [NEW] Enterprise dashboard
            ├── SingleScan.tsx       # [NEW] Wrapped single scan
            ├── BatchScan.tsx        # [NEW] Bulk scan UI
            ├── AuditReports.tsx     # [NEW] Enhanced reports
            ├── PenaltyCalculator.tsx # [NEW] Penalty UI
            └── USPValidator.tsx     # [NEW] USP validation UI
```

---

## API Reference

### New Enterprise Endpoints

```
POST /api/penalties/calculate      Calculate penalties for an analysis
GET  /api/penalties/matrix         View full penalty matrix (from YAML)
GET  /api/penalties/history/{id}   Penalty history for an analysis

POST /api/usp/validate             Validate USP from explicit values
POST /api/usp/extract-validate     Auto-extract USP from OCR text

POST /api/batch/upload             Upload 1–20 images as a batch
POST /api/batch/{id}/process       Process (scan) the batch
GET  /api/batch/{id}               Get batch status + results
GET  /api/batch                    List all batches

GET  /api/export/pdf/{analysis_id} Download PDF audit report
GET  /api/export/csv/batch/{id}    Download batch results CSV
GET  /api/export/csv/all           Download all analyses CSV

GET  /api/dashboard/stats          Dashboard KPIs + trend data
GET  /api/dashboard/audit-logs     Paginated audit log
```

Full interactive docs at `/docs` (Swagger UI) and `/redoc`.

---

## Configuration

Edit `backend/rule_engine/rules_config.yaml` to customize:

- **Font size minimums** — `font_size.min_height_mm`, `mrp_min_height_mm`, `net_qty_min_height_mm`
- **USP tolerance** — `usp.tolerance_pct` (default: ±2%)
- **Penalty matrix** — per rule_code fine ranges and Act sections
- **Barcode settings** — supported symbologies, minimum confidence

No code changes needed — the server reads the YAML on startup.

---

## Running Tests

```bash
cd backend
.\venv\Scripts\python -m pytest tests/ -v --tb=short
```

> **Note on pyzbar / libzbar**: On Windows, 1D barcode decoding requires the `libzbar-64.dll` native library.
> Download from [https://github.com/NaturalHistoryMuseum/pyzbar](https://github.com/NaturalHistoryMuseum/pyzbar) releases.
> Without it, QR code detection via OpenCV still works. Barcode tests gracefully skip when libzbar is absent.

---

## Database Schema

```
uploads           — File upload records
analyses          — OCR + preprocessing results
compliance_findings — Per-rule check results (PASS/FAIL/WARN/SKIP)
penalty_records   — [v2] Calculated penalties per analysis
batch_jobs        — [v2] Bulk scan job metadata
batch_items       — [v2] Per-image results within a batch
audit_logs        — [v2] Immutable operation audit trail
barcode_results   — [v2] Decoded barcode/QR data per analysis
```

---

## Legal Metrology Reference

| Rule | Requirement | Minimum |
|---|---|---|
| Rule 6(1)(a) | MRP declaration | Mandatory |
| Rule 6(1)(b) | Net Quantity in standard units | Mandatory |
| Rule 6(1)(c) | Manufacturer name & address | Mandatory |
| Rule 6(1)(d) | Month & Year of manufacture | Mandatory |
| Rule 6(1)(k) | Consumer care number | Mandatory |
| Rule 6(1)(m) | Country of Origin (imports) | Mandatory |
| Rule 8 | Minimum font height | 1.0 mm (MRP: 2.0 mm) |
| Rule 18 | Unit Sale Price | Must match MRP ÷ Net Qty |

---

*Built under Legal Metrology (Packaged Commodities) Rules, 2011 and Legal Metrology Act, 2009.*
