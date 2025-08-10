"""
Pytest configuration and fixtures for the Vibes application test suite.

This module provides centralized test configuration, database setup,
and common fixtures for all tests.
"""

import pytest
import asyncio
import os
import sys
from pathlib import Path
from typing import AsyncGenerator
import logging

# Add local backend and tests directories to sys.path (avoid site-packages 'tests' module shadowing)
backend_dir = Path(__file__).parent.parent
local_tests_dir = Path(__file__).parent
sys.path.insert(0, str(local_tests_dir))
sys.path.insert(0, str(backend_dir))

# Import test utilities from local tests utils
from utils.database_setup import (  # type: ignore
    setup_test_database,
    cleanup_test_database,
    teardown_test_database,
    get_test_db_manager,
    create_test_user,
    create_test_secret_tag,
)
from app.models.user import User

# Configure logging for tests
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure asyncio event loop for tests
@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
def client():
    """Create a test client for the FastAPI application."""
    from fastapi.testclient import TestClient
    from app.main import app
    
    with TestClient(app) as client:
        yield client

@pytest.fixture
def client_with_db(db):
    """Create a test client with database dependency override."""
    from fastapi.testclient import TestClient
    from app.main import app
    from app.dependencies import get_db
    
    # Override the database dependency
    def override_get_db():
        yield db
    
    app.dependency_overrides[get_db] = override_get_db
    
    try:
        with TestClient(app) as client:
            yield client
    finally:
        # Clean up the override
        app.dependency_overrides.clear()

@pytest.fixture
def sync_test_user(db_session):
    """Create a synchronous test user for API tests."""
    from app.models.user import User
    from app.utils.secure_utils import SecureHasher
    from tests.utils.test_helpers import DEFAULT_TEST_PASSWORD
    import uuid
    
    hasher = SecureHasher()
    
    user = User(
        id=uuid.uuid4(),
        email="test@example.com",
        hashed_password=hasher.hash_password(DEFAULT_TEST_PASSWORD),
        full_name="Test User",
        email_verified=True,
        onboarding_completed=True
    )
    
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    
    return user

@pytest.fixture
def token_headers(client_with_db, sync_test_user):
    """Create authentication headers with bearer token."""
    from tests.utils.test_helpers import DEFAULT_TEST_PASSWORD
    
    # Login to get token
    response = client_with_db.post(
        "/api/auth/login/json",
        json={
            "email": sync_test_user.email,
            "password": DEFAULT_TEST_PASSWORD
        }
    )
    
    if response.status_code != 200:
        # Try alternative login endpoint
        response = client_with_db.post(
            "/api/auth/login",
            data={
                "username": sync_test_user.email,
                "password": DEFAULT_TEST_PASSWORD
            }
        )
    
    assert response.status_code == 200, f"Login failed: {response.text}"
    token = response.json()["access_token"]
    
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture(scope="session")
async def test_db_manager():
    """Session-scoped test database manager fixture"""
    logger.info("Setting up test database for session")
    manager = await setup_test_database()
    yield manager
    logger.info("Tearing down test database for session")
    await teardown_test_database()

