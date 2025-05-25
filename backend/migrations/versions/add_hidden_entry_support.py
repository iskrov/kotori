"""Add hidden entry support with encryption

Revision ID: hidden_entry_support_001
Revises: 58be796873f8
Create Date: 2025-01-15 00:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "hidden_entry_support_001"
down_revision = "58be796873f8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add hidden entry fields to journal_entries table
    op.add_column('journal_entries', sa.Column('is_hidden', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('journal_entries', sa.Column('encrypted_content', sa.Text(), nullable=True))
    op.add_column('journal_entries', sa.Column('encryption_iv', sa.String(), nullable=True))
    
    # Add code phrase fields to users table
    op.add_column('users', sa.Column('unlock_phrase_hash', sa.String(), nullable=True))
    op.add_column('users', sa.Column('decoy_phrase_hash', sa.String(), nullable=True))
    op.add_column('users', sa.Column('panic_phrase_hash', sa.String(), nullable=True))


def downgrade() -> None:
    # Remove fields from users table
    op.drop_column('users', 'panic_phrase_hash')
    op.drop_column('users', 'decoy_phrase_hash')
    op.drop_column('users', 'unlock_phrase_hash')
    
    # Remove fields from journal_entries table
    op.drop_column('journal_entries', 'encryption_iv')
    op.drop_column('journal_entries', 'encrypted_content')
    op.drop_column('journal_entries', 'is_hidden') 