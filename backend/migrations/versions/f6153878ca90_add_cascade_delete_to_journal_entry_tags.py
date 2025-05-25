"""add_cascade_delete_to_journal_entry_tags

Revision ID: f6153878ca90
Revises: zero_knowledge_fields_001
Create Date: 2025-05-24 23:18:58.480438

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'f6153878ca90'
down_revision = 'zero_knowledge_fields_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the existing foreign key constraint
    op.drop_constraint('journal_entry_tags_entry_id_fkey', 'journal_entry_tags', type_='foreignkey')
    
    # Recreate the foreign key constraint with CASCADE DELETE
    op.create_foreign_key(
        'journal_entry_tags_entry_id_fkey',
        'journal_entry_tags',
        'journal_entries',
        ['entry_id'],
        ['id'],
        ondelete='CASCADE'
    )


def downgrade() -> None:
    # Drop the CASCADE foreign key constraint
    op.drop_constraint('journal_entry_tags_entry_id_fkey', 'journal_entry_tags', type_='foreignkey')
    
    # Recreate the original foreign key constraint without CASCADE
    op.create_foreign_key(
        'journal_entry_tags_entry_id_fkey',
        'journal_entry_tags',
        'journal_entries',
        ['entry_id'],
        ['id']
    )
