# Database Schema Standardization Guidelines

**Date**: January 22, 2025  
**Version**: 1.0  
**Purpose**: Establish consistent patterns for database model design in the Vibes application

## Overview

This document provides mandatory guidelines for database schema design to ensure consistency, performance, and maintainability across the Vibes application. These guidelines address the issues identified in the comprehensive schema audit.

## Core Principles

### 1. **Consistency First**
- All models must follow identical patterns for common elements
- Exceptions require explicit justification and documentation
- New models must conform to established standards

### 2. **Performance by Design**
- All foreign key columns must have indexes
- Common query patterns must have composite indexes
- Database constraints must enforce business logic

### 3. **Future-Proof Architecture**
- Use native database types when possible
- Design for scalability and cloud deployment
- Maintain backward compatibility during migrations

## Standardization Rules

### **Rule 1: Primary Key Standardization**

#### **Standard Pattern**
```python
class StandardModel(Base, TimestampMixin):
    """All models must follow this pattern unless explicitly justified"""
    id = Column(UUID, primary_key=True, default=uuid.uuid4, index=True)
```

#### **Permitted Exceptions**
```python
# Exception 1: Sequential IDs for ordering/pagination
class LogEntry(Base, TimestampMixin):
    id = Column(Integer, primary_key=True, index=True)  # Documented exception
    
# Exception 2: Composite primary keys
class JournalEntryTag(Base):
    entry_id = Column(UUID, ForeignKey("journal_entries.id"), primary_key=True)
    tag_id = Column(UUID, ForeignKey("tags.id"), primary_key=True)
    
# Exception 3: Protocol-specific requirements (OPAQUE)
class SecretTag(Base, TimestampMixin):
    tag_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    # ^ Required for OPAQUE protocol compatibility
```

### **Rule 2: Foreign Key Standards**

#### **Required Pattern**
```python
class ModelWithForeignKeys(Base, TimestampMixin):
    # All foreign keys must:
    # 1. Have explicit index=True
    # 2. Use consistent naming convention
    # 3. Include nullable specification
    # 4. Reference the correct target type
    
    user_id = Column(UUID, ForeignKey("users.id"), nullable=False, index=True)
    parent_id = Column(UUID, ForeignKey("models.id"), nullable=True, index=True)
```

#### **Relationship Definitions**
```python
class ModelWithForeignKeys(Base, TimestampMixin):
    # Relationships must:
    # 1. Use descriptive names
    # 2. Include back_populates
    # 3. Specify cascade behavior
    
    user = relationship("User", back_populates="models")
    parent = relationship("Model", remote_side=[id], back_populates="children")
    children = relationship("Model", back_populates="parent", cascade="all, delete-orphan")
```

### **Rule 3: Index Standards**

#### **Required Indexes**
```python
class ModelWithIndexes(Base, TimestampMixin):
    # 1. Primary key (automatic)
    id = Column(UUID, primary_key=True, default=uuid.uuid4, index=True)
    
    # 2. Foreign keys (explicit)
    user_id = Column(UUID, ForeignKey("users.id"), nullable=False, index=True)
    
    # 3. Unique constraints
    email = Column(String, unique=True, index=True, nullable=False)
    
    # 4. Composite indexes for common queries
    __table_args__ = (
        Index('idx_model_user_created', 'user_id', 'created_at'),
        Index('idx_model_user_status', 'user_id', 'status'),
    )
```

### **Rule 4: Timestamp Standards**

#### **Required Pattern**
```python
class AllModels(Base, TimestampMixin):
    """All models must inherit from TimestampMixin"""
    # This provides:
    # - created_at: DateTime(timezone=True)
    # - updated_at: DateTime(timezone=True)
    # - Automatic population and updates
```

#### **Exception Pattern**
```python
class SpecialCaseModel(Base):
    """Only when TimestampMixin is incompatible"""
    # Manual timestamp handling with justification
    timestamp = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    # Must document why TimestampMixin cannot be used
```

### **Rule 5: Constraint Standards**

