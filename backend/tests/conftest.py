from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
import sys
import os
from datetime import timedelta

# Add the project root to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db.session import get_db
from app.main import app
from app.models.base import Base
# Import all models to ensure they are registered with Base
from app.models.user import User
from app.models.journal_entry import JournalEntry
from app.models.tag import Tag, JournalEntryTag
from app.models.secret_tag import SecretTag
from app.models.reminder import Reminder

# Use an in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db():
    """
    Database fixture for tests.

    This fixture creates all tables at the start of each test, provides a
    database session, and then drops all tables and rolls back the transaction
    after the test is complete, ensuring a clean state for every test.
    """
    connection = engine.connect()
    transaction = connection.begin()
    Base.metadata.create_all(bind=connection)

    db_session = TestingSessionLocal(bind=connection)

    try:
        yield db_session
    finally:
        db_session.close()
        transaction.rollback()
        Base.metadata.drop_all(bind=connection)
        connection.close()


@pytest.fixture(scope="function")
def client(db: Session):
    """
    Test client that uses the in-memory database with transactional isolation.
    """
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def test_user(db: Session) -> User:
    """Create a test user in the database."""
    user = User(id=1, email="test@example.com", hashed_password="password")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@pytest.fixture(scope="function")
def token_headers(test_user: User) -> dict[str, str]:
    """Create authentication headers for the test user."""
    from app.core.security import create_access_token

    access_token = create_access_token(
        subject=str(test_user.id), expires_delta=timedelta(minutes=30)
    )
    return {"Authorization": f"Bearer {access_token}"}
