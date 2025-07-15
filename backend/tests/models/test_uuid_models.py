"""
UUID Model Tests

Focused tests for UUID functionality in all models, designed to complement
the existing test_models.py file.
"""

import pytest
import uuid
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.user import User
from app.models.journal_entry import JournalEntry
from app.models.tag import Tag
from app.models.reminder import Reminder
from app.models.secret_tag_opaque import SecretTag
from tests.test_config import TestDataFactory, TestAssertions


class TestUUIDPrimaryKeys:
    """Test UUID primary key functionality across all models."""

    def test_user_uuid_primary_key(self, db: Session, test_factory: TestDataFactory, test_assertions: TestAssertions):
        """Test User model UUID primary key."""
        user_data = test_factory.create_user_data("uuid_pk_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Verify UUID primary key
        test_assertions.assert_uuid_field(user, 'id')
        assert user.id == user_data['id']
        
        # Clean up
        db.delete(user)
        db.commit()

    def test_journal_entry_uuid_primary_key(self, db: Session, test_factory: TestDataFactory, test_assertions: TestAssertions):
        """Test JournalEntry model UUID primary key."""
        # Create user first
        user_data = test_factory.create_user_data("journal_uuid_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create journal entry
        entry_data = test_factory.create_journal_entry_data(user.id, "uuid_pk_test")
        entry = JournalEntry(**entry_data)
        db.add(entry)
        db.commit()
        db.refresh(entry)

        # Verify UUID primary key and foreign key
        test_assertions.assert_uuid_field(entry, 'id')
        test_assertions.assert_uuid_field(entry, 'user_id')
        test_assertions.assert_foreign_key_relationship(entry, user)
        
        # Clean up
        db.delete(entry)
        db.delete(user)
        db.commit()

    def test_tag_uuid_primary_key(self, db: Session, test_factory: TestDataFactory, test_assertions: TestAssertions):
        """Test Tag model UUID primary key."""
        # Create user first
        user_data = test_factory.create_user_data("tag_uuid_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create tag
        tag = Tag(name="UUIDTestTag", user_id=user.id)
        db.add(tag)
        db.commit()
        db.refresh(tag)

        # Verify UUID primary key and foreign key
        test_assertions.assert_uuid_field(tag, 'id')
        test_assertions.assert_uuid_field(tag, 'user_id')
        test_assertions.assert_foreign_key_relationship(tag, user)
        
        # Clean up
        db.delete(tag)
        db.delete(user)
        db.commit()

    def test_reminder_uuid_primary_key(self, db: Session, test_factory: TestDataFactory, test_assertions: TestAssertions):
        """Test Reminder model UUID primary key."""
        # Create user first
        user_data = test_factory.create_user_data("reminder_uuid_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create reminder
        reminder_data = test_factory.create_reminder_data(user.id, "uuid_pk_test")
        reminder = Reminder(**reminder_data)
        db.add(reminder)
        db.commit()
        db.refresh(reminder)

        # Verify UUID primary key and foreign key
        test_assertions.assert_uuid_field(reminder, 'id')
        test_assertions.assert_uuid_field(reminder, 'user_id')
        test_assertions.assert_foreign_key_relationship(reminder, user)
        
        # Clean up
        db.delete(reminder)
        db.delete(user)
        db.commit()

    def test_secret_tag_uuid_primary_key(self, db: Session, test_factory: TestDataFactory, test_assertions: TestAssertions):
        """Test SecretTag model UUID primary key with phrase_hash separation."""
        # Create user first
        user_data = test_factory.create_user_data("secret_tag_uuid_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create secret tag
        phrase_hash = b"test_phrase_hash_16b"  # 16 bytes
        secret_tag = SecretTag(
            tag_name="UUIDSecretTag",
            phrase_hash=phrase_hash,
            user_id=user.id
        )
        db.add(secret_tag)
        db.commit()
        db.refresh(secret_tag)

        # Verify UUID primary key and foreign key
        test_assertions.assert_uuid_field(secret_tag, 'id')
        test_assertions.assert_uuid_field(secret_tag, 'user_id')
        test_assertions.assert_foreign_key_relationship(secret_tag, user)
        
        # Verify phrase_hash is separate from primary key
        assert secret_tag.phrase_hash == phrase_hash
        assert isinstance(secret_tag.id, uuid.UUID)
        assert secret_tag.id != phrase_hash
        
        # Clean up
        db.delete(secret_tag)
        db.delete(user)
        db.commit()


class TestUUIDForeignKeys:
    """Test UUID foreign key relationships."""

    def test_journal_entry_user_foreign_key(self, db: Session, test_factory: TestDataFactory):
        """Test foreign key relationship between journal entry and user."""
        # Create user
        user_data = test_factory.create_user_data("fk_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create journal entry
        entry_data = test_factory.create_journal_entry_data(user.id, "fk_test")
        entry = JournalEntry(**entry_data)
        db.add(entry)
        db.commit()
        db.refresh(entry)

        # Verify foreign key relationship
        assert entry.user_id == user.id
        assert isinstance(entry.user_id, uuid.UUID)
        
        # Test querying by foreign key
        entries = db.query(JournalEntry).filter(JournalEntry.user_id == user.id).all()
        assert len(entries) == 1
        assert entries[0].id == entry.id

        # Clean up
        db.delete(entry)
        db.delete(user)
        db.commit()

    def test_foreign_key_constraint_violation(self, db: Session, test_factory: TestDataFactory):
        """Test foreign key constraint violation with UUID."""
        # Try to create journal entry with non-existent user_id
        non_existent_user_id = uuid.uuid4()
        entry_data = test_factory.create_journal_entry_data(non_existent_user_id, "fk_violation_test")
        entry = JournalEntry(**entry_data)
        db.add(entry)

        # Should raise IntegrityError
        with pytest.raises(IntegrityError):
            db.commit()
        
        db.rollback()


class TestUUIDConstraints:
    """Test UUID-related constraints."""

    def test_uuid_primary_key_uniqueness(self, db: Session, test_factory: TestDataFactory):
        """Test that UUID primary keys are unique."""
        # Create first user
        user1_data = test_factory.create_user_data("unique_test_1")
        user1 = User(**user1_data)
        db.add(user1)
        db.commit()
        db.refresh(user1)

        # Try to create second user with same UUID
        user2_data = test_factory.create_user_data("unique_test_2")
        user2_data['id'] = user1.id  # Use same UUID
        user2 = User(**user2_data)
        db.add(user2)

        # Should raise IntegrityError
        with pytest.raises(IntegrityError):
            db.commit()
        
        db.rollback()

        # Clean up
        db.delete(user1)
        db.commit()

    def test_secret_tag_phrase_hash_uniqueness(self, db: Session, test_factory: TestDataFactory):
        """Test that phrase_hash values are unique in SecretTag."""
        # Create user
        user_data = test_factory.create_user_data("phrase_hash_unique_test")
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

        # Try to create second secret tag with same phrase_hash
        secret_tag2 = SecretTag(
            tag_name="SecretTag2",
            phrase_hash=phrase_hash,  # Same phrase_hash
            user_id=user.id
        )
        db.add(secret_tag2)

        # Should raise IntegrityError
        with pytest.raises(IntegrityError):
            db.commit()
        
        db.rollback()

        # Clean up
        db.delete(secret_tag1)
        db.delete(user)
        db.commit()

    def test_tag_user_name_uniqueness(self, db: Session, test_factory: TestDataFactory):
        """Test unique constraint on (user_id, name) in Tag model."""
        # Create user
        user_data = test_factory.create_user_data("tag_unique_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create first tag
        tag1 = Tag(name="UniqueTagName", user_id=user.id)
        db.add(tag1)
        db.commit()
        db.refresh(tag1)

        # Try to create second tag with same name for same user
        tag2 = Tag(name="UniqueTagName", user_id=user.id)
        db.add(tag2)

        # Should raise IntegrityError
        with pytest.raises(IntegrityError):
            db.commit()
        
        db.rollback()

        # Clean up
        db.delete(tag1)
        db.delete(user)
        db.commit()


class TestUUIDQueryPerformance:
    """Test query performance with UUID primary keys."""

    def test_uuid_primary_key_query_performance(self, db: Session, test_factory: TestDataFactory):
        """Test that UUID primary key queries are performant."""
        # Create user
        user_data = test_factory.create_user_data("perf_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create multiple journal entries
        entries = []
        for i in range(50):
            entry_data = test_factory.create_journal_entry_data(user.id, f"perf_entry_{i}")
            entry = JournalEntry(**entry_data)
            entries.append(entry)
        
        db.add_all(entries)
        db.commit()

        # Test query performance
        import time
        start_time = time.time()
        
        # Query by UUID primary key
        result = db.query(JournalEntry).filter(JournalEntry.id == entries[0].id).first()
        
        end_time = time.time()
        query_time = end_time - start_time

        # Verify result and performance
        assert result is not None
        assert result.id == entries[0].id
        assert query_time < 0.1  # Should be very fast

        # Test foreign key query performance
        start_time = time.time()
        
        user_entries = db.query(JournalEntry).filter(JournalEntry.user_id == user.id).all()
        
        end_time = time.time()
        fk_query_time = end_time - start_time

        # Verify foreign key query results and performance
        assert len(user_entries) == 50
        assert fk_query_time < 0.5  # Should be fast with proper indexing

        # Clean up
        for entry in entries:
            db.delete(entry)
        db.delete(user)
        db.commit()

    def test_uuid_string_conversion(self, db: Session, test_factory: TestDataFactory, test_assertions: TestAssertions):
        """Test UUID string conversion for API compatibility."""
        # Create user
        user_data = test_factory.create_user_data("string_conversion_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Test UUID string conversion
        uuid_string = str(user.id)
        test_assertions.assert_uuid_string(uuid_string)

        # Test querying with UUID string
        parsed_uuid = uuid.UUID(uuid_string)
        retrieved_user = db.query(User).filter(User.id == parsed_uuid).first()
        assert retrieved_user is not None
        assert retrieved_user.id == user.id

        # Clean up
        db.delete(user)
        db.commit()


class TestUUIDErrorHandling:
    """Test error handling with UUID operations."""

    def test_invalid_uuid_format(self, db: Session):
        """Test handling of invalid UUID format."""
        # Test with invalid UUID string
        with pytest.raises(ValueError):
            invalid_uuid = uuid.UUID("not-a-valid-uuid")

    def test_null_uuid_query(self, db: Session):
        """Test querying with None UUID."""
        # Test querying with None
        result = db.query(User).filter(User.id == None).first()
        assert result is None

    def test_uuid_type_validation(self, db: Session, test_factory: TestDataFactory):
        """Test UUID type validation in model creation."""
        # Create user with proper UUID
        user_data = test_factory.create_user_data("type_validation_test")
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Verify UUID type
        assert isinstance(user.id, uuid.UUID)
        assert isinstance(user_data['id'], uuid.UUID)

        # Clean up
        db.delete(user)
        db.commit() 