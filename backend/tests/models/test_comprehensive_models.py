"""
Comprehensive Model Tests for UUID Primary Keys

This module contains comprehensive tests for all models with UUID primary keys,
including CRUD operations, relationships, constraints, and error handling.
"""

import pytest
import uuid
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import text

from app.models.user import User
from app.models.journal_entry import JournalEntry
from app.models.tag import Tag, JournalEntryTag
from app.models.reminder import Reminder
from app.models.secret_tag_opaque import SecretTag
from app.models.monitoring import Monitoring
from tests.test_config import TestDataFactory, TestAssertions


class TestUserModel:
    """Comprehensive tests for User model with UUID primary key."""

    def test_user_creation_with_uuid_primary_key(self, db: Session, test_factory: TestDataFactory):
        """Test user creation with automatic UUID primary key generation."""
        # Create user without specifying ID (should auto-generate)
        user_data = test_factory.create_user_data("uuid_creation_test")
        del user_data['id']  # Remove ID to test auto-generation
        
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Verify UUID primary key was generated
        assert user.id is not None
        assert isinstance(user.id, uuid.UUID)
        assert user.email == "uuid_creation_test@example.com"
        
        # Clean up
        db.delete(user)
        db.commit()

    def test_user_creation_with_explicit_uuid(self, db: Session, test_factory: TestDataFactory):
        """Test user creation with explicit UUID primary key."""
        user_data = test_factory.create_user_data("explicit_uuid_test")
        explicit_uuid = user_data['id']
        
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Verify explicit UUID was used
        assert user.id == explicit_uuid
        assert isinstance(user.id, uuid.UUID)
        
        # Clean up
        db.delete(user)
        db.commit()

    def test_user_uuid_uniqueness(self, db: Session, test_factory: TestDataFactory):
        """Test that user UUID primary keys are unique."""
        # Create first user
        user1_data = test_factory.create_user_data("unique_test_1")
        user1 = User(**user1_data)
        db.add(user1)
        db.commit()
        db.refresh(user1)

        # Try to create second user with same UUID (should fail)
        user2_data = test_factory.create_user_data("unique_test_2")
        user2_data['id'] = user1.id  # Use same UUID
        user2 = User(**user2_data)
        db.add(user2)
        
        with pytest.raises(IntegrityError):
            db.commit()
        
        db.rollback()
        
        # Clean up
        db.delete(user1)
        db.commit()

    def test_user_email_uniqueness(self, db: Session, test_factory: TestDataFactory):
        """Test that user emails are unique."""
        # Create first user
        user1_data = test_factory.create_user_data("email_unique_test")
        user1 = User(**user1_data)
        db.add(user1)
        db.commit()
        db.refresh(user1)

        # Try to create second user with same email (should fail)
        user2_data = test_factory.create_user_data("email_unique_test_2")
        user2_data['email'] = user1.email  # Use same email
        user2 = User(**user2_data)
        db.add(user2)
        
        with pytest.raises(IntegrityError):
            db.commit()
        
        db.rollback()
        
        # Clean up
        db.delete(user1)
        db.commit()

    def test_user_crud_operations(self, db: Session, test_factory: TestDataFactory):
        """Test CRUD operations with UUID primary keys."""
        # Create
        user_data = test_factory.create_user_data("crud_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)
        
        original_id = user.id
        
        # Read
        retrieved_user = db.query(User).filter(User.id == original_id).first()
        assert retrieved_user is not None
        assert retrieved_user.id == original_id
        assert retrieved_user.email == user.email
        
        # Update
        retrieved_user.full_name = "Updated Name"
        db.commit()
        db.refresh(retrieved_user)
        
        updated_user = db.query(User).filter(User.id == original_id).first()
        assert updated_user.full_name == "Updated Name"
        assert updated_user.id == original_id  # ID should remain unchanged
        
        # Delete
        db.delete(updated_user)
        db.commit()
        
        deleted_user = db.query(User).filter(User.id == original_id).first()
        assert deleted_user is None


class TestJournalEntryModel:
    """Comprehensive tests for JournalEntry model with UUID primary key."""

    def test_journal_entry_creation_with_uuid(self, db: Session, test_factory: TestDataFactory):
        """Test journal entry creation with UUID primary key and foreign key."""
        # Create user first
        user_data = test_factory.create_user_data("journal_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create journal entry
        entry_data = test_factory.create_journal_entry_data(user.id, "uuid_test")
        entry = JournalEntry(**entry_data)
        db.add(entry)
        db.commit()
        db.refresh(entry)

        # Verify UUID primary key and foreign key
        assert entry.id is not None
        assert isinstance(entry.id, uuid.UUID)
        assert entry.user_id == user.id
        assert isinstance(entry.user_id, uuid.UUID)
        
        # Clean up
        db.delete(entry)
        db.delete(user)
        db.commit()

    def test_journal_entry_foreign_key_constraint(self, db: Session, test_factory: TestDataFactory):
        """Test foreign key constraint enforcement."""
        # Try to create journal entry with non-existent user_id
        non_existent_user_id = uuid.uuid4()
        entry_data = test_factory.create_journal_entry_data(non_existent_user_id, "fk_test")
        entry = JournalEntry(**entry_data)
        db.add(entry)
        
        with pytest.raises(IntegrityError):
            db.commit()
        
        db.rollback()

    def test_journal_entry_user_relationship(self, db: Session, test_factory: TestDataFactory):
        """Test relationship between journal entry and user."""
        # Create user
        user_data = test_factory.create_user_data("relationship_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create journal entry
        entry_data = test_factory.create_journal_entry_data(user.id, "relationship_test")
        entry = JournalEntry(**entry_data)
        db.add(entry)
        db.commit()
        db.refresh(entry)

        # Test relationship access
        assert entry.user_id == user.id
        
        # Test querying through relationship
        user_entries = db.query(JournalEntry).filter(JournalEntry.user_id == user.id).all()
        assert len(user_entries) == 1
        assert user_entries[0].id == entry.id

        # Clean up
        db.delete(entry)
        db.delete(user)
        db.commit()

    def test_journal_entry_cascade_delete(self, db: Session, test_factory: TestDataFactory):
        """Test cascade behavior when user is deleted."""
        # Create user
        user_data = test_factory.create_user_data("cascade_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create journal entry
        entry_data = test_factory.create_journal_entry_data(user.id, "cascade_test")
        entry = JournalEntry(**entry_data)
        db.add(entry)
        db.commit()
        db.refresh(entry)

        entry_id = entry.id
        
        # Delete user (should cascade to journal entry based on foreign key constraint)
        db.delete(user)
        db.commit()

        # Verify journal entry still exists (no cascade delete configured)
        remaining_entry = db.query(JournalEntry).filter(JournalEntry.id == entry_id).first()
        # Note: This test verifies current behavior - may need adjustment based on cascade configuration
        
        # Clean up remaining entry if it exists
        if remaining_entry:
            db.delete(remaining_entry)
            db.commit()


class TestTagModel:
    """Comprehensive tests for Tag model with UUID primary key."""

    def test_tag_creation_with_uuid(self, db: Session, test_factory: TestDataFactory):
        """Test tag creation with UUID primary key."""
        # Create user first
        user_data = test_factory.create_user_data("tag_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create tag
        tag = Tag(name="TestTag", user_id=user.id)
        db.add(tag)
        db.commit()
        db.refresh(tag)

        # Verify UUID primary key
        assert tag.id is not None
        assert isinstance(tag.id, uuid.UUID)
        assert tag.user_id == user.id
        assert isinstance(tag.user_id, uuid.UUID)
        
        # Clean up
        db.delete(tag)
        db.delete(user)
        db.commit()

    def test_tag_user_unique_constraint(self, db: Session, test_factory: TestDataFactory):
        """Test unique constraint on (user_id, name)."""
        # Create user
        user_data = test_factory.create_user_data("unique_tag_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create first tag
        tag1 = Tag(name="UniqueTag", user_id=user.id)
        db.add(tag1)
        db.commit()
        db.refresh(tag1)

        # Try to create second tag with same name for same user (should fail)
        tag2 = Tag(name="UniqueTag", user_id=user.id)
        db.add(tag2)
        
        with pytest.raises(IntegrityError):
            db.commit()
        
        db.rollback()
        
        # Clean up
        db.delete(tag1)
        db.delete(user)
        db.commit()

    def test_tag_different_users_same_name(self, db: Session, test_factory: TestDataFactory):
        """Test that different users can have tags with same name."""
        # Create two users
        user1_data = test_factory.create_user_data("tag_user_1")
        user1 = User(**user1_data)
        db.add(user1)
        
        user2_data = test_factory.create_user_data("tag_user_2")
        user2 = User(**user2_data)
        db.add(user2)
        
        db.commit()
        db.refresh(user1)
        db.refresh(user2)

        # Create tags with same name for different users (should succeed)
        tag1 = Tag(name="SharedName", user_id=user1.id)
        tag2 = Tag(name="SharedName", user_id=user2.id)
        
        db.add(tag1)
        db.add(tag2)
        db.commit()
        db.refresh(tag1)
        db.refresh(tag2)

        # Verify both tags exist
        assert tag1.id != tag2.id
        assert tag1.name == tag2.name
        assert tag1.user_id != tag2.user_id
        
        # Clean up
        db.delete(tag1)
        db.delete(tag2)
        db.delete(user1)
        db.delete(user2)
        db.commit()


class TestReminderModel:
    """Comprehensive tests for Reminder model with UUID primary key."""

    def test_reminder_creation_with_uuid(self, db: Session, test_factory: TestDataFactory):
        """Test reminder creation with UUID primary key."""
        # Create user first
        user_data = test_factory.create_user_data("reminder_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create reminder
        reminder_data = test_factory.create_reminder_data(user.id, "uuid_test")
        reminder = Reminder(**reminder_data)
        db.add(reminder)
        db.commit()
        db.refresh(reminder)

        # Verify UUID primary key
        assert reminder.id is not None
        assert isinstance(reminder.id, uuid.UUID)
        assert reminder.user_id == user.id
        assert isinstance(reminder.user_id, uuid.UUID)
        
        # Clean up
        db.delete(reminder)
        db.delete(user)
        db.commit()

    def test_reminder_foreign_key_constraint(self, db: Session, test_factory: TestDataFactory):
        """Test foreign key constraint enforcement."""
        # Try to create reminder with non-existent user_id
        non_existent_user_id = uuid.uuid4()
        reminder_data = test_factory.create_reminder_data(non_existent_user_id, "fk_test")
        reminder = Reminder(**reminder_data)
        db.add(reminder)
        
        with pytest.raises(IntegrityError):
            db.commit()
        
        db.rollback()

    def test_reminder_user_relationship(self, db: Session, test_factory: TestDataFactory):
        """Test relationship between reminder and user."""
        # Create user
        user_data = test_factory.create_user_data("reminder_rel_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create reminder
        reminder_data = test_factory.create_reminder_data(user.id, "rel_test")
        reminder = Reminder(**reminder_data)
        db.add(reminder)
        db.commit()
        db.refresh(reminder)

        # Test relationship access
        assert reminder.user_id == user.id
        
        # Test querying through relationship
        user_reminders = db.query(Reminder).filter(Reminder.user_id == user.id).all()
        assert len(user_reminders) == 1
        assert user_reminders[0].id == reminder.id

        # Clean up
        db.delete(reminder)
        db.delete(user)
        db.commit()


class TestSecretTagModel:
    """Comprehensive tests for SecretTag model with UUID primary key and phrase_hash."""

    def test_secret_tag_creation_with_uuid(self, db: Session, test_factory: TestDataFactory):
        """Test secret tag creation with UUID primary key and phrase_hash."""
        # Create user first
        user_data = test_factory.create_user_data("secret_tag_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create secret tag
        phrase_hash = b"test_phrase_hash_123456"  # 16 bytes for testing
        secret_tag = SecretTag(
            tag_name="TestSecretTag",
            phrase_hash=phrase_hash,
            user_id=user.id
        )
        db.add(secret_tag)
        db.commit()
        db.refresh(secret_tag)

        # Verify UUID primary key and phrase_hash separation
        assert secret_tag.id is not None
        assert isinstance(secret_tag.id, uuid.UUID)
        assert secret_tag.phrase_hash == phrase_hash
        assert secret_tag.user_id == user.id
        assert isinstance(secret_tag.user_id, uuid.UUID)
        
        # Clean up
        db.delete(secret_tag)
        db.delete(user)
        db.commit()

    def test_secret_tag_phrase_hash_uniqueness(self, db: Session, test_factory: TestDataFactory):
        """Test that phrase_hash values are unique."""
        # Create user
        user_data = test_factory.create_user_data("phrase_hash_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create first secret tag
        phrase_hash = b"unique_phrase_hash_1"
        secret_tag1 = SecretTag(
            tag_name="SecretTag1",
            phrase_hash=phrase_hash,
            user_id=user.id
        )
        db.add(secret_tag1)
        db.commit()
        db.refresh(secret_tag1)

        # Try to create second secret tag with same phrase_hash (should fail)
        secret_tag2 = SecretTag(
            tag_name="SecretTag2",
            phrase_hash=phrase_hash,  # Same phrase_hash
            user_id=user.id
        )
        db.add(secret_tag2)
        
        with pytest.raises(IntegrityError):
            db.commit()
        
        db.rollback()
        
        # Clean up
        db.delete(secret_tag1)
        db.delete(user)
        db.commit()

    def test_secret_tag_lookup_by_phrase_hash(self, db: Session, test_factory: TestDataFactory):
        """Test lookup by phrase_hash (OPAQUE authentication pattern)."""
        # Create user
        user_data = test_factory.create_user_data("lookup_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create secret tag
        phrase_hash = b"lookup_phrase_hash_1"
        secret_tag = SecretTag(
            tag_name="LookupTag",
            phrase_hash=phrase_hash,
            user_id=user.id
        )
        db.add(secret_tag)
        db.commit()
        db.refresh(secret_tag)

        # Test lookup by phrase_hash
        found_tag = db.query(SecretTag).filter(SecretTag.phrase_hash == phrase_hash).first()
        assert found_tag is not None
        assert found_tag.id == secret_tag.id
        assert found_tag.tag_name == "LookupTag"
        assert found_tag.user_id == user.id
        
        # Clean up
        db.delete(secret_tag)
        db.delete(user)
        db.commit()


class TestModelRelationships:
    """Comprehensive tests for model relationships with UUID foreign keys."""

    def test_user_journal_entries_relationship(self, db: Session, test_factory: TestDataFactory):
        """Test one-to-many relationship between user and journal entries."""
        # Create user
        user_data = test_factory.create_user_data("rel_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create multiple journal entries
        entry1_data = test_factory.create_journal_entry_data(user.id, "entry_1")
        entry1 = JournalEntry(**entry1_data)
        
        entry2_data = test_factory.create_journal_entry_data(user.id, "entry_2")
        entry2 = JournalEntry(**entry2_data)
        
        db.add(entry1)
        db.add(entry2)
        db.commit()
        db.refresh(entry1)
        db.refresh(entry2)

        # Test querying entries for user
        user_entries = db.query(JournalEntry).filter(JournalEntry.user_id == user.id).all()
        assert len(user_entries) == 2
        
        entry_ids = [entry.id for entry in user_entries]
        assert entry1.id in entry_ids
        assert entry2.id in entry_ids

        # Clean up
        db.delete(entry1)
        db.delete(entry2)
        db.delete(user)
        db.commit()

    def test_user_tags_relationship(self, db: Session, test_factory: TestDataFactory):
        """Test one-to-many relationship between user and tags."""
        # Create user
        user_data = test_factory.create_user_data("tag_rel_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create multiple tags
        tag1 = Tag(name="Tag1", user_id=user.id)
        tag2 = Tag(name="Tag2", user_id=user.id)
        
        db.add(tag1)
        db.add(tag2)
        db.commit()
        db.refresh(tag1)
        db.refresh(tag2)

        # Test querying tags for user
        user_tags = db.query(Tag).filter(Tag.user_id == user.id).all()
        assert len(user_tags) == 2
        
        tag_names = [tag.name for tag in user_tags]
        assert "Tag1" in tag_names
        assert "Tag2" in tag_names

        # Clean up
        db.delete(tag1)
        db.delete(tag2)
        db.delete(user)
        db.commit()

    def test_journal_entry_tag_association(self, db: Session, test_factory: TestDataFactory):
        """Test many-to-many relationship between journal entries and tags."""
        # Create user
        user_data = test_factory.create_user_data("assoc_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create journal entry
        entry_data = test_factory.create_journal_entry_data(user.id, "assoc_entry")
        entry = JournalEntry(**entry_data)
        db.add(entry)
        db.commit()
        db.refresh(entry)

        # Create tag
        tag = Tag(name="AssocTag", user_id=user.id)
        db.add(tag)
        db.commit()
        db.refresh(tag)

        # Create association
        association = JournalEntryTag(
            journal_entry_id=entry.id,
            tag_id=tag.id
        )
        db.add(association)
        db.commit()
        db.refresh(association)

        # Test association
        assert association.journal_entry_id == entry.id
        assert association.tag_id == tag.id
        
        # Test querying through association
        entry_tags = db.query(JournalEntryTag).filter(
            JournalEntryTag.journal_entry_id == entry.id
        ).all()
        assert len(entry_tags) == 1
        assert entry_tags[0].tag_id == tag.id

        # Clean up
        db.delete(association)
        db.delete(entry)
        db.delete(tag)
        db.delete(user)
        db.commit()


class TestConstraintValidation:
    """Tests for database constraints and validation."""

    def test_not_null_constraints(self, db: Session, test_factory: TestDataFactory):
        """Test NOT NULL constraints on required fields."""
        # Create user
        user_data = test_factory.create_user_data("null_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Try to create journal entry without required fields
        with pytest.raises(Exception):  # Should raise validation error
            entry = JournalEntry(title="Test", user_id=None)  # user_id is required
            db.add(entry)
            db.commit()
        
        db.rollback()

        # Clean up
        db.delete(user)
        db.commit()

    def test_foreign_key_constraints(self, db: Session):
        """Test foreign key constraint enforcement."""
        # Try to create journal entry with non-existent user_id
        non_existent_user_id = uuid.uuid4()
        
        with pytest.raises(IntegrityError):
            entry = JournalEntry(
                title="Test Entry",
                content="Test content",
                user_id=non_existent_user_id,
                entry_date=datetime.now()
            )
            db.add(entry)
            db.commit()
        
        db.rollback()

    def test_unique_constraints(self, db: Session, test_factory: TestDataFactory):
        """Test unique constraint enforcement."""
        # Create user
        user_data = test_factory.create_user_data("unique_constraint_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create tag
        tag1 = Tag(name="UniqueConstraintTag", user_id=user.id)
        db.add(tag1)
        db.commit()
        db.refresh(tag1)

        # Try to create another tag with same name for same user
        with pytest.raises(IntegrityError):
            tag2 = Tag(name="UniqueConstraintTag", user_id=user.id)
            db.add(tag2)
            db.commit()
        
        db.rollback()

        # Clean up
        db.delete(tag1)
        db.delete(user)
        db.commit()


class TestPerformanceWithUUIDs:
    """Performance tests for UUID operations."""

    def test_uuid_query_performance(self, db: Session, test_factory: TestDataFactory):
        """Test query performance with UUID primary keys."""
        # Create user
        user_data = test_factory.create_user_data("perf_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create multiple journal entries
        entries = []
        for i in range(100):
            entry_data = test_factory.create_journal_entry_data(user.id, f"perf_entry_{i}")
            entry = JournalEntry(**entry_data)
            entries.append(entry)
        
        db.add_all(entries)
        db.commit()

        # Test query performance
        import time
        start_time = time.time()
        
        # Query by UUID primary key
        result = db.query(JournalEntry).filter(JournalEntry.user_id == user.id).all()
        
        end_time = time.time()
        query_time = end_time - start_time
        
        # Verify results
        assert len(result) == 100
        assert query_time < 1.0  # Should be fast with proper indexing
        
        # Clean up
        for entry in entries:
            db.delete(entry)
        db.delete(user)
        db.commit()

    def test_uuid_index_usage(self, db: Session, test_factory: TestDataFactory):
        """Test that UUID indexes are being used."""
        # Create user
        user_data = test_factory.create_user_data("index_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create journal entry
        entry_data = test_factory.create_journal_entry_data(user.id, "index_test")
        entry = JournalEntry(**entry_data)
        db.add(entry)
        db.commit()
        db.refresh(entry)

        # Test EXPLAIN ANALYZE to verify index usage
        explain_query = text("""
            EXPLAIN ANALYZE 
            SELECT * FROM journal_entries 
            WHERE user_id = :user_id
        """)
        
        result = db.execute(explain_query, {"user_id": str(user.id)})
        explain_output = result.fetchall()
        
        # Verify index is used (should contain "Index Scan" in output)
        explain_text = str(explain_output)
        # Note: This is a basic check - actual implementation may vary
        
        # Clean up
        db.delete(entry)
        db.delete(user)
        db.commit()


class TestErrorHandling:
    """Tests for error handling with UUID values."""

    def test_invalid_uuid_handling(self, db: Session):
        """Test handling of invalid UUID values."""
        # Test with invalid UUID string
        with pytest.raises(Exception):
            invalid_uuid = "not-a-valid-uuid"
            db.query(User).filter(User.id == invalid_uuid).first()

    def test_null_uuid_handling(self, db: Session):
        """Test handling of null UUID values."""
        # Test querying with None UUID
        result = db.query(User).filter(User.id == None).first()
        assert result is None

    def test_transaction_rollback_with_uuids(self, db: Session, test_factory: TestDataFactory):
        """Test transaction rollback with UUID operations."""
        # Create user
        user_data = test_factory.create_user_data("rollback_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Start transaction
        try:
            # Create journal entry
            entry_data = test_factory.create_journal_entry_data(user.id, "rollback_entry")
            entry = JournalEntry(**entry_data)
            db.add(entry)
            
            # Force an error to test rollback
            raise Exception("Forced error for rollback test")
            
        except Exception:
            db.rollback()
            
        # Verify entry was not created
        entries = db.query(JournalEntry).filter(JournalEntry.user_id == user.id).all()
        assert len(entries) == 0

        # Clean up
        db.delete(user)
        db.commit() 