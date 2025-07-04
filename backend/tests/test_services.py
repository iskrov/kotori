from datetime import date, datetime, time

from sqlalchemy.orm import Session

from app.core.security import verify_password
from app.schemas.journal import JournalEntryCreate
from app.schemas.reminder import ReminderCreate
from app.schemas.user import UserCreate
from app.services.auth_service import auth_service
from app.services.journal_service import journal_service
from app.services.reminder_service import reminder_service
from app.services.user_service import user_service


def test_create_user(db: Session):
    """Test creating a user"""
    user_data = UserCreate(
        email="service_test@example.com",
        full_name="Service Test",
        password="testpassword123",
    )

    # Create user
    user = user_service.create(db, obj_in=user_data)

    # Assertions
    assert user.id is not None
    assert user.email == "service_test@example.com"
    assert user.full_name == "Service Test"
    # Password should be hashed
    assert user.hashed_password != "testpassword123"
    assert verify_password("testpassword123", user.hashed_password)

    # Clean up
    db.delete(user)
    db.commit()


def test_authenticate_user(db: Session):
    """Test user authentication"""
    # First create a user
    user_data = UserCreate(
        email="auth_test@example.com", full_name="Auth Test", password="authpassword123"
    )
    user = user_service.create(db, obj_in=user_data)

    # Test successful authentication
    authenticated_user = auth_service.authenticate(
        db, email="auth_test@example.com", password="authpassword123"
    )
    assert authenticated_user is not None
    assert authenticated_user.id == user.id

    # Test failed authentication
    wrong_password_user = auth_service.authenticate(
        db, email="auth_test@example.com", password="wrongpassword"
    )
    assert wrong_password_user is None

    wrong_email_user = auth_service.authenticate(
        db, email="wrong@example.com", password="authpassword123"
    )
    assert wrong_email_user is None

    # Clean up
    db.delete(user)
    db.commit()


def test_journal_service(db: Session, test_user):
    """Test journal entry service"""
    # Create a journal entry
    entry_data = JournalEntryCreate(
        title="Service Test Entry",
        content="Testing journal service",
        entry_date=date.today(),
        tags=["test", "service"],
    )

    entry = journal_service.create_with_user(db=db, obj_in=entry_data, user_id=test_user.id)

    # Assertions
    assert entry.id is not None
    assert entry.title == "Service Test Entry"
    assert entry.content == "Testing journal service"
    assert entry.user_id == test_user.id

    # Verify tags were created
    assert len(entry.tags) == 2
    tag_names = [tag.name for tag in entry.tags]
    assert "test" in tag_names
    assert "service" in tag_names

    # Test get entry
    retrieved_entry = journal_service.get(db, id=entry.id)
    assert retrieved_entry is not None
    assert retrieved_entry.id == entry.id

    # Test update entry
    updated_data = {"title": "Updated Title", "content": "Updated content"}
    updated_entry = journal_service.update(
        db, db_obj=retrieved_entry, obj_in=updated_data
    )
    assert updated_entry.title == "Updated Title"
    assert updated_entry.content == "Updated content"

    # Test list entries
    entries = journal_service.get_multi_by_user(db, user_id=test_user.id)
    assert len(entries) >= 1
    assert any(e.id == entry.id for e in entries)

    # Test delete entry
    journal_service.remove(db, id=entry.id)
    deleted_entry = journal_service.get(db, id=entry.id)
    assert deleted_entry is None


def test_reminder_service(db: Session, test_user):
    """Test reminder service"""
    # Create a reminder
    reminder_data = ReminderCreate(
        title="Service Test Reminder",
        message="Testing reminder service",
        time=datetime.combine(date.today(), time(9, 0, 0)),
        frequency="daily",
        is_active=True,
    )

    reminder = reminder_service.create_with_user(db=db, obj_in=reminder_data, user_id=test_user.id)

    # Assertions
    assert reminder.id is not None
    assert reminder.title == "Service Test Reminder"
    assert reminder.message == "Testing reminder service"
    assert reminder.time.strftime('%H:%M:%S') == "09:00:00"
    assert reminder.frequency == "daily"
    assert reminder.user_id == test_user.id

    # Test get reminder
    retrieved_reminder = reminder_service.get(db, id=reminder.id)
    assert retrieved_reminder is not None
    assert retrieved_reminder.id == reminder.id

    # Test update reminder
    updated_data = {"title": "Updated Reminder", "is_active": False}
    updated_reminder = reminder_service.update(db, db_obj=retrieved_reminder, obj_in=updated_data)
    assert updated_reminder.title == "Updated Reminder"
    assert updated_reminder.is_active is False

    # Test list reminders
    reminders = reminder_service.get_multi(db, user_id=test_user.id)
    assert len(reminders) >= 1
    assert any(r.id == reminder.id for r in reminders)

    # Test delete reminder
    reminder_service.remove(db, id=reminder.id)
    deleted_reminder = reminder_service.get(db, id=reminder.id)
    assert deleted_reminder is None
