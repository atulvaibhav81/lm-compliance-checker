"""api/routes/dashboard.py — GET /api/dashboard/stats"""
from __future__ import annotations

import logging
from collections import Counter
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from api.deps import get_db
from db.models.analysis import Analysis
from db.models.batch_job import BatchJob
from db.models.compliance import ComplianceFinding
from db.models.upload import Upload

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats")
def get_dashboard_stats(
    days: int = Query(30, ge=1, le=365, description="Look-back window in days"),
    db: Session = Depends(get_db),
) -> dict:
    """
    Aggregated stats for the enterprise dashboard.

    Returns:
      - summary counts (total scans, batches, avg score)
      - daily trend data (last N days)
      - top violations
      - compliance score distribution
      - recent scans list
    """
    since = datetime.utcnow() - timedelta(days=days)

    # ── Total scans & compliance score ────────────────────────────────────
    all_analyses = (
        db.query(Analysis)
        .options(joinedload(Analysis.findings))
        .filter(Analysis.created_at >= since)
        .order_by(Analysis.created_at.desc())
        .all()
    )

    total_scans = len(all_analyses)
    scores = []
    for a in all_analyses:
        findings = a.findings or []
        total_f = len(findings)
        passed = sum(1 for f in findings if f.status.value == "PASS")
        score = round((passed / total_f) * 100, 1) if total_f else 0.0
        scores.append(score)

    avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0
    compliant_count = sum(1 for s in scores if s >= 80)
    non_compliant_count = sum(1 for s in scores if s < 50)
    partial_count = total_scans - compliant_count - non_compliant_count

    # ── Total batches ─────────────────────────────────────────────────────
    total_batches = (
        db.query(func.count(BatchJob.id))
        .filter(BatchJob.created_at >= since)
        .scalar() or 0
    )

    # ── Top violations ────────────────────────────────────────────────────
    fail_findings = (
        db.query(ComplianceFinding)
        .join(Analysis, ComplianceFinding.analysis_id == Analysis.id)
        .filter(Analysis.created_at >= since)
        .filter(ComplianceFinding.status == "FAIL")
        .all()
    )
    violation_counter: Counter = Counter()
    for f in fail_findings:
        violation_counter[f.rule_name] += 1
    top_violations = [
        {"rule_name": name, "count": count}
        for name, count in violation_counter.most_common(10)
    ]

    # ── Daily trend ───────────────────────────────────────────────────────
    trend: dict[str, dict] = {}
    for i in range(days):
        d = (datetime.utcnow() - timedelta(days=days - 1 - i)).strftime("%Y-%m-%d")
        trend[d] = {"date": d, "scans": 0, "avg_score": 0.0, "failed": 0}

    day_scores: dict[str, list] = {d: [] for d in trend}
    for a in all_analyses:
        d = a.created_at.strftime("%Y-%m-%d") if a.created_at else None
        if d and d in trend:
            findings = a.findings or []
            total_f = len(findings)
            passed = sum(1 for f in findings if f.status.value == "PASS")
            failed = sum(1 for f in findings if f.status.value == "FAIL")
            sc = round((passed / total_f) * 100, 1) if total_f else 0.0
            trend[d]["scans"] += 1
            trend[d]["failed"] += failed
            day_scores[d].append(sc)

    for d, vals in day_scores.items():
        trend[d]["avg_score"] = round(sum(vals) / len(vals), 1) if vals else 0.0

    # ── Score distribution (buckets) ──────────────────────────────────────
    buckets = {"0-49": 0, "50-69": 0, "70-89": 0, "90-100": 0}
    for s in scores:
        if s < 50: buckets["0-49"] += 1
        elif s < 70: buckets["50-69"] += 1
        elif s < 90: buckets["70-89"] += 1
        else: buckets["90-100"] += 1

    # ── Recent scans ──────────────────────────────────────────────────────
    recent_analyses = all_analyses[:10]
    recent_scans = []
    for a in recent_analyses:
        upload = db.query(Upload).filter(Upload.id == a.upload_id).first()
        findings = a.findings or []
        total_f = len(findings)
        passed = sum(1 for f in findings if f.status.value == "PASS")
        failed = sum(1 for f in findings if f.status.value == "FAIL")
        sc = round((passed / total_f) * 100, 1) if total_f else 0.0
        recent_scans.append({
            "analysis_id": a.id,
            "filename": upload.original_filename if upload else "N/A",
            "compliance_score": sc,
            "passed": passed,
            "failed": failed,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        })

    return {
        "period_days": days,
        "summary": {
            "total_scans": total_scans,
            "total_batches": total_batches,
            "avg_compliance_score": avg_score,
            "compliant_count": compliant_count,
            "partial_count": partial_count,
            "non_compliant_count": non_compliant_count,
            "total_violations": len(fail_findings),
        },
        "top_violations": top_violations,
        "daily_trend": list(trend.values()),
        "score_distribution": buckets,
        "recent_scans": recent_scans,
    }


@router.get("/audit-logs")
def get_audit_logs(
    skip: int = 0,
    limit: int = 50,
    operation: str | None = None,
    db: Session = Depends(get_db),
) -> dict:
    """Paginated audit log with optional operation filter."""
    from db.models.audit_log import AuditLog
    query = db.query(AuditLog).order_by(AuditLog.created_at.desc())
    if operation:
        query = query.filter(AuditLog.operation == operation.upper())
    total = query.count()
    logs = query.offset(skip).limit(limit).all()

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "logs": [
            {
                "id": log.id,
                "operation": log.operation,
                "entity_type": log.entity_type,
                "entity_id": log.entity_id,
                "actor": log.actor,
                "status": log.status,
                "details": log.details,
                "error_message": log.error_message,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ],
    }
