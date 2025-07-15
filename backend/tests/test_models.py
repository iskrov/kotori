from datetime import datetime, time

from sqlalchemy.orm import Session

from app.models.journal_entry import JournalEntry
from app.models.reminder import Reminder
from app.models.tag import Tag, JournalEntryTag
from app.models.user import User
from tests.test_config import TestDataFactory, TestAssertions


def test_user_model(db: Session, test_factory: TestDataFactory, test_assertions: TestAssertions):
    """Test the User model with proper UUID handling"""
    # Create a user instance using test factory
    user_data = test_factory.create_user_data("model_test")
    user = User(**user_data)

    # Add to DB and commit
    db.add(user)
    db.commit()
    db.refresh(user)

    # Assert values with UUID validation
    test_assertions.assert_uuid_field(user, 'id')
    assert user.email == "model_test@example.com"
    assert user.full_name == "Test User Model_Test"
    assert user.hashed_password == "hashed_password"
    assert user.is_active is True
    assert user.created_at is not None
    assert user.updated_at is not None

    # Clean up
    db.delete(user)
    db.commit()


def test_journal_entry_model(db: Session, test_factory: TestDataFactory, test_assertions: TestAssertions):
    """Test the JournalEntry model with proper UUID foreign key handling"""
    # Create a user for the journal entry
    user_data = test_factory.create_user_data("journal_test")
    user = User(**user_data)
    db.add(user)
    db.commit()
    db.refresh(user)

    # Create a journal entry using test factory
    entry_data = test_factory.create_journal_entry_data(user.id, "model_test")
    entry = JournalEntry(**entry_data)

    # Add to DB and commit
    db.add(entry)
    db.commit()
    db.refresh(entry)

    # Assert values with UUID validation
    assert entry.id is not None
    assert entry.title == "Test Entry Model_Test"
    assert entry.content == "Test content for model_test"
    # Compare just the date part since there might be small time differences
    assert entry.entry_date.date() == entry_data['entry_date'].date()
    test_assertions.assert_uuid_field(entry, 'user_id')
    test_assertions.assert_foreign_key_relationship(entry, user)
    assert entry.created_at is not None
    assert entry.updated_at is not None

    # Clean up
    db.delete(entry)
    db.delete(user)
    db.commit()


def test_tag_model(db: Session):
    """Test the Tag model"""
    # Create a tag
    tag = Tag(name="TestTag")

    # Add to DB and commit
    db.add(tag)
    db.commit()
    db.refresh(tag)

    # Assert values
    assert tag.id is not None
    assert tag.name == "TestTag"
    assert tag.created_at is not None
    assert tag.updated_at is not None

    # Clean up
    db.delete(tag)
    db.commit()


def test_reminder_model(db: Session, test_factory: TestDataFactory, test_assertions: TestAssertions):
    """Test the Reminder model with proper UUID foreign key handling"""
    # Create a user for the reminder
    user_data = test_factory.create_user_data("reminder_test")
    user = User(**user_data)
    db.add(user)
    db.commit()
    db.refresh(user)

    # Create a reminder using test factory
    reminder_data = test_factory.create_reminder_data(user.id, "model_test")
    reminder = Reminder(**reminder_data)

    # Add to DB and commit
    db.add(reminder)
    db.commit()
    db.refresh(reminder)

    # Assert values with UUID validation
    assert reminder.id is not None
    assert reminder.title == "Test Reminder Model_Test"
    assert reminder.message == "Test message for model_test"
    assert reminder.frequency == reminder_data['frequency']
    assert reminder.time.date() == reminder_data['time'].date()
    test_assertions.assert_uuid_field(reminder, 'user_id')
    test_assertions.assert_foreign_key_relationship(reminder, user)
    assert reminder.is_active is True
    assert reminder.created_at is not None
    assert reminder.updated_at is not None

    # Clean up
    db.delete(reminder)
    db.delete(user)
    db.commit()


def test_relationships(db: Session, test_factory: TestDataFactory, test_assertions: TestAssertions):
    """Test model relationships with proper UUID handling"""
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

    # Create tag
    tag = Tag(name="RelationshipTag")
    db.add(tag)
    db.commit()
    db.refresh(tag)

    # Create journal entry tag association
    entry_tag = JournalEntryTag(journal_entry_id=entry.id, tag_id=tag.id)
    db.add(entry_tag)
    db.commit()
    db.refresh(entry_tag)

    # Test relationships
    assert entry_tag.journal_entry_id == entry.id
    assert entry_tag.tag_id == tag.id
    test_assertions.assert_foreign_key_relationship(entry, user)

    # Test querying through relationships
    retrieved_entry = db.query(JournalEntry).filter(JournalEntry.user_id == user.id).first()
    assert retrieved_entry is not None
    assert retrieved_entry.id == entry.id

    # Clean up
    db.delete(entry_tag)
    db.delete(entry)
    db.delete(tag)
    db.delete(user)
    db.commit()


def test_uuid_field_validation(db: Session, test_factory: TestDataFactory, test_assertions: TestAssertions):
    """Test that UUID fields are properly validated and handled"""
    # Create user with UUID
    user_data = test_factory.create_user_data("uuid_test")
    user = User(**user_data)
    db.add(user)
    db.commit()
    db.refresh(user)

    # Validate UUID field
    test_assertions.assert_uuid_field(user, 'id')
    
    # Test UUID string conversion
    test_assertions.assert_uuid_string(str(user.id))

    # Create journal entry with UUID foreign key
    entry_data = test_factory.create_journal_entry_data(user.id, "uuid_test")
    entry = JournalEntry(**entry_data)
    db.add(entry)
    db.commit()
    db.refresh(entry)

    # Validate UUID foreign key
    test_assertions.assert_uuid_field(entry, 'user_id')
    test_assertions.assert_foreign_key_relationship(entry, user)

    # Clean up
    db.delete(entry)
    db.delete(user)
    db.commit()


def test_timestamp_consistency(db: Session, test_factory: TestDataFactory):
    """Test that timestamp fields are consistent across models"""
    # Create user
    user_data = test_factory.create_user_data("timestamp_test")
    user = User(**user_data)
    db.add(user)
    db.commit()
    db.refresh(user)

    # Validate timestamps are timezone-aware
    assert user.created_at is not None
    assert user.updated_at is not None
    assert user.created_at.tzinfo is not None
    assert user.updated_at.tzinfo is not None

    # Create journal entry
    entry_data = test_factory.create_journal_entry_data(user.id, "timestamp_test")
    entry = JournalEntry(**entry_data)
    db.add(entry)
    db.commit()
    db.refresh(entry)

    # Validate entry timestamps
    assert entry.created_at is not None
    assert entry.updated_at is not None
    assert entry.created_at.tzinfo is not None
    
    # Clean up
    db.delete(entry)
    db.delete(user)
    db.commit()
