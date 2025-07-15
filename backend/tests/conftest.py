from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
import sys
import os
from datetime import timedelta
import uuid

# Add the project root to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import test configuration
from tests.test_config import (
    TestDataFactory, 
    TestAssertions
)

from app.db.session import get_db
from app.db.session_factory import DatabaseSessionFactory, set_session_factory, reset_session_factory
from app.main import app
from app.models.base import Base
# Import all models to ensure they are registered with Base
from app.models.user import User
from app.models.journal_entry import JournalEntry
from app.models.tag import Tag, JournalEntryTag
from app.models.secret_tag_opaque import SecretTag, WrappedKey, VaultBlob, OpaqueSession
from app.models.reminder import Reminder

# Use an in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

# Create test-specific session factory
test_session_factory = DatabaseSessionFactory(SQLALCHEMY_DATABASE_URL)


@pytest.fixture(scope="function")
def db():
    """
    Database fixture for tests with proper session factory isolation and UUID support.

    This fixture creates all tables at the start of each test, provides a
    database session, and then drops all tables and rolls back the transaction
    after the test is complete, ensuring a clean state for every test.
    """
    # Set test-specific session factory
    set_session_factory(test_session_factory)
    
    engine = test_session_factory.get_engine()
    connection = engine.connect()
    transaction = connection.begin()
    Base.metadata.create_all(bind=connection)

    # Create session using the test factory
    session = test_session_factory.get_session()
    
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()
        # Reset to original session factory
        reset_session_factory()


@pytest.fixture(scope="function")
def client(db: Session):
    """FastAPI test client with database dependency override."""
    
    def override_get_db():
        try:
            yield db
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def test_user(db: Session) -> User:
    """Create a test user in the database with proper UUID handling."""
    user_data = TestDataFactory.create_user_data("test")
    user = User(**user_data)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture(scope="function")
def test_user_with_entries(db: Session) -> tuple[User, list[JournalEntry]]:
    """Create a test user with several journal entries."""
    user_data = TestDataFactory.create_user_data("entries_test")
    user = User(**user_data)
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Create test journal entries
    entries = []
    for i in range(3):
        entry_data = TestDataFactory.create_journal_entry_data(user.id, f"entry_{i}")
        entry = JournalEntry(**entry_data)
        entries.append(entry)
    
    db.add_all(entries)
    db.commit()
    for entry in entries:
        db.refresh(entry)
    
    return user, entries


@pytest.fixture(scope="function")
def db_session(db: Session) -> Session:
    """Alias for db fixture for compatibility."""
    return db


@pytest.fixture(scope="function")
def token_headers(test_user: User) -> dict[str, str]:
    """Create authentication headers for the test user."""
    from app.core.security import create_access_token

    access_token = create_access_token(
        subject=str(test_user.id), expires_delta=timedelta(minutes=30)
    )
    return {"Authorization": f"Bearer {access_token}"}


@pytest.fixture(scope="function")
def superuser(db: Session) -> User:
    """Create a superuser for testing admin functionality."""
    user_data = TestDataFactory.create_user_data("superuser")
    user_data['is_superuser'] = True
    user = User(**user_data)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture(scope="function")
def superuser_token_headers(superuser: User) -> dict[str, str]:
    """Create authentication headers for the superuser."""
    from app.core.security import create_access_token

    access_token = create_access_token(
        subject=str(superuser.id), expires_delta=timedelta(minutes=30)
    )
    return {"Authorization": f"Bearer {access_token}"}


# Test helpers fixtures
@pytest.fixture(scope="session")
def test_factory():
    """Provide test data factory for creating test objects."""
    return TestDataFactory


@pytest.fixture(scope="session")
def test_assertions():
    """Provide test assertion helpers."""
    return TestAssertions
