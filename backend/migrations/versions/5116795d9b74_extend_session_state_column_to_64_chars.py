"""extend_session_state_column_to_64_chars

Revision ID: 5116795d9b74
Revises: 23ca77cbbca2
Create Date: 2025-07-21 08:48:39.666761

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '5116795d9b74'
down_revision = '23ca77cbbca2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Extend session_state column from VARCHAR(20) to VARCHAR(64)
    # This allows for more descriptive OPAQUE session state names for better security auditing
    op.alter_column('opaque_sessions', 'session_state',
                    existing_type=sa.String(20),
                    type_=sa.String(64),
                    existing_nullable=False)


def downgrade() -> None:
    # Revert session_state column back to VARCHAR(20)
    # WARNING: This may truncate data if longer session states exist
    op.alter_column('opaque_sessions', 'session_state',
                    existing_type=sa.String(64),
                    type_=sa.String(20),
                    existing_nullable=False)
