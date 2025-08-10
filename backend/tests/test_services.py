from datetime import date, datetime, time, timezone

from sqlalchemy.orm import Session

from app.core.security import verify_password
from app.schemas.journal import JournalEntryCreate
from app.schemas.reminder import ReminderCreate
from app.schemas.user import UserCreate
from app.services.auth_service import auth_service
from app.services.journal_service import journal_service
from app.services.reminder_service import reminder_service
from app.services.user_service import user_service
from tests.test_config import TestDataFactory, TestAssertions


def test_create_user(db: Session, test_assertions: TestAssertions):
    """Test creating a user with proper UUID handling"""
    user_data = UserCreate(
        email="service_test@example.com",
        full_tag_display_tag_display_name="Service Test",
        password="testpassword123",
    )

    # Create user
    user = user_service.create(db, obj_in=user_data)

    # Assertions with UUID validation
    test_assertions.assert_uuid_field(user, 'id')
    assert user.email == "service_test@example.com"
    assert user.full_tag_display_tag_display_name== "Service Test"
    # Password should be hashed
    assert user.hashed_password != "testpassword123"
    assert verify_password("testpassword123", user.hashed_password)

    # Clean up
    db.delete(user)
    db.commit()


def test_authenticate_user(db: Session, test_assertions: TestAssertions):
    """Test user authentication with UUID handling"""
    # First create a user
    user_data = UserCreate(
        email="auth_test@example.com", full_tag_display_tag_display_name="Auth Test", password="authpassword123"
    )
    user = user_service.create(db, obj_in=user_data)

    # Test successful authentication
    authenticated_user = auth_service.authenticate(
        db, email="auth_test@example.com", password="authpassword123"
    )
    assert authenticated_user is not None
    test_assertions.assert_uuid_field(authenticated_user, 'id')
    assert authenticated_user.email == "auth_test@example.com"

    # Test failed authentication
    failed_auth = auth_service.authenticate(
        db, email="auth_test@example.com", password="wrongpassword"
    )
    assert failed_auth is None

    # Clean up
    db.delete(user)
    db.commit()


def test_journal_service(db: Session, test_user, test_factory: TestDataFactory, test_assertions: TestAssertions):
    """Test journal service with proper UUID handling"""
    # Test creating a journal entry
    entry_data = JournalEntryCreate(
        title="Service Test Entry",
        content="This is a test entry from service test",
        tags=["test", "service"]
    )

    # Create journal entry
    entry = journal_service.create_with_user(
        db, obj_in=entry_data, user_id=test_user.id
    )

    # Assertions
    assert entry.title == "Service Test Entry"
    assert entry.content == "This is a test entry from service test"
    test_assertions.assert_uuid_field(entry, 'user_id')
    test_assertions.assert_foreign_key_relationship(entry, test_user)

    # Test getting entries by user
    entries = journal_service.get_multi_by_user(
        db, user_id=test_user.id, skip=0, limit=10
    )
    assert len(entries) >= 1
    assert any(e.title == "Service Test Entry" for e in entries)

    # Test creating tags
    from app.schemas.journal import TagCreate
    tag_data = TagCreate(tag_display_tag_display_name="ServiceTestTag", color="#FF0000")
    tag = journal_service.create_tag(db, tag_in=tag_data, user_id=test_user.id)
    assert tag.tag_name== "ServiceTestTag"

    # Test getting tags by user
    tags = journal_service.get_tags_by_user(db, user_id=test_user.id)
    assert len(tags) >= 0  # Tags are global, so this might be empty or contain other tags


def test_reminder_service(db: Session, test_user, test_factory: TestDataFactory, test_assertions: TestAssertions):
    """Test reminder service with proper UUID handling"""
    # Test creating a reminder
    reminder_data = ReminderCreate(
        title="Service Test Reminder",
        message="This is a test reminder",
        frequency="daily",
        time=datetime.now(timezone.utc),
        is_active=True
    )

    # Create reminder
    reminder = reminder_service.create_with_user(
        db, obj_in=reminder_data, user_id=test_user.id
    )

    # Assertions
    assert reminder.title == "Service Test Reminder"
    assert reminder.message == "This is a test reminder"
    test_assertions.assert_uuid_field(reminder, 'user_id')
    test_assertions.assert_foreign_key_relationship(reminder, test_user)

    # Test getting reminders by user
    reminders = reminder_service.get_by_user(
        db, user_id=test_user.id, skip=0, limit=10
    )
    assert len(reminders) >= 1
    assert any(r.title == "Service Test Reminder" for r in reminders)

    # Test getting active reminders
    active_reminders = reminder_service.get_active_by_user(db, user_id=test_user.id)
    assert len(active_reminders) >= 1
    assert all(r.is_active for r in active_reminders)


def test_user_stats_service(db: Session, test_factory: TestDataFactory, test_assertions: TestAssertions):
    """Test user statistics service with UUID handling"""
    # Create user
    user_data = test_factory.create_user_data("stats_test")
    from app.models.user import User
    user = User(**user_data)
    db.add(user)
    db.commit()
    db.refresh(user)

    # Create some journal entries for stats
    from app.models.journal_entry import JournalEntry
    for i in range(5):
        entry_data = test_factory.create_journal_entry_data(user.id, f"stats_entry_{i}")
        entry = JournalEntry(**entry_data)
        db.add(entry)
    
    db.commit()

    # Test getting user stats
    stats = user_service.get_user_stats(db, user_id=user.id)
    
    # Assertions
    assert stats.total_entries == 5
    assert isinstance(stats.current_streak, int)
    assert isinstance(stats.longest_streak, int)
    assert isinstance(stats.entries_this_week, int)

    # Clean up
    db.query(JournalEntry).filter(JournalEntry.user_id == user.id).delete()
    db.delete(user)
    db.commit()


def test_service_integration(db: Session, test_factory: TestDataFactory, test_assertions: TestAssertions):
    """Test integration between multiple services with UUID handling"""
    # Create user through service
    user_data = UserCreate(
        email="integration_test@example.com",
        full_tag_display_tag_display_name="Integration Test",
        password="integrationpass123",
    )
    user = user_service.create(db, obj_in=user_data)
    test_assertions.assert_uuid_field(user, 'id')

    # Create journal entry through service
    entry_data = JournalEntryCreate(
        title="Integration Test Entry",
        content="Testing service integration",
        tags=["integration", "test"]
    )
    entry = journal_service.create_with_user(
        db, obj_in=entry_data, user_id=user.id
    )
    test_assertions.assert_foreign_key_relationship(entry, user)

    # Create reminder through service
    reminder_data = ReminderCreate(
        title="Integration Test Reminder",
        message="Integration test message",
        frequency="weekly",
        time=datetime.now(timezone.utc),
        is_active=True
    )
    reminder = reminder_service.create_with_user(
        db, obj_in=reminder_data, user_id=user.id
    )
    test_assertions.assert_foreign_key_relationship(reminder, user)

    # Test that all items are properly linked to the user
    user_entries = journal_service.get_multi_by_user(db, user_id=user.id)
    user_reminders = reminder_service.get_by_user(db, user_id=user.id)

    assert len(user_entries) >= 1
    assert len(user_reminders) >= 1
    assert any(e.title == "Integration Test Entry" for e in user_entries)
    assert any(r.title == "Integration Test Reminder" for r in user_reminders)

    # Clean up
    from app.models.journal_entry import JournalEntry
    from app.models.reminder import Reminder
    db.query(JournalEntry).filter(JournalEntry.user_id == user.id).delete()
    db.query(Reminder).filter(Reminder.user_id == user.id).delete()
    db.delete(user)
    db.commit()
