"""Add saved_screens table (named screener configs + alert opt-in).

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-04

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '0003'
down_revision: Union[str, None] = '0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'saved_screens',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('filters', sa.JSON, nullable=True),
        sa.Column('alert_enabled', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_saved_screens_user_id', 'saved_screens', ['user_id'])
    op.create_index('idx_saved_screens_user', 'saved_screens', ['user_id'])


def downgrade() -> None:
    op.drop_index('idx_saved_screens_user', table_name='saved_screens')
    op.drop_index('ix_saved_screens_user_id', table_name='saved_screens')
    op.drop_table('saved_screens')