#### **Required Constraints**
```python
class ModelWithConstraints(Base, TimestampMixin):
    # 1. Unique constraints for business logic
    __table_args__ = (
        UniqueConstraint('user_id', 'name', name='uq_model_user_name'),
        UniqueConstraint('entry_id', 'tag_id', name='uq_entry_tag'),
    )
    
    # 2. Check constraints where appropriate
    status = Column(String(20), CheckConstraint("status IN ('active', 'inactive')"))
    
    # 3. Foreign key constraints (automatic with ForeignKey)
    user_id = Column(UUID, ForeignKey("users.id"), nullable=False)
```

## Model Template

### **Standard Model Template**
```python
"""
Module: app/models/example.py
Description: Example model following standardization guidelines
"""

import uuid
from sqlalchemy import Column, String, Boolean, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin, UUID


class ExampleModel(Base, TimestampMixin):
    """
    Example model demonstrating standardization patterns.
    
    This model shows:
    - Standard UUID primary key
    - Properly indexed foreign keys
    - Appropriate constraints
    - Clear relationships
    """
    __tablename__ = "examples"
    
    # Primary key - standard pattern
    id = Column(UUID, primary_key=True, default=uuid.uuid4, index=True)
    
    # Required fields
    name = Column(String(100), nullable=False)
    description = Column(String(500), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    
    # Foreign keys - with explicit indexes
    user_id = Column(UUID, ForeignKey("users.id"), nullable=False, index=True)
    category_id = Column(UUID, ForeignKey("categories.id"), nullable=True, index=True)
    
    # Relationships - with back_populates
    user = relationship("User", back_populates="examples")
    category = relationship("Category", back_populates="examples")
    
    # Table configuration
    __table_args__ = (
        # Unique constraints
        UniqueConstraint('user_id', 'name', name='uq_example_user_name'),
        
        # Composite indexes for common queries
        Index('idx_example_user_created', 'user_id', 'created_at'),
        Index('idx_example_category_active', 'category_id', 'is_active'),
        
        # Table options
        {"extend_existing": True},
    )
```

## Migration Standards

### **Migration Template**
```python
"""Migration description

Revision ID: {revision_id}
Revises: {previous_revision}
Create Date: {creation_date}
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


def upgrade() -> None:
    """Apply migration changes"""
    # 1. Create tables with proper structure
    op.create_table(
        'examples',
        sa.Column('id', UUID, primary_key=True, nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('user_id', UUID, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='fk_example_user'),
        sa.UniqueConstraint('user_id', 'name', name='uq_example_user_name'),
        sa.PrimaryKeyConstraint('id', name='pk_example')
    )
    
    # 2. Create indexes
    op.create_index('idx_example_user_created', 'examples', ['user_id', 'created_at'])
    op.create_index('idx_example_name', 'examples', ['name'])
    
    # 3. Add data if needed
    # (Include data migration steps)


def downgrade() -> None:
    """Rollback migration changes"""
    op.drop_index('idx_example_name', 'examples')
    op.drop_index('idx_example_user_created', 'examples')
    op.drop_table('examples')
```

## Validation Checklist

### **Pre-Migration Checklist**
- [ ] All primary keys use UUID type (or documented exception)
- [ ] All foreign keys have explicit indexes
- [ ] All models inherit from TimestampMixin (or documented exception)
- [ ] All unique constraints are defined
- [ ] All relationships have back_populates
- [ ] Migration includes proper rollback
- [ ] Tests validate schema changes

### **Code Review Checklist**
- [ ] Model follows standard template
- [ ] Foreign key types match referenced primary keys
- [ ] Indexes cover common query patterns
- [ ] Constraints enforce business logic
- [ ] Documentation explains design decisions
- [ ] Migration is incremental and safe

## Testing Standards

