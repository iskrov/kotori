# Testing Guide

## Table of Contents
- [Overview](#overview)
- [Testing Strategy](#testing-strategy)
- [Unit Testing](#unit-testing)
- [Integration Testing](#integration-testing)
- [Performance Testing](#performance-testing)
- [Schema Testing](#schema-testing)
- [API Testing](#api-testing)
- [End-to-End Testing](#end-to-end-testing)
- [Test Data Management](#test-data-management)
- [Continuous Integration](#continuous-integration)

## Overview

This guide provides comprehensive testing strategies and procedures for the UUID implementation in the Vibes application. It covers all levels of testing from unit tests to end-to-end validation.

### Testing Objectives

- **Functional Validation**: Ensure all UUID-based functionality works correctly
- **Performance Validation**: Verify performance meets requirements
- **Data Integrity**: Confirm database constraints and relationships
- **API Compliance**: Validate all endpoints handle UUIDs properly
- **Regression Prevention**: Prevent issues during future changes

### Testing Levels

1. **Unit Tests**: Individual component testing
2. **Integration Tests**: Component interaction testing
3. **Performance Tests**: Load and stress testing
4. **Schema Tests**: Database constraint validation
5. **API Tests**: Endpoint validation
6. **E2E Tests**: Complete workflow testing

## Testing Strategy

### Test Pyramid

```
        /\
       /  \
      /E2E \     <- Few, high-value tests
     /______\
    /        \
   /   API    \   <- Moderate number of tests
  /____________\
 /              \
/  Integration   \  <- More tests than E2E
\________________/
 \              /
  \    Unit     /   <- Most tests, fast execution
   \__________/
```

### Test Categories

#### 1. Unit Tests (60% of tests)
- Model validation
- Service layer logic
- Utility functions
- UUID generation and validation

#### 2. Integration Tests (30% of tests)
- Database operations
- API endpoints
- Service interactions
- External integrations

#### 3. E2E Tests (10% of tests)
- Complete user workflows
- Critical business processes
- Cross-system validation

## Unit Testing

### Model Testing

```python
import pytest
import uuid
from sqlalchemy.exc import IntegrityError
from backend.models import User, Journal, Tag
from backend.database import SessionLocal

class TestUserModel:
    @pytest.fixture
    def db_session(self):
        session = SessionLocal()
        yield session
        session.rollback()
        session.close()
    
    def test_user_creation_with_uuid(self, db_session):
        """Test user creation generates valid UUID"""
        user = User(email="test@example.com")
        db_session.add(user)
        db_session.commit()
        
        assert user.id is not None
        assert isinstance(user.id, uuid.UUID)
        assert user.email == "test@example.com"
    
    def test_user_uuid_uniqueness(self, db_session):
        """Test UUID uniqueness constraint"""
        user1 = User(email="user1@example.com")
        user2 = User(email="user2@example.com")
        
        db_session.add(user1)
        db_session.commit()
        
        db_session.add(user2)
        db_session.commit()
        
        assert user1.id != user2.id
    
    def test_user_email_uniqueness(self, db_session):
        """Test email uniqueness constraint"""
        user1 = User(email="duplicate@example.com")
        user2 = User(email="duplicate@example.com")
        
        db_session.add(user1)
        db_session.commit()
        
        db_session.add(user2)
        
        with pytest.raises(IntegrityError):
            db_session.commit()
    
    def test_user_relationships(self, db_session):
        """Test user relationships with UUID foreign keys"""
        user = User(email="test@example.com")
        db_session.add(user)
        db_session.commit()
        
        journal = Journal(
            title="Test Journal",
            content="Test content",
            user_id=user.id
        )
        db_session.add(journal)
        db_session.commit()
        
        assert journal.user_id == user.id
        assert journal.user == user
        assert journal in user.journals

class TestJournalModel:
    @pytest.fixture
    def db_session(self):
        session = SessionLocal()
        yield session
        session.rollback()
        session.close()
    
    @pytest.fixture
    def test_user(self, db_session):
        user = User(email="test@example.com")
        db_session.add(user)
        db_session.commit()
        return user
    
    def test_journal_creation_with_uuid(self, db_session, test_user):
        """Test journal creation with UUID primary key"""
        journal = Journal(
            title="Test Journal",
            content="Test content",
            user_id=test_user.id
        )
        db_session.add(journal)
        db_session.commit()
        
        assert journal.id is not None
        assert isinstance(journal.id, uuid.UUID)
        assert journal.user_id == test_user.id
    
    def test_journal_foreign_key_constraint(self, db_session):
        """Test foreign key constraint with UUID"""
        invalid_user_id = uuid.uuid4()
        journal = Journal(
            title="Test Journal",
            content="Test content",
            user_id=invalid_user_id
        )
        db_session.add(journal)
        
        with pytest.raises(IntegrityError):
            db_session.commit()
    
    def test_journal_cascade_delete(self, db_session, test_user):
        """Test cascade delete with UUID relationships"""
        journal = Journal(
            title="Test Journal",
            content="Test content",
            user_id=test_user.id
        )
        db_session.add(journal)
        db_session.commit()
        
        journal_id = journal.id
        
        # Delete user should cascade to journal
        db_session.delete(test_user)
        db_session.commit()
        
        # Verify journal is deleted
        deleted_journal = db_session.query(Journal).filter(
            Journal.id == journal_id
        ).first()
        assert deleted_journal is None
```

### Service Layer Testing

```python
import pytest
import uuid
from unittest.mock import Mock, patch
from backend.services.journal_service import JournalService
from backend.models import Journal, User
from backend.schemas import JournalCreate, JournalUpdate

class TestJournalService:
    @pytest.fixture
    def mock_db(self):
        return Mock()
    
    @pytest.fixture
    def journal_service(self, mock_db):
        return JournalService(mock_db)
    
    @pytest.fixture
    def sample_user_id(self):
        return uuid.uuid4()
    
    @pytest.fixture
    def sample_journal_data(self):
        return JournalCreate(
            title="Test Journal",
            content="Test content"
        )
    
    def test_create_journal_success(self, journal_service, mock_db, sample_user_id, sample_journal_data):
        """Test successful journal creation"""
        # Arrange
        expected_journal = Journal(
            id=uuid.uuid4(),
            title=sample_journal_data.title,
            content=sample_journal_data.content,
            user_id=sample_user_id
        )
        mock_db.add.return_value = None
        mock_db.commit.return_value = None
        mock_db.refresh.return_value = None
        
        # Act
        with patch('backend.models.Journal', return_value=expected_journal):
            result = journal_service.create_journal(sample_journal_data, sample_user_id)
        
        # Assert
        assert result == expected_journal
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
        mock_db.refresh.assert_called_once()
    
    def test_get_journal_success(self, journal_service, mock_db, sample_user_id):
        """Test successful journal retrieval"""
        # Arrange
        journal_id = uuid.uuid4()
        expected_journal = Journal(
            id=journal_id,
            title="Test Journal",
            user_id=sample_user_id
        )
        mock_db.query.return_value.filter.return_value.first.return_value = expected_journal
        
        # Act
        result = journal_service.get_journal(journal_id, sample_user_id)
        
        # Assert
        assert result == expected_journal
        mock_db.query.assert_called_once_with(Journal)
    
    def test_get_journal_not_found(self, journal_service, mock_db, sample_user_id):
        """Test journal not found scenario"""
        # Arrange
        journal_id = uuid.uuid4()
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        # Act
        result = journal_service.get_journal(journal_id, sample_user_id)
        
        # Assert
        assert result is None
    
    def test_update_journal_success(self, journal_service, mock_db, sample_user_id):
        """Test successful journal update"""
        # Arrange
        journal_id = uuid.uuid4()
        update_data = JournalUpdate(title="Updated Title")
        existing_journal = Journal(
            id=journal_id,
            title="Original Title",
            user_id=sample_user_id
        )
        
        mock_db.query.return_value.filter.return_value.first.return_value = existing_journal
        mock_db.commit.return_value = None
        mock_db.refresh.return_value = None
        
        # Act
        result = journal_service.update_journal(journal_id, update_data, sample_user_id)
        
        # Assert
        assert result == existing_journal
        assert existing_journal.title == "Updated Title"
        mock_db.commit.assert_called_once()
        mock_db.refresh.assert_called_once()
```

### UUID Utility Testing

```python
import pytest
import uuid
from backend.utils.uuid_utils import (
    generate_uuid,
    validate_uuid,
    uuid_to_string,
    string_to_uuid
)

class TestUUIDUtils:
    def test_generate_uuid(self):
        """Test UUID generation"""
        generated_uuid = generate_uuid()
        
        assert isinstance(generated_uuid, uuid.UUID)
        assert generated_uuid.version == 4
    
    def test_validate_uuid_valid(self):
        """Test UUID validation with valid UUID"""
        valid_uuid = "550e8400-e29b-41d4-a716-446655440000"
        
        assert validate_uuid(valid_uuid) is True
    
    def test_validate_uuid_invalid(self):
        """Test UUID validation with invalid UUID"""
        invalid_uuids = [
            "invalid-uuid",
            "550e8400-e29b-41d4-a716",
            "550e8400-e29b-41d4-a716-44665544000g",
            "",
            None
        ]
        
        for invalid_uuid in invalid_uuids:
            assert validate_uuid(invalid_uuid) is False
    
    def test_uuid_to_string(self):
        """Test UUID to string conversion"""
        test_uuid = uuid.UUID("550e8400-e29b-41d4-a716-446655440000")
        result = uuid_to_string(test_uuid)
        
        assert result == "550e8400-e29b-41d4-a716-446655440000"
        assert isinstance(result, str)
    
    def test_string_to_uuid(self):
        """Test string to UUID conversion"""
        uuid_string = "550e8400-e29b-41d4-a716-446655440000"
        result = string_to_uuid(uuid_string)
        
        assert isinstance(result, uuid.UUID)
        assert str(result) == uuid_string
    
    def test_string_to_uuid_invalid(self):
        """Test string to UUID conversion with invalid input"""
        with pytest.raises(ValueError):
            string_to_uuid("invalid-uuid")
```

## Integration Testing

### Database Integration Tests

```python
import pytest
import uuid
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.database import Base
from backend.models import User, Journal, Tag

class TestDatabaseIntegration:
    @pytest.fixture(scope="class")
    def engine(self):
        # Use test database
        engine = create_engine("postgresql://test:test@localhost/vibes_test")
        Base.metadata.create_all(engine)
        yield engine
        Base.metadata.drop_all(engine)
    
    @pytest.fixture
    def db_session(self, engine):
        Session = sessionmaker(bind=engine)
        session = Session()
        yield session
        session.rollback()
        session.close()
    
    def test_user_journal_relationship(self, db_session):
        """Test user-journal relationship with UUIDs"""
        # Create user
        user = User(email="test@example.com")
        db_session.add(user)
        db_session.commit()
        
        # Create journal
        journal = Journal(
            title="Test Journal",
            content="Test content",
            user_id=user.id
        )
        db_session.add(journal)
        db_session.commit()
        
        # Test relationship
        assert journal.user == user
        assert journal in user.journals
        assert journal.user_id == user.id
    
    def test_cascade_delete_behavior(self, db_session):
        """Test cascade delete with UUID foreign keys"""
        # Create user with journal and tags
        user = User(email="test@example.com")
        db_session.add(user)
        db_session.commit()
        
        journal = Journal(
            title="Test Journal",
            content="Test content",
            user_id=user.id
        )
        db_session.add(journal)
        db_session.commit()
        
        tag = Tag(
            name="test-tag",
            journal_id=journal.id
        )
        db_session.add(tag)
        db_session.commit()
        
        # Store IDs for verification
        user_id = user.id
        journal_id = journal.id
        tag_id = tag.id
        
        # Delete user
        db_session.delete(user)
        db_session.commit()
        
        # Verify cascade delete
        assert db_session.query(User).filter(User.id == user_id).first() is None
        assert db_session.query(Journal).filter(Journal.id == journal_id).first() is None
        assert db_session.query(Tag).filter(Tag.id == tag_id).first() is None
    
    def test_uuid_query_performance(self, db_session):
        """Test UUID query performance"""
        import time
        
        # Create test data
        users = [User(email=f"user{i}@example.com") for i in range(100)]
        db_session.add_all(users)
        db_session.commit()
        
        # Test primary key lookup performance
        test_user = users[50]
        
        start_time = time.time()
        result = db_session.query(User).filter(User.id == test_user.id).first()
        end_time = time.time()
        
        assert result == test_user
        assert (end_time - start_time) < 0.01  # Should be under 10ms
```

### Service Integration Tests

```python
import pytest
import uuid
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from backend.app import app
from backend.database import get_db
from backend.models import User, Journal

class TestServiceIntegration:
    @pytest.fixture
    def client(self):
        return TestClient(app)
    
    @pytest.fixture
    def test_user(self, db_session):
        user = User(email="test@example.com")
        db_session.add(user)
        db_session.commit()
        return user
    
    @pytest.fixture
    def auth_headers(self, test_user):
        # Mock authentication
        token = create_test_token(test_user.id)
        return {"Authorization": f"Bearer {token}"}
    
    def test_create_journal_integration(self, client, test_user, auth_headers):
        """Test journal creation through service layer"""
        journal_data = {
            "title": "Integration Test Journal",
            "content": "Test content for integration"
        }
        
        response = client.post(
            "/api/v1/journals/",
            json=journal_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        
        # Verify UUID format
        assert uuid.UUID(data["id"])
        assert uuid.UUID(data["user_id"])
        assert data["title"] == journal_data["title"]
        assert data["content"] == journal_data["content"]
    
    def test_get_journal_integration(self, client, test_user, auth_headers, db_session):
        """Test journal retrieval through service layer"""
        # Create journal directly in database
        journal = Journal(
            title="Test Journal",
            content="Test content",
            user_id=test_user.id
        )
        db_session.add(journal)
        db_session.commit()
        
        response = client.get(
            f"/api/v1/journals/{journal.id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] == str(journal.id)
        assert data["user_id"] == str(test_user.id)
        assert data["title"] == journal.title
    
    def test_update_journal_integration(self, client, test_user, auth_headers, db_session):
        """Test journal update through service layer"""
        # Create journal
        journal = Journal(
            title="Original Title",
            content="Original content",
            user_id=test_user.id
        )
        db_session.add(journal)
        db_session.commit()
        
        # Update journal
        update_data = {
            "title": "Updated Title",
            "content": "Updated content"
        }
        
        response = client.put(
            f"/api/v1/journals/{journal.id}",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["title"] == update_data["title"]
        assert data["content"] == update_data["content"]
        
        # Verify in database
        db_session.refresh(journal)
        assert journal.title == update_data["title"]
        assert journal.content == update_data["content"]
```

## Performance Testing

### Load Testing

```python
import pytest
import asyncio
import asyncpg
import uuid
import time
from concurrent.futures import ThreadPoolExecutor

class TestUUIDPerformance:
    @pytest.fixture
    async def db_connection(self):
        conn = await asyncpg.connect("postgresql://test:test@localhost/vibes_test")
        yield conn
        await conn.close()
    
    @pytest.mark.asyncio
    async def test_uuid_lookup_performance(self, db_connection):
        """Test UUID primary key lookup performance"""
        # Create test data
        user_id = uuid.uuid4()
        await db_connection.execute(
            "INSERT INTO users (id, email) VALUES ($1, $2)",
            user_id, "test@example.com"
        )
        
        # Test lookup performance
        start_time = time.time()
        result = await db_connection.fetchrow(
            "SELECT * FROM users WHERE id = $1", user_id
        )
        end_time = time.time()
        
        assert result is not None
        assert (end_time - start_time) < 0.005  # Should be under 5ms
    
    @pytest.mark.asyncio
    async def test_uuid_join_performance(self, db_connection):
        """Test UUID foreign key join performance"""
        # Create test data
        user_id = uuid.uuid4()
        journal_id = uuid.uuid4()
        
        await db_connection.execute(
            "INSERT INTO users (id, email) VALUES ($1, $2)",
            user_id, "test@example.com"
        )
        await db_connection.execute(
            "INSERT INTO journals (id, user_id, title, content) VALUES ($1, $2, $3, $4)",
            journal_id, user_id, "Test Journal", "Test content"
        )
        
        # Test join performance
        start_time = time.time()
        result = await db_connection.fetchrow("""
            SELECT j.*, u.email 
            FROM journals j 
            JOIN users u ON j.user_id = u.id 
            WHERE j.id = $1
        """, journal_id)
        end_time = time.time()
        
        assert result is not None
        assert (end_time - start_time) < 0.020  # Should be under 20ms
    
    @pytest.mark.asyncio
    async def test_concurrent_uuid_operations(self, db_connection):
        """Test concurrent UUID operations"""
        # Create test users
        user_ids = [uuid.uuid4() for _ in range(100)]
        
        # Insert users concurrently
        start_time = time.time()
        await asyncio.gather(*[
            db_connection.execute(
                "INSERT INTO users (id, email) VALUES ($1, $2)",
                user_id, f"user{i}@example.com"
            )
            for i, user_id in enumerate(user_ids)
        ])
        insert_time = time.time() - start_time
        
        # Query users concurrently
        start_time = time.time()
        results = await asyncio.gather(*[
            db_connection.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
            for user_id in user_ids
        ])
        query_time = time.time() - start_time
        
        assert len(results) == 100
        assert all(result is not None for result in results)
        assert insert_time < 1.0  # Should complete within 1 second
        assert query_time < 0.5   # Should complete within 500ms
```

### Stress Testing

```python
import pytest
import threading
import time
import uuid
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.models import User, Journal

class TestUUIDStress:
    @pytest.fixture(scope="class")
    def engine(self):
        return create_engine("postgresql://test:test@localhost/vibes_test")
    
    def test_concurrent_uuid_inserts(self, engine):
        """Test concurrent UUID inserts under stress"""
        Session = sessionmaker(bind=engine)
        
        def worker(worker_id, num_operations):
            session = Session()
            try:
                for i in range(num_operations):
                    user = User(email=f"worker{worker_id}_user{i}@example.com")
                    session.add(user)
                    session.commit()
            finally:
                session.close()
        
        # Start multiple worker threads
        num_workers = 10
        operations_per_worker = 100
        threads = []
        
        start_time = time.time()
        
        for i in range(num_workers):
            thread = threading.Thread(
                target=worker, 
                args=(i, operations_per_worker)
            )
            threads.append(thread)
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        end_time = time.time()
        total_time = end_time - start_time
        total_operations = num_workers * operations_per_worker
        
        # Verify performance
        assert total_time < 30  # Should complete within 30 seconds
        throughput = total_operations / total_time
        assert throughput > 100  # Should handle at least 100 ops/sec
    
    def test_uuid_query_stress(self, engine):
        """Test UUID query performance under stress"""
        Session = sessionmaker(bind=engine)
        
        # Create test data
        session = Session()
        users = [User(email=f"stress_user{i}@example.com") for i in range(1000)]
        session.add_all(users)
        session.commit()
        user_ids = [user.id for user in users]
        session.close()
        
        def query_worker(worker_id, user_ids):
            session = Session()
            try:
                for user_id in user_ids:
                    user = session.query(User).filter(User.id == user_id).first()
                    assert user is not None
            finally:
                session.close()
        
        # Start multiple query workers
        num_workers = 20
        threads = []
        
        start_time = time.time()
        
        for i in range(num_workers):
            thread = threading.Thread(
                target=query_worker,
                args=(i, user_ids[:50])  # Each worker queries 50 users
            )
            threads.append(thread)
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        end_time = time.time()
        total_time = end_time - start_time
        
        # Verify performance
        assert total_time < 10  # Should complete within 10 seconds
```

## Schema Testing

### Constraint Testing

```python
import pytest
import uuid
from sqlalchemy.exc import IntegrityError
from backend.models import User, Journal, Tag

class TestSchemaConstraints:
    @pytest.fixture
    def db_session(self):
        session = SessionLocal()
        yield session
        session.rollback()
        session.close()
    
    def test_primary_key_uniqueness(self, db_session):
        """Test primary key uniqueness constraints"""
        user1 = User(email="user1@example.com")
        user2 = User(email="user2@example.com")
        
        db_session.add(user1)
        db_session.commit()
        
        # Try to create user with same ID
        user2.id = user1.id
        db_session.add(user2)
        
        with pytest.raises(IntegrityError):
            db_session.commit()
    
    def test_foreign_key_constraints(self, db_session):
        """Test foreign key constraints with UUIDs"""
        # Try to create journal with non-existent user_id
        invalid_user_id = uuid.uuid4()
        journal = Journal(
            title="Test Journal",
            content="Test content",
            user_id=invalid_user_id
        )
        db_session.add(journal)
        
        with pytest.raises(IntegrityError):
            db_session.commit()
    
    def test_not_null_constraints(self, db_session):
        """Test NOT NULL constraints"""
        # Try to create user without email
        user = User()
        db_session.add(user)
        
        with pytest.raises(IntegrityError):
            db_session.commit()
    
    def test_unique_constraints(self, db_session):
        """Test unique constraints"""
        user1 = User(email="duplicate@example.com")
        user2 = User(email="duplicate@example.com")
        
        db_session.add(user1)
        db_session.commit()
        
        db_session.add(user2)
        
        with pytest.raises(IntegrityError):
            db_session.commit()
    
    def test_cascade_delete_constraints(self, db_session):
        """Test cascade delete constraints"""
        # Create user with related data
        user = User(email="test@example.com")
        db_session.add(user)
        db_session.commit()
        
        journal = Journal(
            title="Test Journal",
            content="Test content",
            user_id=user.id
        )
        db_session.add(journal)
        db_session.commit()
        
        tag = Tag(
            name="test-tag",
            journal_id=journal.id
        )
        db_session.add(tag)
        db_session.commit()
        
        # Store IDs for verification
        journal_id = journal.id
        tag_id = tag.id
        
        # Delete user should cascade
        db_session.delete(user)
        db_session.commit()
        
        # Verify cascade delete
        assert db_session.query(Journal).filter(Journal.id == journal_id).first() is None
        assert db_session.query(Tag).filter(Tag.id == tag_id).first() is None
```

## API Testing

### Endpoint Testing

```python
import pytest
import uuid
from fastapi.testclient import TestClient
from backend.app import app

class TestAPIEndpoints:
    @pytest.fixture
    def client(self):
        return TestClient(app)
    
    @pytest.fixture
    def auth_headers(self):
        # Mock authentication
        return {"Authorization": "Bearer test-token"}
    
    def test_create_journal_api(self, client, auth_headers):
        """Test journal creation API endpoint"""
        journal_data = {
            "title": "API Test Journal",
            "content": "Content for API test"
        }
        
        response = client.post(
            "/api/v1/journals/",
            json=journal_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        
        # Verify UUID format
        assert uuid.UUID(data["id"])
        assert uuid.UUID(data["user_id"])
        assert data["title"] == journal_data["title"]
        assert data["content"] == journal_data["content"]
    
    def test_get_journal_api(self, client, auth_headers):
        """Test journal retrieval API endpoint"""
        # Create journal first
        journal_data = {
            "title": "Test Journal",
            "content": "Test content"
        }
        
        create_response = client.post(
            "/api/v1/journals/",
            json=journal_data,
            headers=auth_headers
        )
        
        journal_id = create_response.json()["id"]
        
        # Get journal
        response = client.get(
            f"/api/v1/journals/{journal_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] == journal_id
        assert data["title"] == journal_data["title"]
    
    def test_invalid_uuid_format(self, client, auth_headers):
        """Test API response to invalid UUID format"""
        response = client.get(
            "/api/v1/journals/invalid-uuid",
            headers=auth_headers
        )
        
        assert response.status_code == 422
        data = response.json()
        assert "detail" in data
    
    def test_nonexistent_uuid(self, client, auth_headers):
        """Test API response to non-existent UUID"""
        non_existent_id = str(uuid.uuid4())
        
        response = client.get(
            f"/api/v1/journals/{non_existent_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
```

## End-to-End Testing

### Complete Workflow Testing

```python
import pytest
import uuid
from fastapi.testclient import TestClient
from backend.app import app

class TestE2EWorkflows:
    @pytest.fixture
    def client(self):
        return TestClient(app)
    
    def test_complete_journal_workflow(self, client):
        """Test complete journal workflow from creation to deletion"""
        # 1. Register user
        user_data = {
            "email": "e2e@example.com",
            "password": "testpass123"
        }
        
        register_response = client.post("/auth/register", json=user_data)
        assert register_response.status_code == 201
        user_id = register_response.json()["id"]
        assert uuid.UUID(user_id)
        
        # 2. Login
        login_response = client.post("/auth/login", json=user_data)
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        
        auth_headers = {"Authorization": f"Bearer {token}"}
        
        # 3. Create journal
        journal_data = {
            "title": "E2E Test Journal",
            "content": "End-to-end test content"
        }
        
        create_response = client.post(
            "/api/v1/journals/",
            json=journal_data,
            headers=auth_headers
        )
        assert create_response.status_code == 201
        journal_id = create_response.json()["id"]
        assert uuid.UUID(journal_id)
        
        # 4. Get journal
        get_response = client.get(
            f"/api/v1/journals/{journal_id}",
            headers=auth_headers
        )
        assert get_response.status_code == 200
        assert get_response.json()["title"] == journal_data["title"]
        
        # 5. Update journal
        update_data = {
            "title": "Updated E2E Journal",
            "content": "Updated content"
        }
        
        update_response = client.put(
            f"/api/v1/journals/{journal_id}",
            json=update_data,
            headers=auth_headers
        )
        assert update_response.status_code == 200
        assert update_response.json()["title"] == update_data["title"]
        
        # 6. Add tags
        tag_data = {"name": "e2e-test"}
        
        tag_response = client.post(
            f"/api/v1/journals/{journal_id}/tags",
            json=tag_data,
            headers=auth_headers
        )
        assert tag_response.status_code == 201
        tag_id = tag_response.json()["id"]
        assert uuid.UUID(tag_id)
        
        # 7. List journals
        list_response = client.get("/api/v1/journals", headers=auth_headers)
        assert list_response.status_code == 200
        journals = list_response.json()["journals"]
        assert len(journals) == 1
        assert journals[0]["id"] == journal_id
        
        # 8. Delete journal
        delete_response = client.delete(
            f"/api/v1/journals/{journal_id}",
            headers=auth_headers
        )
        assert delete_response.status_code == 200
        
        # 9. Verify deletion
        get_deleted_response = client.get(
            f"/api/v1/journals/{journal_id}",
            headers=auth_headers
        )
        assert get_deleted_response.status_code == 404
    
    def test_user_data_isolation(self, client):
        """Test that UUID-based access control works correctly"""
        # Create two users
        user1_data = {"email": "user1@example.com", "password": "pass1"}
        user2_data = {"email": "user2@example.com", "password": "pass2"}
        
        client.post("/auth/register", json=user1_data)
        client.post("/auth/register", json=user2_data)
        
        # Login both users
        token1 = client.post("/auth/login", json=user1_data).json()["access_token"]
        token2 = client.post("/auth/login", json=user2_data).json()["access_token"]
        
        headers1 = {"Authorization": f"Bearer {token1}"}
        headers2 = {"Authorization": f"Bearer {token2}"}
        
        # User 1 creates journal
        journal_data = {"title": "User 1 Journal", "content": "Private content"}
        journal_response = client.post(
            "/api/v1/journals/",
            json=journal_data,
            headers=headers1
        )
        journal_id = journal_response.json()["id"]
        
        # User 2 tries to access User 1's journal
        access_response = client.get(
            f"/api/v1/journals/{journal_id}",
            headers=headers2
        )
        assert access_response.status_code == 404  # Should not be found
        
        # User 1 can access their own journal
        own_access_response = client.get(
            f"/api/v1/journals/{journal_id}",
            headers=headers1
        )
        assert own_access_response.status_code == 200
```

## Test Data Management

### Test Fixtures

```python
import pytest
import uuid
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.database import Base
from backend.models import User, Journal, Tag

class TestDataManager:
    @pytest.fixture(scope="session")
    def test_engine(self):
        """Create test database engine"""
        engine = create_engine("postgresql://test:test@localhost/vibes_test")
        Base.metadata.create_all(engine)
        yield engine
        Base.metadata.drop_all(engine)
    
    @pytest.fixture
    def db_session(self, test_engine):
        """Create database session for tests"""
        Session = sessionmaker(bind=test_engine)
        session = Session()
        yield session
        session.rollback()
        session.close()
    
    @pytest.fixture
    def sample_users(self, db_session):
        """Create sample users for testing"""
        users = [
            User(email="user1@example.com"),
            User(email="user2@example.com"),
            User(email="user3@example.com")
        ]
        db_session.add_all(users)
        db_session.commit()
        return users
    
    @pytest.fixture
    def sample_journals(self, db_session, sample_users):
        """Create sample journals for testing"""
        journals = [
            Journal(
                title="Journal 1",
                content="Content 1",
                user_id=sample_users[0].id
            ),
            Journal(
                title="Journal 2",
                content="Content 2",
                user_id=sample_users[0].id
            ),
            Journal(
                title="Journal 3",
                content="Content 3",
                user_id=sample_users[1].id
            )
        ]
        db_session.add_all(journals)
        db_session.commit()
        return journals
    
    @pytest.fixture
    def sample_tags(self, db_session, sample_journals):
        """Create sample tags for testing"""
        tags = [
            Tag(name="tag1", journal_id=sample_journals[0].id),
            Tag(name="tag2", journal_id=sample_journals[0].id),
            Tag(name="tag3", journal_id=sample_journals[1].id)
        ]
        db_session.add_all(tags)
        db_session.commit()
        return tags
```

### Test Data Cleanup

```python
import pytest
from sqlalchemy import text

class TestDataCleanup:
    @pytest.fixture(autouse=True)
    def cleanup_test_data(self, db_session):
        """Automatically cleanup test data after each test"""
        yield
        
        # Clean up in reverse order of dependencies
        db_session.execute(text("DELETE FROM secret_tags"))
        db_session.execute(text("DELETE FROM tags"))
        db_session.execute(text("DELETE FROM reminders"))
        db_session.execute(text("DELETE FROM journals"))
        db_session.execute(text("DELETE FROM users"))
        db_session.commit()
    
    def test_cleanup_verification(self, db_session):
        """Verify test data cleanup works correctly"""
        # Create test data
        user = User(email="cleanup@example.com")
        db_session.add(user)
        db_session.commit()
        
        # Verify data exists
        assert db_session.query(User).filter(User.email == "cleanup@example.com").first() is not None
        
        # Cleanup will happen automatically after this test
```

## Continuous Integration

### GitHub Actions Configuration

```yaml
# .github/workflows/uuid-tests.yml
name: UUID Implementation Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: vibes_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.9'
    
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r requirements.txt
        pip install -r requirements-test.txt
    
    - name: Set up database
      run: |
        psql -h localhost -U postgres -d vibes_test -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
      env:
        PGPASSWORD: postgres
    
    - name: Run unit tests
      run: |
        python -m pytest backend/tests/unit/ -v --cov=backend
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/vibes_test
    
    - name: Run integration tests
      run: |
        python -m pytest backend/tests/integration/ -v
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/vibes_test
    
    - name: Run performance tests
      run: |
        python -m pytest backend/tests/performance/ -v
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/vibes_test
    
    - name: Run schema tests
      run: |
        python -m pytest backend/tests/schema/ -v
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/vibes_test
    
    - name: Generate test report
      run: |
        python -m pytest --html=test-report.html --self-contained-html
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/vibes_test
    
    - name: Upload test report
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: test-report
        path: test-report.html
```

### Test Configuration

```python
# conftest.py
import pytest
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.database import Base

@pytest.fixture(scope="session")
def test_database_url():
    """Get test database URL from environment"""
    return os.getenv("DATABASE_URL", "postgresql://test:test@localhost/vibes_test")

@pytest.fixture(scope="session")
def test_engine(test_database_url):
    """Create test database engine"""
    engine = create_engine(test_database_url)
    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)

@pytest.fixture
def db_session(test_engine):
    """Create database session for tests"""
    Session = sessionmaker(bind=test_engine)
    session = Session()
    yield session
    session.rollback()
    session.close()

def pytest_configure(config):
    """Configure pytest"""
    config.addinivalue_line(
        "markers", "slow: marks tests as slow (deselect with '-m \"not slow\"')"
    )
    config.addinivalue_line(
        "markers", "integration: marks tests as integration tests"
    )
    config.addinivalue_line(
        "markers", "performance: marks tests as performance tests"
    )
```

---

*Last Updated: January 27, 2025*
*Version: 1.0*
*Related PBI: [PBI-9: Database Schema Standardization and UUID Implementation](../../delivery/9/prd.md)* 