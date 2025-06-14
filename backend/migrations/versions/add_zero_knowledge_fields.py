"""Add zero-knowledge encryption fields

Revision ID: zero_knowledge_fields_001
Revises: hidden_entry_support_001
Create Date: 2025-01-15 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "zero_knowledge_fields_001"
down_revision = "hidden_entry_support_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add zero-knowledge encryption fields to journal_entries table
    op.add_column('journal_entries', sa.Column('encryption_salt', sa.String(), nullable=True))
    op.add_column('journal_entries', sa.Column('encrypted_key', sa.Text(), nullable=True))
    op.add_column('journal_entries', sa.Column('key_derivation_iterations', sa.Integer(), nullable=True))
    op.add_column('journal_entries', sa.Column('encryption_algorithm', sa.String(), nullable=True))
    op.add_column('journal_entries', sa.Column('encryption_wrap_iv', sa.String(), nullable=True))
    
    # Add simple secret tags fields
    op.add_column('journal_entries', sa.Column('secret_tag_id', sa.String(36), nullable=True))
    op.add_column('journal_entries', sa.Column('secret_tag_hash', sa.String(64), nullable=True))
    
    # Add indexes for efficient secret tag filtering
    op.create_index('idx_journal_entries_secret_tag_hash', 'journal_entries', ['secret_tag_hash'])
    op.create_index('idx_journal_entries_secret_tag_id', 'journal_entries', ['secret_tag_id'])


def downgrade() -> None:
    # Remove secret tags fields and indexes
    op.drop_index('idx_journal_entries_secret_tag_id', 'journal_entries')
    op.drop_index('idx_journal_entries_secret_tag_hash', 'journal_entries')
    op.drop_column('journal_entries', 'secret_tag_hash')
    op.drop_column('journal_entries', 'secret_tag_id')
    
    # Remove zero-knowledge encryption fields
    op.drop_column('journal_entries', 'encryption_wrap_iv')
    op.drop_column('journal_entries', 'encryption_algorithm')
    op.drop_column('journal_entries', 'key_derivation_iterations')
    op.drop_column('journal_entries', 'encrypted_key')
    op.drop_column('journal_entries', 'encryption_salt') 