from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.session import get_db
from app.main import app
from app.models.base import Base

# Use an in-memory SQLite database for tests
TEST_SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(
    TEST_SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db() -> Generator:
    # Create the test database and tables
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        # Drop tables after test
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db) -> Generator:
    # Override the get_db dependency
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides = {}


@pytest.fixture
def test_user(db):
    """Create a test user for authentication tests"""
    from app.core.security import get_password_hash
    from app.models.user import User

    # Check if test user exists
    user = db.query(User).filter(User.email == "testuser@example.com").first()

    if not user:
        user = User(
            email="testuser@example.com",
            full_name="Test User",
            hashed_password=get_password_hash("testpassword"),
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    return user


@pytest.fixture
def token_headers(client, test_user):
    """Get token headers for authenticated requests"""
    from datetime import timedelta

    from app.core.security import create_access_token

    access_token = create_access_token(
        test_user.id, expires_delta=timedelta(minutes=30)
    )

    return {"Authorization": f"Bearer {access_token}"}