### **Required Tests**
```python
def test_model_primary_key_type():
    """Ensure model uses correct primary key type"""
    assert isinstance(ExampleModel.id.type, UUID)
    assert ExampleModel.id.primary_key is True
    assert ExampleModel.id.index is True


def test_model_foreign_key_indexes():
    """Ensure all foreign keys have indexes"""
    table = ExampleModel.__table__
    fk_columns = [col.name for col in table.columns if col.foreign_keys]
    indexed_columns = [idx.columns.keys()[0] for idx in table.indexes if len(idx.columns) == 1]
    
    for fk_col in fk_columns:
        assert fk_col in indexed_columns, f"Foreign key {fk_col} lacks index"


def test_model_unique_constraints():
    """Ensure business logic constraints are enforced"""
    # Test unique constraint enforcement
    with pytest.raises(IntegrityError):
        # Create duplicate records that should violate constraints
        pass


def test_model_relationships():
    """Ensure relationships work correctly"""
    # Test relationship loading and back_populates
    pass
```

## Performance Guidelines

### **Query Optimization**
```python
# Good: Use indexes for WHERE clauses
session.query(ExampleModel).filter(ExampleModel.user_id == user_id)  # Uses index

# Good: Use composite indexes for multi-column queries
session.query(ExampleModel).filter(
    ExampleModel.user_id == user_id,
    ExampleModel.created_at > date_threshold
)  # Uses composite index

# Bad: Query without proper indexes
session.query(ExampleModel).filter(ExampleModel.description.contains("text"))  # No index

# Good: Use joins efficiently
session.query(ExampleModel).join(User).filter(User.email == email)  # Efficient join
```

### **Index Strategy**
```python
# 1. Single-column indexes for foreign keys
user_id = Column(UUID, ForeignKey("users.id"), nullable=False, index=True)

# 2. Composite indexes for common query patterns
__table_args__ = (
    Index('idx_example_user_created', 'user_id', 'created_at'),  # Time-based queries
    Index('idx_example_user_status', 'user_id', 'status'),      # Status filtering
)

# 3. Unique indexes for business constraints
__table_args__ = (
    UniqueConstraint('user_id', 'name', name='uq_example_user_name'),
)
```

## Clean Schema Implementation (No Existing Data)

### **Direct Implementation Strategy**

Since both dev and test databases are empty with no production data, we can implement a clean, standardized schema directly without complex migration procedures.

