"""Add append-only ledger_entries table (immutable trade ledger).

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-04

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '0002'
down_revision: Union[str, None] = '0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'ledger_entries',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('ticker', sa.String(20), nullable=False),
        sa.Column('action', sa.String(10), nullable=False),
        sa.Column('qty', sa.Numeric(18, 6), nullable=False),
        sa.Column('price', sa.Numeric(15, 2), nullable=False),
        sa.Column('fees', sa.Numeric(15, 2), nullable=False, server_default='0'),
        sa.Column('trade_date', sa.Date, nullable=False),
        sa.Column('source', sa.String(20), nullable=False, server_default='manual'),
        sa.Column('broker', sa.String(50), nullable=True),
        sa.Column('external_id', sa.String(120), nullable=True),
        sa.Column('note', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_ledger_entries_user_id', 'ledger_entries', ['user_id'])
    op.create_index('ix_ledger_entries_ticker', 'ledger_entries', ['ticker'])
    op.create_index('idx_ledger_user_ticker', 'ledger_entries', ['user_id', 'ticker'])
    op.create_index('idx_ledger_user_date', 'ledger_entries', ['user_id', 'trade_date'])


def downgrade() -> None:
    op.drop_index('idx_ledger_user_date', table_name='ledger_entries')
    op.drop_index('idx_ledger_user_ticker', table_name='ledger_entries')
    op.drop_index('ix_ledger_entries_ticker', table_name='ledger_entries')
    op.drop_index('ix_ledger_entries_user_id', table_name='ledger_entries')
    op.drop_table('ledger_entries')
