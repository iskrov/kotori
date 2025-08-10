"""restore_opaque_sessions

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2025-08-09 13:00:00.000000

Purpose: Restore the opaque_sessions table for OPAQUE user authentication.
This table was accidentally removed during PBI-4 Stage 2 when removing secret-tag functionality.
OPAQUE user authentication should remain functional while secret-tag features are removed.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = "b2c3d4e5f6a7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Create the opaque_sessions table for OPAQUE user authentication.
    This restores OPAQUE authentication functionality while keeping secret-tag features removed.
    """
    
    # Check if table already exists (it might have been created but not tracked)
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
        "WHERE table_schema = 'public' AND table_name = 'opaque_sessions')"
    ))
    table_exists = result.scalar()
    
    if table_exists:
        print("opaque_sessions table already exists, skipping creation")
        return
    
    # Create opaque_sessions table
    op.create_table(
        'opaque_sessions',
        sa.Column('session_id', sa.String(64), primary_key=True, nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), nullable=False),
        sa.Column('session_state', sa.String(64), nullable=False, server_default='initialized'),
        sa.Column('session_data', sa.LargeBinary(), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('last_activity', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    
    # Create indexes for performance
    op.create_index('idx_opaque_sessions_user_id', 'opaque_sessions', ['user_id'])
    op.create_index('idx_opaque_sessions_expires_at', 'opaque_sessions', ['expires_at'])
    
    # Add comment to clarify purpose
    op.execute(
        "COMMENT ON TABLE opaque_sessions IS "
        "'OPAQUE user authentication sessions - restored after accidental removal in PBI-4 Stage 2. "
        "This table is for user authentication only, not related to removed secret-tag functionality.'"
    )


def downgrade() -> None:
    """
    Remove the opaque_sessions table.
    """
    
    # Drop indexes
    op.drop_index('idx_opaque_sessions_expires_at', 'opaque_sessions')
    op.drop_index('idx_opaque_sessions_user_id', 'opaque_sessions')
    
    # Drop table
    op.drop_table('opaque_sessions')
