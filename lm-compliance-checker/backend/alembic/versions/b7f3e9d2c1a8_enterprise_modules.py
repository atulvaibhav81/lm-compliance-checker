"""Enterprise Modules — New Tables

Revision ID: b7f3e9d2c1a8
Revises: 409e1cfed49e
Create Date: 2026-09-02 18:00:00.000000

Adds tables for:
  - penalty_records
  - batch_jobs
  - batch_items
  - audit_logs
  - barcode_results
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b7f3e9d2c1a8'
down_revision: Union[str, None] = '409e1cfed49e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── penalty_records ────────────────────────────────────────────────────
    op.create_table(
        'penalty_records',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('analysis_id', sa.Integer(), sa.ForeignKey('analyses.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('is_repeat_offense', sa.Boolean(), nullable=False, default=False),
        sa.Column('total_fine_min', sa.Float(), nullable=False, default=0.0),
        sa.Column('total_fine_max', sa.Float(), nullable=False, default=0.0),
        sa.Column('violation_count', sa.Integer(), nullable=False, default=0),
        sa.Column('breakdown', sa.JSON(), nullable=True),
        sa.Column('calculated_by', sa.String(128), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── batch_jobs ─────────────────────────────────────────────────────────
    op.create_table(
        'batch_jobs',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('batch_name', sa.String(255), nullable=True),
        sa.Column('status', sa.String(32), nullable=False, default='pending'),
        sa.Column('total_images', sa.Integer(), nullable=False, default=0),
        sa.Column('processed_images', sa.Integer(), nullable=False, default=0),
        sa.Column('failed_images', sa.Integer(), nullable=False, default=0),
        sa.Column('avg_compliance_score', sa.Float(), nullable=True),
        sa.Column('summary', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── batch_items ────────────────────────────────────────────────────────
    op.create_table(
        'batch_items',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('batch_job_id', sa.Integer(), sa.ForeignKey('batch_jobs.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('upload_id', sa.Integer(), sa.ForeignKey('uploads.id', ondelete='SET NULL'),
                  nullable=True, index=True),
        sa.Column('analysis_id', sa.Integer(), sa.ForeignKey('analyses.id', ondelete='SET NULL'),
                  nullable=True),
        sa.Column('original_filename', sa.String(255), nullable=False),
        sa.Column('status', sa.String(32), nullable=False, default='pending'),
        sa.Column('compliance_score', sa.Float(), nullable=True),
        sa.Column('pass_count', sa.Integer(), nullable=True),
        sa.Column('fail_count', sa.Integer(), nullable=True),
        sa.Column('warn_count', sa.Integer(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── audit_logs ─────────────────────────────────────────────────────────
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('operation', sa.String(64), nullable=False, index=True),
        sa.Column('entity_type', sa.String(64), nullable=True),
        sa.Column('entity_id', sa.Integer(), nullable=True, index=True),
        sa.Column('actor', sa.String(128), nullable=False, default='system'),
        sa.Column('status', sa.String(32), nullable=False, default='success'),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('ip_address', sa.String(64), nullable=True),
        sa.Column('user_agent', sa.String(256), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), index=True),
    )

    # ── barcode_results ────────────────────────────────────────────────────
    op.create_table(
        'barcode_results',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('analysis_id', sa.Integer(), sa.ForeignKey('analyses.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('symbology', sa.String(64), nullable=True),
        sa.Column('raw_data', sa.Text(), nullable=True),
        sa.Column('is_valid', sa.Boolean(), nullable=False, default=False),
        sa.Column('checksum_valid', sa.Boolean(), nullable=True),
        sa.Column('match_status', sa.String(32), nullable=True),
        sa.Column('confidence', sa.Float(), nullable=True),
        sa.Column('location', sa.String(128), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('barcode_results')
    op.drop_table('audit_logs')
    op.drop_table('batch_items')
    op.drop_table('batch_jobs')
    op.drop_table('penalty_records')
