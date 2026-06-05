"""Add referral_codes + referral_rewards tables (two-sided reward ledger).

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-04

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '0004'
down_revision: Union[str, None] = '0003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'referral_codes',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('code', sa.String(40), nullable=False, unique=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_referral_codes_user_id', 'referral_codes', ['user_id'])
    op.create_index('ix_referral_codes_code', 'referral_codes', ['code'])

    op.create_table(
        'referral_rewards',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('referrer_user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('referred_user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('code_used', sa.String(40), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('reward_inr', sa.Integer, nullable=False, server_default='0'),
        sa.Column('referred_reward_inr', sa.Integer, nullable=False, server_default='0'),
        sa.Column('reward_premium_days', sa.Integer, nullable=False, server_default='0'),
        sa.Column('qualified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('referred_user_id', name='uq_referral_reward_referred'),
    )
    op.create_index('ix_referral_rewards_referrer_user_id', 'referral_rewards', ['referrer_user_id'])
    op.create_index('idx_referral_rewards_referrer', 'referral_rewards', ['referrer_user_id'])


def downgrade() -> None:
    op.drop_index('idx_referral_rewards_referrer', table_name='referral_rewards')
    op.drop_index('ix_referral_rewards_referrer_user_id', table_name='referral_rewards')
    op.drop_table('referral_rewards')
    op.drop_index('ix_referral_codes_code', table_name='referral_codes')
    op.drop_index('ix_referral_codes_user_id', table_name='referral_codes')
    op.drop_table('referral_codes')