@pytest.fixture(scope="function")
def db_session(test_db_manager):
    """Function-scoped database session with cleanup - synchronous version"""
    logger.info("Setting up clean database session for test")
    
    # Import synchronous database setup
    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import sessionmaker
    from app.core.config import settings
    
    # Create synchronous engine and session
    engine = create_engine(settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://"))
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    session = SessionLocal()
    
    try:
        # Clean up existing data
        session.execute(text("TRUNCATE TABLE journal_entry_tags CASCADE"))
        session.execute(text("TRUNCATE TABLE journal_entries CASCADE"))
        session.execute(text("TRUNCATE TABLE secret_tags CASCADE"))
        session.execute(text("TRUNCATE TABLE tags CASCADE"))
        session.execute(text("TRUNCATE TABLE reminders CASCADE"))
        session.execute(text("TRUNCATE TABLE users CASCADE"))
        session.commit()
        
        yield session
    except Exception as e:
        session.rollback()
        logger.error(f"Error in database session: {e}")
        raise
    finally:
        session.close()

@pytest.fixture(scope="function")
def db(test_db_manager):
    """Function-scoped database session with cleanup - synchronous version"""
    logger.info("Setting up clean database session for test")
    
    # Import synchronous database setup
    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import sessionmaker
    from app.core.config import settings
    
    # Create synchronous engine and session
    engine = create_engine(settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://"))
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    session = SessionLocal()
    
    try:
        # Clean up existing data
        session.execute(text("TRUNCATE TABLE journal_entry_tags CASCADE"))
        session.execute(text("TRUNCATE TABLE journal_entries CASCADE"))
        session.execute(text("TRUNCATE TABLE secret_tags CASCADE"))
        session.execute(text("TRUNCATE TABLE tags CASCADE"))
        session.execute(text("TRUNCATE TABLE reminders CASCADE"))
        session.execute(text("TRUNCATE TABLE users CASCADE"))
        session.commit()
        
        yield session
    except Exception as e:
        session.rollback()
        logger.error(f"Error in database session: {e}")
        raise
    finally:
        session.close()

@pytest.fixture(scope="function")
def isolated_db_session():
    """Isolated database session for tests that need complete isolation"""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.core.config import settings
    
    # Create isolated engine and session
    engine = create_engine(
        settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://"),
        isolation_level="AUTOCOMMIT"
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    session = SessionLocal()
    
    try:
        yield session
    except Exception as e:
        session.rollback()
        logger.error(f"Error in isolated database session: {e}")
        raise
    finally:
        session.close()

@pytest.fixture(scope="function")
async def seeded_db_session(test_db_manager):
    """Function-scoped database session with seeded test data"""
    logger.info("Setting up seeded database session for test")
    
    # Clean up and seed data
    await test_db_manager.cleanup_tables()
    await test_db_manager.seed_test_data()
    
    # Provide session
    async with test_db_manager.get_session() as session:
        try:
            yield session
        finally:
            await session.rollback()

# Common test fixtures
@pytest.fixture
async def test_user(db_session):
    """Create a test user for testing"""
    user = await create_test_user(
        db_session,
        email="test@example.com",
        password="testpassword",
        full_name="Test User"
    )
    return user

@pytest.fixture
def test_user_sync(db):
    """Create a test user for testing (synchronous version)"""
    from app.models.user import User
    from app.services.user_service import user_service
    from app.schemas.user import UserCreate

    user_data = UserCreate(
        email="test_sync@example.com",
        password="testpassword",
        full_name="Test User Sync"
    )
    user = user_service.create(db, obj_in=user_data)
    return user

@pytest.fixture
async def test_user_with_secret_tag(db_session):
    """Create a test user with a secret tag for testing"""
    user = await create_test_user(
        db_session,
        email="test_with_tag@example.com",
        password="testpassword",
        full_name="Test User with Tag"
    )
    
    secret_tag = await create_test_secret_tag(
        db_session,
        user_id=user.id,
        phrase="test secret phrase",
        tag_name="Test Secret Tag"
    )
    
    return user, secret_tag

@pytest.fixture
def test_factory():
    """Test data factory for creating test objects"""
    class TestDataFactory:
        @staticmethod
        def create_user_data(prefix="test"):
            """Create user data for testing"""
            import uuid
            from app.utils.secure_utils import SecureHasher
            
            hasher = SecureHasher()
            return {
                "id": uuid.uuid4(),
                "email": f"{prefix}@example.com",
                "hashed_password": hasher.hash_password("TestPassword123!"),
                "full_name": f"{prefix.title()} User",
                "email_verified": True,
                "onboarding_completed": True
            }
        
        @staticmethod
        def create_journal_entry_data(user_id, title="Test Entry"):
            """Create journal entry data for testing"""
            import uuid
            from datetime import datetime, timezone
            
            return {
                "id": uuid.uuid4(),
                "title": title,
                "content": f"This is a test journal entry: {title}",
                "user_id": user_id,
                "entry_date": datetime.now(timezone.utc),
            }
        
        @staticmethod
        def create_secret_tag_data(user_id, tag_name="Test Secret Tag"):
            """Create secret tag data for testing"""
            import uuid
            import secrets
            
            return {
                "id": uuid.uuid4(),
                "phrase_hash": secrets.token_bytes(16),
                "user_id": user_id,
                "salt": secrets.token_bytes(16),
                "verifier_kv": secrets.token_bytes(32),
                "opaque_envelope": secrets.token_bytes(64),
                "tag_name": tag_name,
                "color_code": "#007AFF"
            }
        
        @staticmethod
        def create_tag_data(user_id, name="Test Tag"):
            """Create regular tag data for testing"""
            import uuid
            
            return {
                "id": uuid.uuid4(),
                "name": name,
                "color": "#FF0000",
                "user_id": user_id
            }
        
        @staticmethod
        def create_reminder_data(user_id, title="Test Reminder"):
            """Create reminder data for testing"""
            import uuid
            from datetime import time
            
            return {
                "id": uuid.uuid4(),
                "title": title,
                "message": f"This is a test reminder: {title}",
                "time": time(10, 0),
                "frequency": "daily",
                "is_active": True,
                "user_id": user_id
            }
    
    return TestDataFactory

@pytest.fixture
def test_assertions():
    """Test assertions helper for common validation"""
    class TestAssertions:
        @staticmethod
        def assert_uuid_field(obj, field_name):
            """Assert that a field is a valid UUID"""
            import uuid
            field_value = getattr(obj, field_name)
            assert isinstance(field_value, uuid.UUID), f"{field_name} should be a UUID"
        
        @staticmethod
        def assert_uuid_string(value):
            """Assert that a string is a valid UUID"""
            import uuid
            assert isinstance(value, str), "UUID string should be a string"
            assert len(value) == 36, "UUID string should be 36 characters"
            uuid.UUID(value)  # Should not raise exception
        
        @staticmethod
        def assert_foreign_key_relationship(child_obj, parent_obj):
            """Assert that foreign key relationship is valid"""
            # This would be implemented based on specific relationship patterns
            pass
        
        @staticmethod
        def assert_timestamp_field(obj, field_name):
            """Assert that a timestamp field is valid"""
            from datetime import datetime
            field_value = getattr(obj, field_name)
            assert isinstance(field_value, datetime), f"{field_name} should be a datetime"
            assert field_value.tzinfo is not None, f"{field_name} should be timezone-aware"
    
    return TestAssertions

# Test environment setup fixtures
@pytest.fixture(scope="session")
def configure_test_environment():
    """Configure the test environment before running tests"""
    import logging
    import os
    
    # Set test environment variables
    os.environ["TESTING"] = "true"
    os.environ["DATABASE_URL"] = "postgresql://postgres:password@localhost:5432/vibes_test"
    
    # Configure logging for tests
    logging.basicConfig(level=logging.WARNING)
    logging.getLogger('sqlalchemy.engine').setLevel(logging.ERROR)
    logging.getLogger('sqlalchemy.pool').setLevel(logging.ERROR)
    
    yield
    
    # Cleanup environment
    os.environ.pop("TESTING", None)

@pytest.fixture(scope="function")
def performance_tracker():
    """Track performance metrics during tests"""
    import time
    import psutil
    
    class PerformanceTracker:
        def __init__(self):
            self.start_time = time.time()
            self.start_memory = psutil.Process().memory_info().rss
        
        def get_elapsed_time(self):
            return time.time() - self.start_time
        
        def get_memory_usage(self):
            return psutil.Process().memory_info().rss - self.start_memory
        
        def assert_performance_limits(self, max_time=5.0, max_memory=100*1024*1024):
            elapsed = self.get_elapsed_time()
            memory = self.get_memory_usage()
            
            assert elapsed < max_time, f"Test took {elapsed:.2f}s, exceeded limit of {max_time}s"
            assert memory < max_memory, f"Test used {memory/1024/1024:.1f}MB, exceeded limit of {max_memory/1024/1024:.1f}MB"
    
    return PerformanceTracker()

@pytest.fixture(scope="function")
def cleanup_after_test():
    """Ensure cleanup after each test"""
    yield
    
    # Cleanup any remaining resources
    import gc
    gc.collect()

@pytest.fixture(scope="function")
def mock_external_services():
    """Mock external services for testing"""
    from unittest.mock import patch, Mock
    
    mocks = {}
    
    # Mock speech service
    with patch('app.services.speech_service.SpeechService') as mock_speech:
        mock_speech.return_value.transcribe.return_value = "mocked transcription"
        mocks['speech'] = mock_speech
        
        # Mock other external services as needed
        yield mocks

@pytest.fixture(scope="function")
def configure_timeouts():
    """Configure timeouts for test operations"""
    import signal
    
    def timeout_handler(signum, frame):
        raise TimeoutError("Test operation timed out")
    
    # Set timeout for long-running operations
    signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(30)  # 30 second timeout
    
    yield
    
    signal.alarm(0)  # Cancel timeout

@pytest.fixture(scope="function")
def handle_test_errors():
    """Handle and log test errors appropriately"""
    import traceback
    
    try:
        yield
    except Exception as e:
        logger.error(f"Test error occurred: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise

# Multiple test users fixture for complex scenarios
@pytest.fixture(scope="function")
def multiple_test_users(db_session, test_factory):
    """Create multiple test users for complex testing scenarios"""
    users = []
    
    for i in range(3):
        user_data = test_factory.create_user_data(f"user_{i}")
        user = User(**user_data)
        db_session.add(user)
        users.append(user)
    
    db_session.commit()
    
    for user in users:
        db_session.refresh(user)
    
    return users

# Test environment configuration
@pytest.fixture(scope="session", autouse=True)
def configure_test_environment():
    """Configure the test environment"""
    # Set environment variables for testing
    os.environ["TESTING"] = "true"
    os.environ["LOG_LEVEL"] = "INFO"
    
    # Ensure we're using test database
    if "DATABASE_URL" in os.environ:
        original_db_url = os.environ["DATABASE_URL"]
        if "test" not in original_db_url:
            # Modify to point to test database
            parts = original_db_url.split('/')
            if len(parts) > 3:
                parts[-1] = "test_vibes"
            os.environ["DATABASE_URL"] = '/'.join(parts)
    
    yield
    
    # Clean up environment
    if "TESTING" in os.environ:
        del os.environ["TESTING"]

# Async test markers
def pytest_configure(config):
    """Configure pytest with custom markers"""
    config.addinivalue_line(
        "markers", "asyncio: mark test as async"
    )
    config.addinivalue_line(
        "markers", "slow: mark test as slow running"
    )
    config.addinivalue_line(
        "markers", "integration: mark test as integration test"
    )
    config.addinivalue_line(
        "markers", "unit: mark test as unit test"
    )
    config.addinivalue_line(
        "markers", "e2e: mark test as end-to-end test"
    )

# Test collection hooks
def pytest_collection_modifyitems(config, items):
    """Modify test items during collection"""
    for item in items:
        # Add asyncio marker to async tests
        if asyncio.iscoroutinefunction(item.function):
            item.add_marker(pytest.mark.asyncio)
        
        # Add markers based on test location
        if "unit" in item.nodeid:
            item.add_marker(pytest.mark.unit)
        elif "integration" in item.nodeid:
            item.add_marker(pytest.mark.integration)
        elif "e2e" in item.nodeid:
            item.add_marker(pytest.mark.e2e)

# Test session hooks
def pytest_sessionstart(session):
    """Called after the Session object has been created"""
    logger.info("Starting test session")
    
def pytest_sessionfinish(session, exitstatus):
    """Called after whole test run finished"""
    logger.info(f"Test session finished with exit status: {exitstatus}")
    
    # Prevent logging errors during cleanup by replacing loggers with mock
    import atexit
    from unittest.mock import Mock
    
    # Create a mock logger that doesn't try to write to closed files
    mock_logger = Mock()
    mock_logger.info = Mock()
    mock_logger.error = Mock()
    mock_logger.warning = Mock()
    mock_logger.debug = Mock()
    
    try:
        # Import and patch the secure memory logger
        from app.crypto import secure_memory
        original_logger = secure_memory.logger
        secure_memory.logger = mock_logger
        
        # Import and cleanup secure memory manager
        from app.crypto.secure_memory import get_memory_manager
        memory_manager = get_memory_manager()
        if memory_manager:
            memory_manager.emergency_cleanup()
            # Unregister the atexit handler to prevent duplicate cleanup
            try:
                atexit.unregister(memory_manager.emergency_cleanup)
            except (ValueError, AttributeError):
                # Python < 3.9 doesn't have unregister, or handler not found
                pass
        
        # Restore original logger
        secure_memory.logger = original_logger
    except Exception:
        # Ignore errors during cleanup
        pass
    
    try:
        # Import and patch the key manager logger
        from app.crypto import key_manager
        original_logger = key_manager.logger
        key_manager.logger = mock_logger
        
        # Import and cleanup key manager
        from app.crypto.key_manager import get_key_manager
        key_manager_instance = get_key_manager()
        if key_manager_instance:
            key_manager_instance.emergency_cleanup()
            # Unregister the atexit handler to prevent duplicate cleanup
            try:
                atexit.unregister(key_manager_instance.emergency_cleanup)
            except (ValueError, AttributeError):
                # Python < 3.9 doesn't have unregister, or handler not found
                pass
        
        # Restore original logger
        key_manager.logger = original_logger
    except Exception:
        # Ignore errors during cleanup
        pass
