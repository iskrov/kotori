"""
End-to-End Test Configuration and Fixtures

This module provides comprehensive test fixtures and configuration for E2E testing
of the Vibes application. It includes database setup, test data management,
performance monitoring, security auditing, and timing analysis.
"""

import pytest
import asyncio
import logging
import os
import time
import uuid
from datetime import datetime, timedelta
from typing import Generator, List, Callable, Dict, Any
from contextlib import asynccontextmanager

from sqlalchemy import create_engine, text, MetaData
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from app.models.base import Base
from app.db.session import get_db
from app.db.session_factory import DatabaseSessionFactory, set_session_factory, reset_session_factory
from app.core.config import Settings
from app.models.user import User
from app.models.secret_tag_opaque import SecretTag, OpaqueSession
from app.models.journal_entry import JournalEntry
from app.models.tag import Tag
from app.utils.secure_utils import SecureHasher
from app.security.memory_protection import SecureMemoryManager

# Test database configuration
TEST_DATABASE_URL = "postgresql://postgres:password@localhost:5432/vibes_test"
TEST_DATABASE_NAME = "vibes_test"

# Test user credentials
TEST_USERS = [
    {
        "email": "test_user_1@example.com",
        "password": "TestPassword123!",
        "name": "Test User 1"
    },
    {
        "email": "test_user_2@example.com",
        "password": "TestPassword456!",
        "name": "Test User 2"
    },
    {
        "email": "test_user_3@example.com",
        "password": "TestPassword789!",
        "name": "Test User 3"
    }
]

# Test secret phrases
TEST_SECRET_PHRASES = [
    "The quick brown fox jumps over the lazy dog",
    "Pack my box with five dozen liquor jugs",
    "How vexingly quick daft zebras jump",
    "Waltz, bad nymph, for quick jigs vex",
    "Sphinx of black quartz, judge my vow",
    "The five boxing wizards jump quickly",
    "Bright vixens jump doggedly",
    "Jackdaws love my big sphinx of quartz",
    "The job requires extra pluck and zeal from every young wage earner",
    "Few quips galvanized the mock jury box"
]


class TestDatabaseManager:
    """Manages test database lifecycle and operations with session factory support."""
    
    def __init__(self):
        self.session_factory = None
        self.hasher = SecureHasher()
        
    def setup_database(self):
        """Set up test database with proper session factory."""
        # Create database if it doesn't exist
        self._create_test_database()
        
        # Create test-specific session factory
        self.session_factory = DatabaseSessionFactory(TEST_DATABASE_URL)
        
        # Set as global session factory for tests
        set_session_factory(self.session_factory)
        
        # Create all tables
        Base.metadata.create_all(bind=self.session_factory.get_engine())
        
    def _create_test_database(self):
        """Create test database if it doesn't exist."""
        if TEST_DATABASE_URL.startswith("postgresql"):
            # Connect to postgres database to create test database
            admin_url = TEST_DATABASE_URL.replace(f"/{TEST_DATABASE_NAME}", "/postgres")
            admin_engine = create_engine(admin_url)
            
            with admin_engine.connect() as conn:
                conn.execute(text("COMMIT"))  # Close any existing transaction
                
                # Check if database exists
                result = conn.execute(
                    text("SELECT 1 FROM pg_database WHERE datname = :db_name"),
                    {"db_name": TEST_DATABASE_NAME}
                )
                
                if not result.fetchone():
                    # Create database
                    conn.execute(text(f"CREATE DATABASE {TEST_DATABASE_NAME}"))
            
            admin_engine.dispose()
    
    def get_session(self) -> Session:
        """Get database session using the test session factory."""
        if not self.session_factory:
            raise RuntimeError("Database not set up. Call setup_database() first.")
        return self.session_factory.get_session()
    
    def cleanup_database(self):
        """Clean up test database."""
        if self.session_factory:
            # Drop all tables
            Base.metadata.drop_all(bind=self.session_factory.get_engine())
            self.session_factory.dispose()
            
        # Reset session factory
        reset_session_factory()
    
    def reset_database(self):
        """Reset database to clean state."""
        if self.session_factory:
            # Truncate all tables
            with self.session_factory.get_session().connect() as conn:
                conn.execute(text("TRUNCATE TABLE security_audit_logs CASCADE"))
                conn.execute(text("TRUNCATE TABLE opaque_sessions CASCADE"))
                conn.execute(text("TRUNCATE TABLE vault_blobs CASCADE"))
                conn.execute(text("TRUNCATE TABLE wrapped_keys CASCADE"))
                conn.execute(text("TRUNCATE TABLE secret_tags CASCADE"))
                conn.execute(text("TRUNCATE TABLE journal_entries CASCADE"))
                conn.execute(text("TRUNCATE TABLE tags CASCADE"))
                conn.execute(text("TRUNCATE TABLE users CASCADE"))
                conn.commit()
    
    def create_test_users(self, session: Session) -> list[User]:
        """Create test users."""
        users = []
        
        for user_data in TEST_USERS:
            hashed_password = self.hasher.hash_password(user_data["password"])
            user = User(
                id=str(uuid.uuid4()),
                email=user_data["email"],
                hashed_password=hashed_password,
                is_active=True,
                created_at=datetime.utcnow()
            )
            session.add(user)
            users.append(user)
        
        session.commit()
        return users


