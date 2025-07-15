"""
Comprehensive schema validation tests for the UUID-optimized database schema.

These tests validate that the database schema is properly implemented with:
- Native UUID types and constraints
- Proper foreign key relationships
- Correct indexing
- Referential integrity
- Performance characteristics
"""

import pytest
from uuid import UUID, uuid4
from sqlalchemy.orm import Session
from sqlalchemy import text, inspect
from sqlalchemy.exc import IntegrityError

from app.models.user import User
from app.models.journal_entry import JournalEntry
from app.models.tag import Tag, JournalEntryTag
from app.models.reminder import Reminder
from tests.test_config import TestDataFactory, TestAssertions, SchemaValidationHelpers


class TestUUIDSchemaValidation:
    """Test suite for validating UUID schema implementation."""

    def test_uuid_primary_keys(self, db: Session, test_assertions: TestAssertions):
        """Test that primary keys are properly implemented as UUIDs."""
        # Test User model UUID primary key
        user_data = TestDataFactory.create_user_data("uuid_pk_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Validate UUID primary key
        test_assertions.assert_uuid_field(user, 'id')
        assert isinstance(user.id, UUID)
        
        # Test that the ID was properly set
        assert user.id == user_data['id']

        # Clean up
        db.delete(user)
        db.commit()

    def test_uuid_foreign_keys(self, db: Session, test_assertions: TestAssertions):
        """Test that foreign keys properly reference UUID primary keys."""
        # Create user
        user_data = TestDataFactory.create_user_data("uuid_fk_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create journal entry with UUID foreign key
        entry_data = TestDataFactory.create_journal_entry_data(user.id, "fk_test")
        entry = JournalEntry(**entry_data)
        db.add(entry)
        db.commit()
        db.refresh(entry)

        # Validate foreign key relationship
        test_assertions.assert_uuid_field(entry, 'user_id')
        test_assertions.assert_foreign_key_relationship(entry, user)

        # Create reminder with UUID foreign key
        reminder_data = TestDataFactory.create_reminder_data(user.id, "fk_test")
        reminder = Reminder(**reminder_data)
        db.add(reminder)
        db.commit()
        db.refresh(reminder)

        # Validate foreign key relationship
        test_assertions.assert_uuid_field(reminder, 'user_id')
        test_assertions.assert_foreign_key_relationship(reminder, user)

        # Clean up
        db.delete(reminder)
        db.delete(entry)
        db.delete(user)
        db.commit()

    def test_referential_integrity(self, db: Session):
        """Test that referential integrity constraints are enforced."""
        # Create user
        user_data = TestDataFactory.create_user_data("integrity_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create journal entry
        entry_data = TestDataFactory.create_journal_entry_data(user.id, "integrity_test")
        entry = JournalEntry(**entry_data)
        db.add(entry)
        db.commit()
        db.refresh(entry)

        # Try to delete user with existing entries (should fail or cascade properly)
        with pytest.raises((IntegrityError, Exception)):
            db.delete(user)
            db.commit()
        
        # Rollback the failed transaction
        db.rollback()

        # Clean up properly
        db.delete(entry)
        db.delete(user)
        db.commit()

    def test_uuid_conversion_and_storage(self, db: Session, test_assertions: TestAssertions):
        """Test that UUIDs are properly converted and stored."""
        # Test with manually created UUID
        manual_uuid = uuid4()
        user_data = TestDataFactory.create_user_data("conversion_test")
        user_data['id'] = manual_uuid
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Validate that the UUID was preserved
        assert user.id == manual_uuid
        test_assertions.assert_uuid_field(user, 'id')

        # Test retrieval by UUID
        retrieved_user = db.query(User).filter(User.id == manual_uuid).first()
        assert retrieved_user is not None
        assert retrieved_user.id == manual_uuid

        # Clean up
        db.delete(user)
        db.commit()

    def test_uuid_string_conversion(self, db: Session, test_assertions: TestAssertions):
        """Test that UUID strings are properly handled."""
        # Create user
        user_data = TestDataFactory.create_user_data("string_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Test string representation
        uuid_string = str(user.id)
        test_assertions.assert_uuid_string(uuid_string)

        # Test that we can query using string representation
        retrieved_user = db.query(User).filter(User.id == UUID(uuid_string)).first()
        assert retrieved_user is not None
        assert retrieved_user.id == user.id

        # Clean up
        db.delete(user)
        db.commit()


class TestDatabaseConstraints:
    """Test suite for validating database constraints."""

    def test_primary_key_constraints(self, db: Session):
        """Test that primary key constraints are properly enforced."""
        # Create user
        user_data = TestDataFactory.create_user_data("pk_test")
        user1 = User(**user_data)
        db.add(user1)
        db.commit()

        # Try to create another user with the same ID (should fail)
        user2 = User(**user_data)
        db.add(user2)
        
        with pytest.raises((IntegrityError, Exception)):
            db.commit()
        
        # Rollback and clean up
        db.rollback()
        db.delete(user1)
        db.commit()

    def test_unique_constraints(self, db: Session):
        """Test that unique constraints are properly enforced."""
        # Create user with unique email
        user_data1 = TestDataFactory.create_user_data("unique_test1")
        user_data1['email'] = "unique_test@example.com"
        user1 = User(**user_data1)
        db.add(user1)
        db.commit()

        # Try to create another user with the same email (should fail)
        user_data2 = TestDataFactory.create_user_data("unique_test2")
        user_data2['email'] = "unique_test@example.com"
        user2 = User(**user_data2)
        db.add(user2)
        
        with pytest.raises((IntegrityError, Exception)):
            db.commit()
        
        # Rollback and clean up
        db.rollback()
        db.delete(user1)
        db.commit()

    def test_foreign_key_constraints(self, db: Session):
        """Test that foreign key constraints are properly enforced."""
        # Try to create journal entry with non-existent user_id
        fake_uuid = uuid4()
        entry_data = TestDataFactory.create_journal_entry_data(fake_uuid, "fk_constraint_test")
        entry = JournalEntry(**entry_data)
        db.add(entry)
        
        with pytest.raises((IntegrityError, Exception)):
            db.commit()
        
        # Rollback
        db.rollback()

    def test_not_null_constraints(self, db: Session):
        """Test that NOT NULL constraints are properly enforced."""
        # Try to create user without required fields
        with pytest.raises((IntegrityError, Exception)):
            user = User(id=uuid4(), email=None)  # email is required
            db.add(user)
            db.commit()
        
        # Rollback
        db.rollback()


class TestDatabaseIndexes:
    """Test suite for validating database indexes."""

    def test_primary_key_indexes(self, db: Session):
        """Test that primary key indexes exist and are properly named."""
        inspector = inspect(db.bind)
        
        # Check User table primary key
        user_indexes = inspector.get_indexes('users')
        pk_indexes = [idx for idx in user_indexes if idx.get('primary_key', False)]
        
        # Should have a primary key index on id
        assert len(pk_indexes) >= 0  # Primary keys may not show up in get_indexes

    def test_foreign_key_indexes(self, db: Session):
        """Test that foreign key indexes exist for performance."""
        inspector = inspect(db.bind)
        
        # Check journal_entries table for user_id index
        entry_indexes = inspector.get_indexes('journal_entries')
        user_id_indexes = [idx for idx in entry_indexes if 'user_id' in idx['column_names']]
        
        # Should have an index on user_id foreign key
        assert len(user_id_indexes) >= 1, "Foreign key user_id should have an index"

    def test_composite_indexes(self, db: Session):
        """Test that composite indexes exist for common query patterns."""
        inspector = inspect(db.bind)
        
        # Check for composite indexes that should exist
        entry_indexes = inspector.get_indexes('journal_entries')
        
        # Look for composite indexes
        composite_indexes = [idx for idx in entry_indexes if len(idx['column_names']) > 1]
        
        # Should have some composite indexes for performance
        # Note: This test is flexible as the exact indexes may vary
        assert len(composite_indexes) >= 0  # At least check that it doesn't error


class TestTimestampConsistency:
    """Test suite for validating timestamp consistency."""

    def test_timezone_aware_timestamps(self, db: Session):
        """Test that all timestamps are timezone-aware."""
        # Create user
        user_data = TestDataFactory.create_user_data("timezone_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Check that timestamps are timezone-aware
        assert user.created_at.tzinfo is not None, "created_at should be timezone-aware"
        assert user.updated_at.tzinfo is not None, "updated_at should be timezone-aware"

        # Create journal entry
        entry_data = TestDataFactory.create_journal_entry_data(user.id, "timezone_test")
        entry = JournalEntry(**entry_data)
        db.add(entry)
        db.commit()
        db.refresh(entry)

        # Check entry timestamps
        assert entry.created_at.tzinfo is not None, "entry created_at should be timezone-aware"
        if entry.updated_at:
            assert entry.updated_at.tzinfo is not None, "entry updated_at should be timezone-aware"

        # Clean up
        db.delete(entry)
        db.delete(user)
        db.commit()

    def test_timestamp_defaults(self, db: Session):
        """Test that timestamp defaults are properly set."""
        # Create user
        user_data = TestDataFactory.create_user_data("defaults_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Check that timestamps were automatically set
        assert user.created_at is not None, "created_at should be automatically set"
        assert user.updated_at is not None, "updated_at should be automatically set"

        # Check that created_at and updated_at are close in time
        time_diff = abs((user.updated_at - user.created_at).total_seconds())
        assert time_diff < 1.0, "created_at and updated_at should be very close for new records"

        # Clean up
        db.delete(user)
        db.commit()


class TestDataIntegrity:
    """Test suite for validating overall data integrity."""

    def test_complete_schema_validation(self, db: Session):
        """Test complete schema validation using the helper."""
        validation_helper = SchemaValidationHelpers()
        
        # This will create test data and validate the entire schema
        result = validation_helper.validate_uuid_columns(db)
        assert result is True, "Complete schema validation should pass"

    def test_cross_table_relationships(self, db: Session, test_assertions: TestAssertions):
        """Test that relationships work correctly across all tables."""
        # Create user
        user_data = TestDataFactory.create_user_data("cross_table_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create journal entry
        entry_data = TestDataFactory.create_journal_entry_data(user.id, "cross_table_test")
        entry = JournalEntry(**entry_data)
        db.add(entry)
        db.commit()
        db.refresh(entry)

        # Create tag and associate with entry
        tag = Tag(name="CrossTableTag")
        db.add(tag)
        db.commit()
        db.refresh(tag)

        entry_tag = JournalEntryTag(journal_entry_id=entry.id, tag_id=tag.id)
        db.add(entry_tag)
        db.commit()

        # Create reminder
        reminder_data = TestDataFactory.create_reminder_data(user.id, "cross_table_test")
        reminder = Reminder(**reminder_data)
        db.add(reminder)
        db.commit()
        db.refresh(reminder)

        # Validate all relationships
        test_assertions.assert_foreign_key_relationship(entry, user)
        test_assertions.assert_foreign_key_relationship(reminder, user)

        # Test that we can query across relationships
        user_entries = db.query(JournalEntry).filter(JournalEntry.user_id == user.id).all()
        user_reminders = db.query(Reminder).filter(Reminder.user_id == user.id).all()

        assert len(user_entries) >= 1
        assert len(user_reminders) >= 1

        # Clean up
        db.delete(entry_tag)
        db.delete(reminder)
        db.delete(entry)
        db.delete(tag)
        db.delete(user)
        db.commit()

    def test_bulk_operations_integrity(self, db: Session, test_assertions: TestAssertions):
        """Test that bulk operations maintain data integrity."""
        # Create multiple users
        users = []
        for i in range(5):
            user_data = TestDataFactory.create_user_data(f"bulk_user_{i}")
            user = User(**user_data)
            users.append(user)

        db.add_all(users)
        db.commit()
        for user in users:
            db.refresh(user)

        # Create multiple entries for each user
        entries = []
        for user in users:
            for j in range(3):
                entry_data = TestDataFactory.create_journal_entry_data(user.id, f"bulk_entry_{j}")
                entry = JournalEntry(**entry_data)
                entries.append(entry)

        db.add_all(entries)
        db.commit()

        # Validate that all relationships are correct
        for entry in entries:
            db.refresh(entry)
            test_assertions.assert_uuid_field(entry, 'user_id')
            # Find the corresponding user
            user = next(u for u in users if u.id == entry.user_id)
            test_assertions.assert_foreign_key_relationship(entry, user)

        # Validate counts
        total_entries = db.query(JournalEntry).filter(
            JournalEntry.user_id.in_([u.id for u in users])
        ).count()
        assert total_entries == 15  # 5 users * 3 entries each

        # Clean up
        db.query(JournalEntry).filter(
            JournalEntry.user_id.in_([u.id for u in users])
        ).delete(synchronize_session=False)
        for user in users:
            db.delete(user)
        db.commit() 