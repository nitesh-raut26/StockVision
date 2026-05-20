"""Initial schema — all tables.

Revision ID: 0001
Revises:
Create Date: 2026-05-20

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '0001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── users ─────────────────────────────────────────────────────────────────
    op.create_table(
        'users',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('email', sa.String(255), nullable=True, unique=True),
        sa.Column('phone', sa.String(20), nullable=True, unique=True),
        sa.Column('hashed_password', sa.Text, nullable=True),
        sa.Column('plan', sa.String(20), nullable=False, server_default='free'),
        sa.Column('language', sa.String(10), nullable=False, server_default='en'),
        sa.Column('investing_style', sa.String(20), nullable=True),
        sa.Column('risk_appetite', sa.Integer, nullable=True),
        sa.Column('sectors', sa.JSON, nullable=True),
        sa.Column('onboarding_completed', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_users_email', 'users', ['email'])
    op.create_index('ix_users_phone', 'users', ['phone'])

    # ── portfolios ────────────────────────────────────────────────────────────
    op.create_table(
        'portfolios',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('broker', sa.String(50), nullable=False),
        sa.Column('broker_account_id', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_portfolios_user_id', 'portfolios', ['user_id'])

    # ── holdings ──────────────────────────────────────────────────────────────
    op.create_table(
        'holdings',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('portfolio_id', sa.String(36), sa.ForeignKey('portfolios.id', ondelete='CASCADE'), nullable=False),
        sa.Column('ticker', sa.String(20), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('qty', sa.Numeric(18, 6), nullable=False),
        sa.Column('avg_price', sa.Numeric(15, 2), nullable=False),
        sa.Column('sector', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('idx_holdings_portfolio_ticker', 'holdings', ['portfolio_id', 'ticker'])

    # ── transactions ──────────────────────────────────────────────────────────
    op.create_table(
        'transactions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('portfolio_id', sa.String(36), sa.ForeignKey('portfolios.id', ondelete='CASCADE'), nullable=False),
        sa.Column('ticker', sa.String(20), nullable=False),
        sa.Column('action', sa.String(10), nullable=False),
        sa.Column('qty', sa.Numeric(18, 6), nullable=False),
        sa.Column('price', sa.Numeric(15, 2), nullable=False),
        sa.Column('transaction_date', sa.Date, nullable=False),
        sa.Column('charges', sa.Numeric(15, 2), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('idx_transactions_portfolio_date', 'transactions', ['portfolio_id', 'transaction_date'])

    # ── goals ─────────────────────────────────────────────────────────────────
    op.create_table(
        'goals',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('goal_type', sa.String(20), nullable=False),
        sa.Column('target_amount', sa.Numeric(15, 2), nullable=False),
        sa.Column('target_date', sa.Date, nullable=False),
        sa.Column('monthly_sip', sa.Numeric(15, 2), nullable=False),
        sa.Column('current_corpus', sa.Numeric(15, 2), nullable=False, server_default='0'),
        sa.Column('suggested_allocation', sa.JSON, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_goals_user_id', 'goals', ['user_id'])

    # ── watchlist_items ───────────────────────────────────────────────────────
    op.create_table(
        'watchlist_items',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('ticker', sa.String(20), nullable=False),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('idx_watchlist_user_ticker', 'watchlist_items', ['user_id', 'ticker'])

    # ── alerts ────────────────────────────────────────────────────────────────
    op.create_table(
        'alerts',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('ticker', sa.String(20), nullable=False),
        sa.Column('condition', sa.String(20), nullable=False),
        sa.Column('threshold', sa.Numeric(15, 2), nullable=False),
        sa.Column('active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('triggered', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_alerts_user_id', 'alerts', ['user_id'])

    # ── broker_accounts ───────────────────────────────────────────────────────
    op.create_table(
        'broker_accounts',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('broker', sa.String(50), nullable=False),
        sa.Column('status', sa.String(30), nullable=False, server_default='not_connected'),
        sa.Column('access_mode', sa.String(20), nullable=False, server_default='read_only'),
        sa.Column('holdings_synced', sa.Integer, nullable=False, server_default='0'),
        sa.Column('last_sync_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('message', sa.Text, nullable=True),
        sa.Column('encrypted_access_token', sa.Text, nullable=True),
        sa.Column('encrypted_refresh_token', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )

    # ── family_members ────────────────────────────────────────────────────────
    op.create_table(
        'family_members',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('owner_user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('relation', sa.String(40), nullable=False),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('color', sa.String(20), nullable=False, server_default='#4361EE'),
        sa.Column('total_value', sa.Numeric(15, 2), nullable=False, server_default='0'),
        sa.Column('total_invested', sa.Numeric(15, 2), nullable=False, server_default='0'),
        sa.Column('total_pnl', sa.Numeric(15, 2), nullable=False, server_default='0'),
        sa.Column('xirr', sa.Numeric(8, 4), nullable=False, server_default='0'),
        sa.Column('permission', sa.String(30), nullable=False, server_default='view_only'),
        sa.Column('invite_status', sa.String(30), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )

    # ── research_reports ──────────────────────────────────────────────────────
    op.create_table(
        'research_reports',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('title', sa.String(240), nullable=False),
        sa.Column('summary', sa.Text, nullable=False),
        sa.Column('analyst', sa.String(120), nullable=False, server_default='StockVision Research'),
        sa.Column('sector', sa.String(100), nullable=False),
        sa.Column('ticker', sa.String(20), nullable=True),
        sa.Column('report_type', sa.String(40), nullable=False, server_default='THEME'),
        sa.Column('rating', sa.String(20), nullable=True),
        sa.Column('target_price', sa.Numeric(15, 2), nullable=True),
        sa.Column('confidence', sa.Numeric(4, 2), nullable=False, server_default='7.5'),
        sa.Column('pdf_url', sa.Text, nullable=True),
        sa.Column('tags', sa.JSON, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )

    # ── ca_clients ────────────────────────────────────────────────────────────
    op.create_table(
        'ca_clients',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('ca_user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('pan', sa.String(200), nullable=False),  # Fernet-encrypted
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('filing_status', sa.String(30), nullable=False, server_default='PENDING'),
        sa.Column('tax_year', sa.String(20), nullable=False, server_default='FY2025-26'),
        sa.Column('total_gains', sa.Numeric(15, 2), nullable=False, server_default='0'),
        sa.Column('total_tax', sa.Numeric(15, 2), nullable=False, server_default='0'),
        sa.Column('last_reviewed_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )

    # ── notifications ─────────────────────────────────────────────────────────
    op.create_table(
        'notifications',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('type', sa.String(20), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('body', sa.Text, nullable=False),
        sa.Column('read', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('idx_notifications_user_read', 'notifications', ['user_id', 'read'])

    # ── referrals ─────────────────────────────────────────────────────────────
    op.create_table(
        'referrals',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('referrer_user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('referee_user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('code', sa.String(40), nullable=False, unique=True),
        sa.Column('reward_inr', sa.Numeric(10, 2), nullable=False, server_default='0'),
        sa.Column('paid', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )

    # ── api_keys ──────────────────────────────────────────────────────────────
    op.create_table(
        'api_keys',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('key_hash', sa.String(64), nullable=False, unique=True),
        sa.Column('key_prefix', sa.String(20), nullable=False),
        sa.Column('environment', sa.String(10), nullable=False),
        sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('revoked', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('calls_count', sa.Integer, nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('idx_api_keys_user_env', 'api_keys', ['user_id', 'environment'])

    # ── password_reset_tokens ─────────────────────────────────────────────────
    op.create_table(
        'password_reset_tokens',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('token_hash', sa.String(64), nullable=False, unique=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )

    # ── email_verifications ───────────────────────────────────────────────────
    op.create_table(
        'email_verifications',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('token_hash', sa.String(64), nullable=False, unique=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('verified', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )

    # ── user_sessions ─────────────────────────────────────────────────────────
    op.create_table(
        'user_sessions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('jti', sa.String(64), nullable=False, unique=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('revoked', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('user_agent', sa.String(300), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )

    # ── audit_logs ────────────────────────────────────────────────────────────
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), nullable=True),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('resource_type', sa.String(50), nullable=True),
        sa.Column('resource_id', sa.String(36), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('detail', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('idx_audit_user_action', 'audit_logs', ['user_id', 'action'])
    op.create_index('idx_audit_created', 'audit_logs', ['created_at'])

    # ── subscription_events ───────────────────────────────────────────────────
    op.create_table(
        'subscription_events',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), nullable=True),
        sa.Column('event_type', sa.String(80), nullable=False),
        sa.Column('razorpay_event_id', sa.String(80), nullable=True, unique=True),
        sa.Column('razorpay_order_id', sa.String(80), nullable=True),
        sa.Column('amount_paise', sa.Integer, nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='received'),
        sa.Column('payload', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('subscription_events')
    op.drop_table('audit_logs')
    op.drop_table('user_sessions')
    op.drop_table('email_verifications')
    op.drop_table('password_reset_tokens')
    op.drop_table('api_keys')
    op.drop_table('referrals')
    op.drop_table('notifications')
    op.drop_table('ca_clients')
    op.drop_table('research_reports')
    op.drop_table('family_members')
    op.drop_table('broker_accounts')
    op.drop_table('alerts')
    op.drop_table('watchlist_items')
    op.drop_table('goals')
    op.drop_table('transactions')
    op.drop_table('holdings')
    op.drop_table('portfolios')
    op.drop_table('users')
