"""add_share_templates_table_manual

Revision ID: add_share_templates_manual
Revises: 9fe92bee46fb
Create Date: 2025-01-27 15:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_share_templates_manual'
down_revision = '9fe92bee46fb'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create share_templates table
    op.create_table('share_templates',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('template_id', sa.String(length=100), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category', sa.String(length=50), nullable=True),
        sa.Column('version', sa.String(length=20), nullable=False),
        sa.Column('questions', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('template_id')
    )
    
    # Create indexes
    op.create_index(op.f('ix_share_templates_id'), 'share_templates', ['id'], unique=False)
    op.create_index(op.f('ix_share_templates_template_id'), 'share_templates', ['template_id'], unique=True)
    op.create_index(op.f('ix_share_templates_category'), 'share_templates', ['category'], unique=False)
    op.create_index(op.f('ix_share_templates_is_active'), 'share_templates', ['is_active'], unique=False)


def downgrade() -> None:
    # Drop indexes
    op.drop_index(op.f('ix_share_templates_is_active'), table_name='share_templates')
    op.drop_index(op.f('ix_share_templates_category'), table_name='share_templates')
    op.drop_index(op.f('ix_share_templates_template_id'), table_name='share_templates')
    op.drop_index(op.f('ix_share_templates_id'), table_name='share_templates')
    
    # Drop table
    op.drop_table('share_templates')
