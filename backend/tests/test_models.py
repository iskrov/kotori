from datetime import datetime, time

from sqlalchemy.orm import Session

from app.models.journal_entry import JournalEntry
from app.models.reminder import Reminder
from app.models.tag import Tag, JournalEntryTag
from app.models.user import User


def test_user_model(db: Session):
    """Test the User model"""
    # Create a user instance
    user = User(
        email="test@example.com",
        full_name="Test User",
        hashed_password="hashed_password",
        is_active=True,
    )

    # Add to DB and commit
    db.add(user)
    db.commit()
    db.refresh(user)

    # Assert values
    assert user.id is not None
    assert user.email == "test@example.com"
    assert user.full_name == "Test User"
    assert user.hashed_password == "hashed_password"
    assert user.is_active is True
    assert user.created_at is not None
    assert user.updated_at is not None

    # Clean up
    db.delete(user)
    db.commit()


def test_journal_entry_model(db: Session):
    """Test the JournalEntry model"""
    # Create a user for the journal entry
    user = User(
        email="journal_test@example.com",
        full_name="Journal Test User",
        hashed_password="password",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Create a journal entry with datetime instead of date
    entry_date = datetime.now()
    entry = JournalEntry(
        title="Test Entry",
        content="This is test content",
        entry_date=entry_date,
        user_id=user.id,
    )

    # Add to DB and commit
    db.add(entry)
    db.commit()
    db.refresh(entry)

    # Assert values
    assert entry.id is not None
    assert entry.title == "Test Entry"
    assert entry.content == "This is test content"
    # Compare just the date part since SQLite may adjust the exact time
    assert entry.entry_date.date() == entry_date.date()
    assert entry.user_id == user.id
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


def test_reminder_model(db: Session):
    """Test the Reminder model"""
    # Create a user for the reminder
    user = User(
        email="reminder_test@example.com",
        full_name="Reminder Test User",
        hashed_password="password",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Create a reminder with proper datetime object for time field
    reminder_time = datetime.now().replace(hour=8, minute=0, second=0, microsecond=0)
    reminder = Reminder(
        title="Test Reminder",
        message="Remember to do this",
        time=reminder_time,
        frequency="daily",
        is_active=True,
        user_id=user.id,
    )

    # Add to DB and commit
    db.add(reminder)
    db.commit()
    db.refresh(reminder)

    # Assert values
    assert reminder.id is not None
    assert reminder.title == "Test Reminder"
    assert reminder.message == "Remember to do this"
    assert reminder.time.hour == 8
    assert reminder.time.minute == 0
    assert reminder.frequency == "daily"
    assert reminder.is_active is True
    assert reminder.user_id == user.id
    assert reminder.created_at is not None
    assert reminder.updated_at is not None

    # Clean up
    db.delete(reminder)
    db.delete(user)
    db.commit()


def test_relationships(db: Session):
    """Test relationships between models"""
    # Create a user
    user = User(
        email="relation_test@example.com",
        full_name="Relation Test User",
        hashed_password="password",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Create a journal entry for the user
    entry = JournalEntry(
        title="Relationship Test Entry",
        content="Testing relationships",
        entry_date=datetime.now(),
        user_id=user.id,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    # Create tags
    tag1 = Tag(name="TestTag1")
    tag2 = Tag(name="TestTag2")
    db.add(tag1)
    db.add(tag2)
    db.commit()
    db.refresh(tag1)
    db.refresh(tag2)

    # Associate tags with the entry using JournalEntryTag
    entry_tag1 = JournalEntryTag(entry_id=entry.id, tag_id=tag1.id)
    entry_tag2 = JournalEntryTag(entry_id=entry.id, tag_id=tag2.id)
    db.add(entry_tag1)
    db.add(entry_tag2)
    db.commit()
    db.refresh(entry)

    # Test journal entry - user relationship
    assert entry.user_id == user.id

    # Test journal entry - tags relationship
    assert len(entry.tags) == 2
    tag_ids = [tag_rel.tag_id for tag_rel in entry.tags]
    assert tag1.id in tag_ids
    assert tag2.id in tag_ids

    # Create a reminder for the user
    reminder_time = datetime.now().replace(hour=10, minute=0, second=0, microsecond=0)
    reminder = Reminder(
        title="Relationship Test Reminder",
        message="Testing user-reminder relationship",
        time=reminder_time,
        frequency="daily",
        is_active=True,
        user_id=user.id,
    )
    db.add(reminder)
    db.commit()

    # Clean up
    db.delete(reminder)
    db.delete(entry_tag1)
    db.delete(entry_tag2)
    db.delete(entry)
    db.delete(tag1)
    db.delete(tag2)
    db.delete(user)
    db.commit()
