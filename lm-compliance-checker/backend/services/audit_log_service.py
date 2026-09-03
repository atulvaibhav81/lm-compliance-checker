"""
services/audit_log_service.py
Writes immutable audit log entries to the database.
"""
from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.orm import Session

from db.models.audit_log import AuditLog

logger = logging.getLogger(__name__)


class AuditLogService:
    def log(
        self,
        db: Session,
        operation: str,
        entity_type: str | None = None,
        entity_id: int | None = None,
        actor: str = "system",
        status: str = "success",
        details: dict[str, Any] | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        error_message: str | None = None,
    ) -> AuditLog:
        """Insert a single immutable audit log entry."""
        entry = AuditLog(
            operation=operation,
            entity_type=entity_type,
            entity_id=entity_id,
            actor=actor,
            status=status,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent,
            error_message=error_message,
        )
        db.add(entry)
        try:
            db.commit()
            db.refresh(entry)
        except Exception as exc:
            logger.error("Failed to write audit log: %s", exc)
            db.rollback()
        return entry

    def log_success(
        self, db: Session, operation: str, entity_type: str | None = None,
        entity_id: int | None = None, details: dict | None = None
    ) -> AuditLog:
        return self.log(db, operation, entity_type, entity_id, status="success", details=details)

    def log_error(
        self, db: Session, operation: str, error_message: str,
        entity_type: str | None = None, entity_id: int | None = None
    ) -> AuditLog:
        return self.log(
            db, operation, entity_type, entity_id,
            status="error", error_message=error_message
        )


audit_log_service = AuditLogService()