#### **Clean Schema Migration**
```python
def upgrade():
    """Create standardized schema from scratch"""
    
    # Drop existing tables (safe - no data)
    op.drop_table('journal_entry_tags', if_exists=True)
    op.drop_table('journal_entries', if_exists=True)
    op.drop_table('tags', if_exists=True)
    op.drop_table('reminders', if_exists=True)
    op.drop_table('opaque_sessions', if_exists=True)
    
    # Create all tables with standardized UUID schema
    create_standardized_tables()
    
    # Create all indexes for optimal performance
    create_standardized_indexes()

def create_standardized_tables():
    """Create all tables with UUID primary keys and proper constraints"""
    
    # Journal entries with UUID primary key
    op.create_table('journal_entries',
        sa.Column('id', UUID, primary_key=True, default=uuid.uuid4, nullable=False),
        sa.Column('title', sa.String(), nullable=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('audio_url', sa.String(), nullable=True),
        sa.Column('entry_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('user_id', UUID, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='fk_journal_entries_user'),
    )
    
    # Tags with UUID primary key and business constraints
    op.create_table('tags',
        sa.Column('id', UUID, primary_key=True, default=uuid.uuid4, nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('color', sa.String(), nullable=True),
        sa.Column('user_id', UUID, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='fk_tags_user'),
        sa.UniqueConstraint('user_id', 'name', name='uq_tags_user_name'),
    )
    
    # Junction table with composite UUID primary key
    op.create_table('journal_entry_tags',
        sa.Column('entry_id', UUID, nullable=False),
        sa.Column('tag_id', UUID, nullable=False),
        sa.PrimaryKeyConstraint('entry_id', 'tag_id'),
        sa.ForeignKeyConstraint(['entry_id'], ['journal_entries.id'], name='fk_journal_entry_tags_entry'),
        sa.ForeignKeyConstraint(['tag_id'], ['tags.id'], name='fk_journal_entry_tags_tag'),
    )
    
    # Reminders with UUID primary key
    op.create_table('reminders',
        sa.Column('id', UUID, primary_key=True, default=uuid.uuid4, nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('message', sa.String(), nullable=False),
        sa.Column('frequency', sa.Enum('daily', 'weekdays', 'weekends', 'weekly', 'monthly', 'custom'), nullable=False),
        sa.Column('time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('custom_days', sa.String(), nullable=True),
        sa.Column('user_id', UUID, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='fk_reminders_user'),
    )
    
    # OPAQUE sessions with UUID primary key
    op.create_table('opaque_sessions',
        sa.Column('session_id', UUID, primary_key=True, default=uuid.uuid4, nullable=False),
        sa.Column('user_id', UUID, nullable=False),
        sa.Column('binary_tag_id', sa.LargeBinary(16), nullable=True),
        sa.Column('session_state', sa.String(20), nullable=False, default='initialized'),
        sa.Column('session_data', sa.LargeBinary(), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('last_activity', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

def create_standardized_indexes():
    """Create all indexes for optimal performance"""
    
    # Foreign key indexes (required for JOIN performance)
    op.create_index('idx_journal_entries_user_id', 'journal_entries', ['user_id'])
    op.create_index('idx_tags_user_id', 'tags', ['user_id'])
    op.create_index('idx_journal_entry_tags_entry_id', 'journal_entry_tags', ['entry_id'])
    op.create_index('idx_journal_entry_tags_tag_id', 'journal_entry_tags', ['tag_id'])
    op.create_index('idx_reminders_user_id', 'reminders', ['user_id'])
    op.create_index('idx_opaque_sessions_user_id', 'opaque_sessions', ['user_id'])
    
    # Composite indexes for common query patterns
    op.create_index('idx_journal_entries_user_date', 'journal_entries', ['user_id', 'entry_date'])
    op.create_index('idx_tags_user_created', 'tags', ['user_id', 'created_at'])
    op.create_index('idx_opaque_sessions_expires_at', 'opaque_sessions', ['expires_at'])
    op.create_index('idx_opaque_sessions_binary_tag_id', 'opaque_sessions', ['binary_tag_id'])

def downgrade():
    """Rollback to previous schema state"""
    op.drop_table('opaque_sessions')
    op.drop_table('reminders')
    op.drop_table('journal_entry_tags')
    op.drop_table('tags')
    op.drop_table('journal_entries')
    # Note: users table maintained as it's already standardized
```

#### **Code Update Strategy**
```python
# Update all model files to use standardized patterns
# Update all API endpoints to handle UUID parameters
# Update all test fixtures to use UUID values
# Update all service layer methods to work with UUIDs
# Update all frontend integration to handle UUID strings
```

## Exception Documentation

### **Justified Exceptions**

#### **OPAQUE Protocol Models**
```python
class SecretTag(Base, TimestampMixin):
    """
    Exception: Uses String(36) primary key for OPAQUE protocol compatibility.
    
    The OPAQUE zero-knowledge authentication protocol requires specific
    tag ID handling that is incompatible with native UUID types.
    """
    tag_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    binary_tag_id = Column(LargeBinary(16), nullable=False, unique=True, index=True)
```

#### **Sequential ID Requirements**
```python
class LogEntry(Base, TimestampMixin):
    """
    Exception: Uses Integer primary key for guaranteed ordering.
    
    Log entries require sequential IDs for proper ordering and pagination.
    UUIDs do not provide chronological ordering guarantees.
    """
    id = Column(Integer, primary_key=True, index=True)
```

## Conclusion

These standardization guidelines ensure consistent, performant, and maintainable database schemas across the Vibes application. All new models must follow these patterns, and existing models should be migrated according to the provided strategies.

**Key Takeaways:**
1. Use UUID primary keys by default
2. Index all foreign key columns
3. Enforce business logic with constraints
4. Follow the standard model template
5. Document all exceptions

**Review Process:**
- All model changes must be reviewed against these guidelines
- Migration scripts must follow the standard template
- Tests must validate schema consistency
- Performance implications must be considered

---

**Document Version**: 1.0  
**Last Updated**: January 22, 2025  
**Next Review**: March 2025 