class TestDataManager:
    """Manages test data creation and cleanup."""
    
    def __init__(self, db_manager: TestDatabaseManager):
        self.db_manager = db_manager
        self.hasher = SecureHasher()
    
    def create_test_secret_tags(self, session: Session, user: User, count: int = 5) -> list[SecretTag]:
        """Create test secret tags for a user."""
        from app.crypto.opaque_keys import derive_opaque_keys_from_phrase
        
        tags = []
        phrases = TEST_SECRET_PHRASES[:count]
        
        for i, phrase in enumerate(phrases):
            # Generate OPAQUE keys
            opaque_keys = derive_opaque_keys_from_phrase(phrase)
            
            # Create secret tag
            secret_tag = SecretTag(
                tag_id=opaque_keys.tag_id,
                user_id=user.id,
                salt=opaque_keys.salt,
                verifier_kv=b"test_verifier_" + str(i).encode(),
                opaque_envelope=b"test_envelope_" + str(i).encode(),
                tag_name=f"Test Secret Tag {i+1}",
                color_code=f"#FF{i:02d}{i:02d}",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            
            session.add(secret_tag)
            tags.append(secret_tag)
        
        session.commit()
        return tags
    
    def create_test_journal_entries(self, session: Session, user: User, count: int = 10) -> list[JournalEntry]:
        """Create test journal entries for a user."""
        entries = []
        
        for i in range(count):
            entry = JournalEntry(
                id=str(uuid.uuid4()),
                user_id=user.id,
                title=f"Test Entry {i+1}",
                content=f"This is test journal entry number {i+1}. It contains sample content for testing purposes.",
                created_at=datetime.utcnow() - timedelta(days=i),
                updated_at=datetime.utcnow() - timedelta(days=i)
            )
            session.add(entry)
            entries.append(entry)
        
        session.commit()
        return entries
    
    def create_test_tags(self, session: Session, user: User, count: int = 5) -> list[Tag]:
        """Create test regular tags for a user."""
        tags = []
        
        for i in range(count):
            tag = Tag(
                id=str(uuid.uuid4()),
                user_id=user.id,
                name=f"Test Tag {i+1}",
                color_code=f"#00{i:02d}FF",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            session.add(tag)
            tags.append(tag)
        
        session.commit()
        return tags
    
    def cleanup_user_data(self, session: Session, user: User):
        """Clean up all data for a specific user."""
        # Delete in reverse dependency order
        session.query(OpaqueSession).filter(
            OpaqueSession.user_id == str(user.id)
        ).delete()
        
        session.query(JournalEntry).filter(
            JournalEntry.user_id == user.id
        ).delete()
        
        session.query(SecretTag).filter(
            SecretTag.user_id == user.id
        ).delete()
        
        session.query(Tag).filter(
            Tag.user_id == user.id
        ).delete()
        
        session.commit()


# Global test database manager
test_db_manager = TestDatabaseManager()


@pytest.fixture(scope="session", autouse=True)
def setup_test_environment():
    """Set up test environment before all tests."""
    # Set test environment variables
    os.environ["TESTING"] = "true"
    os.environ["DATABASE_URL"] = TEST_DATABASE_URL
    os.environ["SECRET_KEY"] = "test-secret-key-for-testing-only"
    os.environ["JWT_SECRET"] = "test-jwt-secret-for-testing-only"
    
    # Setup test database
    test_db_manager.setup_database()
    
    yield
    
    # Cleanup
    test_db_manager.cleanup_database()


@pytest.fixture(scope="function")
def db_session() -> Generator[Session, None, None]:
    """Create a database session for testing."""
    session = test_db_manager.get_session()
    
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture(scope="function")
def clean_database():
    """Reset database to clean state before each test."""
    test_db_manager.reset_database()


@pytest.fixture(scope="function")
def test_users(db_session: Session) -> list[User]:
    """Create test users."""
    return test_db_manager.create_test_users(db_session)


@pytest.fixture(scope="function")
def test_user(test_users: list[User]) -> User:
    """Get first test user."""
    return test_users[0]


@pytest.fixture(scope="function")
def test_data_manager(db_session: Session) -> TestDataManager:
    """Get test data manager."""
    return TestDataManager(test_db_manager)


@pytest.fixture(scope="function")
def test_secret_tags(db_session: Session, test_user: User, test_data_manager: TestDataManager) -> list[SecretTag]:
    """Create test secret tags."""
    return test_data_manager.create_test_secret_tags(db_session, test_user)


@pytest.fixture(scope="function")
def test_journal_entries(db_session: Session, test_user: User, test_data_manager: TestDataManager) -> list[JournalEntry]:
    """Create test journal entries."""
    return test_data_manager.create_test_journal_entries(db_session, test_user)


@pytest.fixture(scope="function")
def test_tags(db_session: Session, test_user: User, test_data_manager: TestDataManager) -> list[Tag]:
    """Create test regular tags."""
    return test_data_manager.create_test_tags(db_session, test_user)


@pytest.fixture(scope="function")
def memory_manager():
    """Get secure memory manager for testing."""
    manager = SecureMemoryManager()
    yield manager
    manager.clear_all()


@pytest.fixture(scope="function")
def authenticated_client(test_user: User):
    """Get authenticated test client."""
    from fastapi.testclient import TestClient
    from app.main import app
    
    client = TestClient(app)
    
    # Login to get token
    response = client.post(
        "/api/auth/login",
        data={
            "username": test_user.email,
            "password": TEST_USERS[0]["password"]  # First user's password
        }
    )
    
    assert response.status_code == 200
    token = response.json()["access_token"]
    
    # Add authentication headers
    client.headers.update({"Authorization": f"Bearer {token}"})
    
    return client


@pytest.fixture(scope="function")
def performance_monitor():
    """Monitor performance during tests."""
    import time
    import psutil
    import tracemalloc
    
    # Start monitoring
    start_time = time.time()
    process = psutil.Process()
    initial_memory = process.memory_info().rss
    tracemalloc.start()
    
    yield
    
    # Collect metrics
    end_time = time.time()
    final_memory = process.memory_info().rss
    current_memory, peak_memory = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    
    # Log performance metrics
    execution_time = end_time - start_time
    memory_delta = final_memory - initial_memory
    
    if execution_time > 5.0:  # Warn if test takes more than 5 seconds
        print(f"WARNING: Test took {execution_time:.2f} seconds")
    
    if memory_delta > 50 * 1024 * 1024:  # Warn if memory usage > 50MB
        print(f"WARNING: Memory usage increased by {memory_delta / 1024 / 1024:.1f}MB")
    
    if peak_memory > 100 * 1024 * 1024:  # Warn if peak memory > 100MB
        print(f"WARNING: Peak memory usage was {peak_memory / 1024 / 1024:.1f}MB")


@pytest.fixture(scope="function")
def security_audit():
    """Audit security during tests."""
    import logging
    
    # Set up security logging
    security_logger = logging.getLogger("security_audit")
    security_logger.setLevel(logging.INFO)
    
    # Create handler for security events
    handler = logging.StreamHandler()
    formatter = logging.Formatter('SECURITY: %(asctime)s - %(message)s')
    handler.setFormatter(formatter)
    security_logger.addHandler(handler)
    
    yield security_logger
    
    # Remove handler
    security_logger.removeHandler(handler)


@pytest.fixture(scope="function")
def timing_analyzer():
    """Analyze operation timing for security."""
    import time
    from typing import List
    
    class TimingAnalyzer:
        def __init__(self):
            self.measurements: List[float] = []
        
        def measure(self, operation):
            """Measure operation timing."""
            start = time.time()
            result = operation()
            end = time.time()
            
            duration = end - start
            self.measurements.append(duration)
            
            return result
        
        def analyze_timing_consistency(self, tolerance: float = 0.1):
            """Analyze timing consistency for security."""
            if len(self.measurements) < 2:
                return True
            
            avg_time = sum(self.measurements) / len(self.measurements)
            
            for measurement in self.measurements:
                if abs(measurement - avg_time) > tolerance:
                    return False
            
            return True
    
    return TimingAnalyzer()


@pytest.fixture(scope="function")
def concurrent_test_helper():
    """Helper for concurrent testing."""
    import asyncio
    from typing import List, Callable, Any
    
    class ConcurrentTestHelper:
        def __init__(self):
            self.results: List[Any] = []
        
        async def run_concurrent_operations(self, operations: List[Callable], count: int = 10):
            """Run operations concurrently."""
            tasks = []
            
            for i in range(count):
                for operation in operations:
                    task = asyncio.create_task(operation())
                    tasks.append(task)
            
            self.results = await asyncio.gather(*tasks, return_exceptions=True)
            return self.results
        
        def analyze_results(self):
            """Analyze concurrent operation results."""
            successful = [r for r in self.results if not isinstance(r, Exception)]
            failed = [r for r in self.results if isinstance(r, Exception)]
            
            return {
                "total": len(self.results),
                "successful": len(successful),
                "failed": len(failed),
                "success_rate": len(successful) / len(self.results) if self.results else 0,
                "failures": failed
            }
    
    return ConcurrentTestHelper()


@pytest.fixture(scope="function")
def database_consistency_checker(db_session: Session):
    """Check database consistency during tests."""
    
    class DatabaseConsistencyChecker:
        def __init__(self, session: Session):
            self.session = session
        
        def check_foreign_key_consistency(self):
            """Check foreign key consistency."""
            # Check user references
            orphaned_tags = self.session.execute(
                text("""
                SELECT t.id FROM tags t 
                LEFT JOIN users u ON t.user_id = u.id 
                WHERE u.id IS NULL
                """)
            ).fetchall()
            
            orphaned_secret_tags = self.session.execute(
                text("""
                SELECT st.tag_id FROM secret_tags st 
                LEFT JOIN users u ON st.user_id = u.id 
                WHERE u.id IS NULL
                """)
            ).fetchall()
            
            orphaned_entries = self.session.execute(
                text("""
                SELECT je.id FROM journal_entries je 
                LEFT JOIN users u ON je.user_id = u.id 
                WHERE u.id IS NULL
                """)
            ).fetchall()
            
            return {
                "orphaned_tags": len(orphaned_tags),
                "orphaned_secret_tags": len(orphaned_secret_tags),
                "orphaned_entries": len(orphaned_entries)
            }
        
        def check_data_integrity(self):
            """Check data integrity constraints."""
            # Check for duplicate secret tag IDs
            duplicate_tag_ids = self.session.execute(
                text("""
                SELECT tag_id, COUNT(*) 
                FROM secret_tags 
                GROUP BY tag_id 
                HAVING COUNT(*) > 1
                """)
            ).fetchall()
            
            return {
                "duplicate_tag_ids": len(duplicate_tag_ids)
            }
    
    return DatabaseConsistencyChecker(db_session)


# Event loop configuration for async tests
@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# Pytest configuration
def pytest_configure(config):
    """Configure pytest for E2E testing."""
    # Add custom markers
    config.addinivalue_line(
        "markers", "e2e: mark test as end-to-end integration test"
    )
    config.addinivalue_line(
        "markers", "security: mark test as security validation test"
    )
    config.addinivalue_line(
        "markers", "performance: mark test as performance test"
    )
    config.addinivalue_line(
        "markers", "slow: mark test as slow running test"
    )


def pytest_collection_modifyitems(config, items):
    """Modify test collection for E2E tests."""
    # Add markers based on test file location
    for item in items:
        if "e2e" in item.nodeid:
            item.add_marker(pytest.mark.e2e)
        
        if "security" in item.nodeid:
            item.add_marker(pytest.mark.security)
        
        if "performance" in item.nodeid:
            item.add_marker(pytest.mark.performance)
        
        # Mark slow tests
        if any(keyword in item.name for keyword in ["concurrent", "performance", "load"]):
            item.add_marker(pytest.mark.slow) 