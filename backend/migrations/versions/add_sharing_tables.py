"""add_sharing_tables

Revision ID: add_sharing_tables
Revises: add_share_templates_manual
Create Date: 2025-01-27 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_sharing_tables'
down_revision = 'add_share_templates_manual'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create shares table
    op.create_table('shares',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('share_token', sa.String(length=64), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('content', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('template_id', sa.String(length=100), nullable=False),
        sa.Column('target_language', sa.String(length=10), nullable=False),
        sa.Column('entry_count', sa.Integer(), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('access_count', sa.Integer(), nullable=False),
        sa.Column('expires_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('last_accessed_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('share_token')
    )
    
    # Create indexes for shares table
    op.create_index(op.f('ix_shares_id'), 'shares', ['id'], unique=False)
    op.create_index(op.f('ix_shares_share_token'), 'shares', ['share_token'], unique=True)
    op.create_index(op.f('ix_shares_user_id'), 'shares', ['user_id'], unique=False)
    
    # Create share_access table
    op.create_table('share_access',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('share_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('ip_address_hash', sa.String(length=64), nullable=True),
        sa.Column('user_agent_hash', sa.String(length=64), nullable=True),
        sa.Column('referrer', sa.String(length=255), nullable=True),
        sa.Column('access_type', sa.String(length=20), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['share_id'], ['shares.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for share_access table
    op.create_index(op.f('ix_share_access_share_id'), 'share_access', ['share_id'], unique=False)


def downgrade() -> None:
    # Drop indexes
    op.drop_index(op.f('ix_share_access_share_id'), table_name='share_access')
    op.drop_index(op.f('ix_shares_user_id'), table_name='shares')
    op.drop_index(op.f('ix_shares_share_token'), table_name='shares')
    op.drop_index(op.f('ix_shares_id'), table_name='shares')
    
    # Drop tables
    op.drop_table('share_access')
    op.drop_table('shares')
