# Developer Guide

## Table of Contents
- [Overview](#overview)
- [Working with UUIDs](#working-with-uuids)
- [Model Development](#model-development)
- [API Development](#api-development)
- [Service Layer Development](#service-layer-development)
- [Testing Guidelines](#testing-guidelines)
- [Best Practices](#best-practices)
- [Common Patterns](#common-patterns)
- [Performance Considerations](#performance-considerations)
- [Troubleshooting](#troubleshooting)

## Overview

This guide provides comprehensive information for developers working with the UUID-based implementation in the Vibes application. It covers best practices, common patterns, and practical examples for developing features with UUID identifiers.

### Key Concepts

- **UUID (Universally Unique Identifier)**: 128-bit identifier that is unique across all systems
- **Primary Key**: UUID used as the primary identifier for database entities
- **Foreign Key**: UUID used to reference related entities
- **Validation**: Ensuring UUID format correctness in API requests

## Working with UUIDs

### UUID Format

UUIDs follow the standard format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

Example: `550e8400-e29b-41d4-a716-446655440000`

### UUID Generation

#### Python UUID Generation

```python
import uuid

# Generate a new UUID4 (random)
new_uuid = uuid.uuid4()
print(new_uuid)  # 550e8400-e29b-41d4-a716-446655440000

# Convert to string
uuid_str = str(new_uuid)

# Create UUID from string
uuid_obj = uuid.UUID('550e8400-e29b-41d4-a716-446655440000')
```

#### Database UUID Generation

```sql
-- PostgreSQL UUID generation
SELECT gen_random_uuid();

-- Using uuid-ossp extension
SELECT uuid_generate_v4();
```

### UUID Validation

#### Python UUID Validation

```python
import uuid

def is_valid_uuid(uuid_string):
    """Validate UUID format"""
    try:
        uuid.UUID(uuid_string)
        return True
    except ValueError:
        return False

# Usage
if is_valid_uuid('550e8400-e29b-41d4-a716-446655440000'):
    print("Valid UUID")
else:
    print("Invalid UUID")
```

#### Pydantic UUID Validation

```python
from pydantic import BaseModel, UUID4, validator

class JournalCreate(BaseModel):
    title: str
    content: str
    
class JournalResponse(BaseModel):
    id: UUID4
    user_id: UUID4
    title: str
    content: str
    
    @validator('id', 'user_id')
    def validate_uuid(cls, v):
        if not v:
            raise ValueError('UUID cannot be empty')
        return v
```

## Model Development

### SQLAlchemy Model Definition

```python
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from backend.database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    journals = relationship("Journal", back_populates="user", cascade="all, delete-orphan")
    reminders = relationship("Reminder", back_populates="user", cascade="all, delete-orphan")

class Journal(Base):
    __tablename__ = "journals"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    content = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="journals")
    tags = relationship("Tag", back_populates="journal", cascade="all, delete-orphan")
    secret_tags = relationship("SecretTag", back_populates="journal", cascade="all, delete-orphan")
```

### Model Best Practices

#### 1. UUID Column Definition

```python
# Correct: Use UUID with as_uuid=True
id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

# Incorrect: Using string for UUID
id = Column(String(36), primary_key=True)
```

#### 2. Foreign Key Relationships

```python
# Correct: UUID foreign key with proper type
user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

# Correct: Relationship definition
user = relationship("User", back_populates="journals")
```

#### 3. Default Value Handling

```python
# Correct: Use uuid.uuid4 (callable) not uuid.uuid4()
id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

# Incorrect: Using uuid.uuid4() (already called)
id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4())
```

## API Development

### FastAPI Route Definition

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import uuid

from backend.database import get_db
from backend.models import Journal, User
from backend.schemas import JournalCreate, JournalResponse
from backend.dependencies import get_current_user

router = APIRouter(prefix="/journals", tags=["journals"])

@router.post("/", response_model=JournalResponse)
async def create_journal(
    journal: JournalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new journal entry"""
    db_journal = Journal(
        title=journal.title,
        content=journal.content,
        user_id=current_user.id
    )
    db.add(db_journal)
    db.commit()
    db.refresh(db_journal)
    return db_journal

@router.get("/{journal_id}", response_model=JournalResponse)
async def get_journal(
    journal_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific journal entry"""
    journal = db.query(Journal).filter(
        Journal.id == journal_id,
        Journal.user_id == current_user.id
    ).first()
    
    if not journal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Journal not found"
        )
    
    return journal

@router.get("/", response_model=List[JournalResponse])
async def list_journals(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List user's journal entries"""
    journals = db.query(Journal).filter(
        Journal.user_id == current_user.id
    ).offset(skip).limit(limit).all()
    
    return journals

@router.put("/{journal_id}", response_model=JournalResponse)
async def update_journal(
    journal_id: uuid.UUID,
    journal_update: JournalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a journal entry"""
    journal = db.query(Journal).filter(
        Journal.id == journal_id,
        Journal.user_id == current_user.id
    ).first()
    
    if not journal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Journal not found"
        )
    
    journal.title = journal_update.title
    journal.content = journal_update.content
    db.commit()
    db.refresh(journal)
    
    return journal

@router.delete("/{journal_id}")
async def delete_journal(
    journal_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a journal entry"""
    journal = db.query(Journal).filter(
        Journal.id == journal_id,
        Journal.user_id == current_user.id
    ).first()
    
    if not journal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Journal not found"
        )
    
    db.delete(journal)
    db.commit()
    
    return {"message": "Journal deleted successfully"}
```

### API Best Practices

#### 1. Path Parameter Validation

```python
# Correct: Use uuid.UUID for automatic validation
@router.get("/{journal_id}")
async def get_journal(journal_id: uuid.UUID):
    pass

# Incorrect: Using string without validation
@router.get("/{journal_id}")
async def get_journal(journal_id: str):
    pass
```

#### 2. Error Handling

```python
@router.get("/{journal_id}")
async def get_journal(journal_id: uuid.UUID, db: Session = Depends(get_db)):
    try:
        journal = db.query(Journal).filter(Journal.id == journal_id).first()
        if not journal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Journal with id {journal_id} not found"
            )
        return journal
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid UUID format: {str(e)}"
        )
```

#### 3. Response Models

```python
from pydantic import BaseModel, UUID4
from datetime import datetime

class JournalResponse(BaseModel):
    id: UUID4
    user_id: UUID4
    title: str
    content: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        orm_mode = True
```

## Service Layer Development

### Service Class Implementation

```python
from typing import List, Optional
from sqlalchemy.orm import Session
import uuid

from backend.models import Journal, User
from backend.schemas import JournalCreate, JournalUpdate

class JournalService:
    def __init__(self, db: Session):
        self.db = db
    
    def create_journal(self, journal_data: JournalCreate, user_id: uuid.UUID) -> Journal:
        """Create a new journal entry"""
        db_journal = Journal(
            title=journal_data.title,
            content=journal_data.content,
            user_id=user_id
        )
        self.db.add(db_journal)
        self.db.commit()
        self.db.refresh(db_journal)
        return db_journal
    
    def get_journal(self, journal_id: uuid.UUID, user_id: uuid.UUID) -> Optional[Journal]:
        """Get a journal by ID for a specific user"""
        return self.db.query(Journal).filter(
            Journal.id == journal_id,
            Journal.user_id == user_id
        ).first()
    
    def list_journals(self, user_id: uuid.UUID, skip: int = 0, limit: int = 20) -> List[Journal]:
        """List journals for a user"""
        return self.db.query(Journal).filter(
            Journal.user_id == user_id
        ).offset(skip).limit(limit).all()
    
    def update_journal(
        self, 
        journal_id: uuid.UUID, 
        journal_data: JournalUpdate, 
        user_id: uuid.UUID
    ) -> Optional[Journal]:
        """Update a journal entry"""
        journal = self.get_journal(journal_id, user_id)
        if not journal:
            return None
        
        for field, value in journal_data.dict(exclude_unset=True).items():
            setattr(journal, field, value)
        
        self.db.commit()
        self.db.refresh(journal)
        return journal
    
    def delete_journal(self, journal_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """Delete a journal entry"""
        journal = self.get_journal(journal_id, user_id)
        if not journal:
            return False
        
        self.db.delete(journal)
        self.db.commit()
        return True
    
    def get_journals_by_user(self, user_id: uuid.UUID) -> List[Journal]:
        """Get all journals for a user"""
        return self.db.query(Journal).filter(Journal.user_id == user_id).all()
```

### Service Best Practices

#### 1. Type Hints

```python
# Correct: Use proper type hints with UUID
def get_journal(self, journal_id: uuid.UUID, user_id: uuid.UUID) -> Optional[Journal]:
    pass

# Incorrect: Using generic types
def get_journal(self, journal_id, user_id):
    pass
```

#### 2. Error Handling

```python
def get_journal(self, journal_id: uuid.UUID, user_id: uuid.UUID) -> Optional[Journal]:
    try:
        return self.db.query(Journal).filter(
            Journal.id == journal_id,
            Journal.user_id == user_id
        ).first()
    except Exception as e:
        logger.error(f"Error retrieving journal {journal_id}: {str(e)}")
        return None
```

#### 3. Relationship Handling

```python
def get_journal_with_tags(self, journal_id: uuid.UUID, user_id: uuid.UUID) -> Optional[Journal]:
    """Get journal with related tags"""
    return self.db.query(Journal).filter(
        Journal.id == journal_id,
        Journal.user_id == user_id
    ).options(
        joinedload(Journal.tags),
        joinedload(Journal.secret_tags)
    ).first()
```

## Testing Guidelines

### Unit Testing

```python
import pytest
import uuid
from unittest.mock import Mock, patch
from sqlalchemy.orm import Session

from backend.models import Journal, User
from backend.services.journal_service import JournalService
from backend.schemas import JournalCreate

class TestJournalService:
    @pytest.fixture
    def mock_db(self):
        return Mock(spec=Session)
    
    @pytest.fixture
    def journal_service(self, mock_db):
        return JournalService(mock_db)
    
    @pytest.fixture
    def sample_user_id(self):
        return uuid.uuid4()
    
    @pytest.fixture
    def sample_journal_id(self):
        return uuid.uuid4()
    
    def test_create_journal_success(self, journal_service, mock_db, sample_user_id):
        """Test successful journal creation"""
        # Arrange
        journal_data = JournalCreate(
            title="Test Journal",
            content="Test content"
        )
        
        # Act
        result = journal_service.create_journal(journal_data, sample_user_id)
        
        # Assert
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
        mock_db.refresh.assert_called_once()
        assert result.title == "Test Journal"
        assert result.user_id == sample_user_id
    
    def test_get_journal_success(self, journal_service, mock_db, sample_journal_id, sample_user_id):
        """Test successful journal retrieval"""
        # Arrange
        expected_journal = Journal(
            id=sample_journal_id,
            user_id=sample_user_id,
            title="Test Journal"
        )
        mock_db.query.return_value.filter.return_value.first.return_value = expected_journal
        
        # Act
        result = journal_service.get_journal(sample_journal_id, sample_user_id)
        
        # Assert
        assert result == expected_journal
        mock_db.query.assert_called_once_with(Journal)
    
    def test_get_journal_not_found(self, journal_service, mock_db, sample_journal_id, sample_user_id):
        """Test journal not found scenario"""
        # Arrange
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        # Act
        result = journal_service.get_journal(sample_journal_id, sample_user_id)
        
        # Assert
        assert result is None
```

### Integration Testing

```python
import pytest
import uuid
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app import app
from backend.database import get_db
from backend.models import User, Journal

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def test_user(db_session):
    user = User(
        email="test@example.com"
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def test_journal(db_session, test_user):
    journal = Journal(
        title="Test Journal",
        content="Test content",
        user_id=test_user.id
    )
    db_session.add(journal)
    db_session.commit()
    db_session.refresh(journal)
    return journal

class TestJournalAPI:
    def test_create_journal_success(self, client, test_user, auth_headers):
        """Test successful journal creation via API"""
        # Arrange
        journal_data = {
            "title": "New Journal",
            "content": "New content"
        }
        
        # Act
        response = client.post(
            "/api/v1/journals/",
            json=journal_data,
            headers=auth_headers
        )
        
        # Assert
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "New Journal"
        assert "id" in data
        assert uuid.UUID(data["id"])  # Validate UUID format
    
    def test_get_journal_success(self, client, test_journal, auth_headers):
        """Test successful journal retrieval via API"""
        # Act
        response = client.get(
            f"/api/v1/journals/{test_journal.id}",
            headers=auth_headers
        )
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_journal.id)
        assert data["title"] == test_journal.title
    
    def test_get_journal_invalid_uuid(self, client, auth_headers):
        """Test invalid UUID format handling"""
        # Act
        response = client.get(
            "/api/v1/journals/invalid-uuid",
            headers=auth_headers
        )
        
        # Assert
        assert response.status_code == 422
        data = response.json()
        assert "detail" in data
```

## Best Practices

### 1. UUID Handling

```python
# Correct: Use uuid.UUID type for parameters
def process_journal(journal_id: uuid.UUID) -> Journal:
    pass

# Correct: Convert string to UUID when needed
def process_journal_from_string(journal_id_str: str) -> Journal:
    journal_id = uuid.UUID(journal_id_str)
    return process_journal(journal_id)

# Incorrect: Using string for UUID operations
def process_journal(journal_id: str) -> Journal:
    pass
```

### 2. Database Queries

```python
# Correct: Use UUID directly in queries
journal = db.query(Journal).filter(Journal.id == journal_uuid).first()

# Correct: Use proper joins with UUID foreign keys
journals_with_users = db.query(Journal).join(User).filter(
    User.id == user_uuid
).all()

# Incorrect: Converting UUID to string unnecessarily
journal = db.query(Journal).filter(Journal.id == str(journal_uuid)).first()
```

### 3. API Response Handling

```python
# Correct: Let Pydantic handle UUID serialization
class JournalResponse(BaseModel):
    id: UUID4
    user_id: UUID4
    title: str
    
    class Config:
        orm_mode = True

# Incorrect: Manual UUID to string conversion
def get_journal_dict(journal):
    return {
        "id": str(journal.id),
        "user_id": str(journal.user_id),
        "title": journal.title
    }
```

### 4. Error Handling

```python
def get_journal_safe(journal_id_str: str) -> Optional[Journal]:
    """Safely get journal with UUID validation"""
    try:
        journal_id = uuid.UUID(journal_id_str)
        return db.query(Journal).filter(Journal.id == journal_id).first()
    except ValueError:
        logger.warning(f"Invalid UUID format: {journal_id_str}")
        return None
    except Exception as e:
        logger.error(f"Error retrieving journal: {str(e)}")
        return None
```

## Common Patterns

### 1. UUID Generation Pattern

```python
class BaseModel(Base):
    """Base model with UUID primary key"""
    __abstract__ = True
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
```

### 2. Repository Pattern

```python
from abc import ABC, abstractmethod
from typing import List, Optional
import uuid

class BaseRepository(ABC):
    """Base repository interface"""
    
    @abstractmethod
    def create(self, entity_data: dict) -> any:
        pass
    
    @abstractmethod
    def get_by_id(self, entity_id: uuid.UUID) -> Optional[any]:
        pass
    
    @abstractmethod
    def update(self, entity_id: uuid.UUID, entity_data: dict) -> Optional[any]:
        pass
    
    @abstractmethod
    def delete(self, entity_id: uuid.UUID) -> bool:
        pass

class JournalRepository(BaseRepository):
    """Journal repository implementation"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create(self, journal_data: dict) -> Journal:
        journal = Journal(**journal_data)
        self.db.add(journal)
        self.db.commit()
        self.db.refresh(journal)
        return journal
    
    def get_by_id(self, journal_id: uuid.UUID) -> Optional[Journal]:
        return self.db.query(Journal).filter(Journal.id == journal_id).first()
    
    def get_by_user(self, user_id: uuid.UUID) -> List[Journal]:
        return self.db.query(Journal).filter(Journal.user_id == user_id).all()
    
    def update(self, journal_id: uuid.UUID, journal_data: dict) -> Optional[Journal]:
        journal = self.get_by_id(journal_id)
        if not journal:
            return None
        
        for key, value in journal_data.items():
            setattr(journal, key, value)
        
        self.db.commit()
        self.db.refresh(journal)
        return journal
    
    def delete(self, journal_id: uuid.UUID) -> bool:
        journal = self.get_by_id(journal_id)
        if not journal:
            return False
        
        self.db.delete(journal)
        self.db.commit()
        return True
```

### 3. Factory Pattern

```python
class EntityFactory:
    """Factory for creating entities with proper UUID handling"""
    
    @staticmethod
    def create_user(email: str) -> User:
        return User(
            email=email
        )
    
    @staticmethod
    def create_journal(title: str, content: str, user_id: uuid.UUID) -> Journal:
        return Journal(
            title=title,
            content=content,
            user_id=user_id
        )
    
    @staticmethod
    def create_tag(name: str, journal_id: uuid.UUID) -> Tag:
        return Tag(
            name=name,
            journal_id=journal_id
        )
```

## Performance Considerations

### 1. Query Optimization

```python
# Efficient: Use joins instead of separate queries
def get_journals_with_tags(user_id: uuid.UUID) -> List[Journal]:
    return db.query(Journal).options(
        joinedload(Journal.tags)
    ).filter(Journal.user_id == user_id).all()

# Inefficient: N+1 query problem
def get_journals_with_tags_inefficient(user_id: uuid.UUID) -> List[Journal]:
    journals = db.query(Journal).filter(Journal.user_id == user_id).all()
    for journal in journals:
        journal.tags  # This triggers separate query for each journal
    return journals
```

### 2. Bulk Operations

```python
def create_multiple_journals(journals_data: List[dict], user_id: uuid.UUID) -> List[Journal]:
    """Efficiently create multiple journals"""
    journals = [
        Journal(user_id=user_id, **journal_data)
        for journal_data in journals_data
    ]
    
    db.add_all(journals)
    db.commit()
    
    # Refresh all at once
    for journal in journals:
        db.refresh(journal)
    
    return journals
```

### 3. Caching Strategies

```python
from functools import lru_cache
import redis

# In-memory caching
@lru_cache(maxsize=128)
def get_user_cached(user_id: uuid.UUID) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()

# Redis caching
def get_journal_cached(journal_id: uuid.UUID) -> Optional[Journal]:
    cache_key = f"journal:{journal_id}"
    cached_data = redis_client.get(cache_key)
    
    if cached_data:
        return Journal.parse_raw(cached_data)
    
    journal = db.query(Journal).filter(Journal.id == journal_id).first()
    if journal:
        redis_client.setex(
            cache_key,
            3600,  # 1 hour TTL
            journal.json()
        )
    
    return journal
```

## Troubleshooting

### Common Issues and Solutions

#### 1. UUID Validation Errors

**Problem**: Invalid UUID format in API requests

**Solution**:
```python
from fastapi import HTTPException, status

@router.get("/{journal_id}")
async def get_journal(journal_id: uuid.UUID):
    try:
        # FastAPI automatically validates UUID format
        return get_journal_by_id(journal_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid UUID format: {str(e)}"
        )
```

#### 2. Database Connection Issues

**Problem**: UUID type not recognized by database

**Solution**:
```python
# Ensure PostgreSQL UUID extension is enabled
from sqlalchemy import text

def ensure_uuid_extension(engine):
    with engine.connect() as conn:
        conn.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'))
        conn.commit()
```

#### 3. Serialization Issues

**Problem**: UUID not serializable to JSON

**Solution**:
```python
import json
import uuid

class UUIDEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, uuid.UUID):
            return str(obj)
        return super().default(obj)

# Usage
data = {"id": uuid.uuid4()}
json_string = json.dumps(data, cls=UUIDEncoder)
```

#### 4. Foreign Key Constraint Violations

**Problem**: Foreign key constraints fail with UUID references

**Solution**:
```python
def create_journal_safe(title: str, content: str, user_id: uuid.UUID) -> Optional[Journal]:
    """Safely create journal with foreign key validation"""
    # Verify user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError(f"User with ID {user_id} not found")
    
    journal = Journal(
        title=title,
        content=content,
        user_id=user_id
    )
    
    try:
        db.add(journal)
        db.commit()
        db.refresh(journal)
        return journal
    except IntegrityError as e:
        db.rollback()
        raise ValueError(f"Failed to create journal: {str(e)}")
```

---

*Last Updated: January 27, 2025*
*Version: 1.0*
*Related PBI: [PBI-9: Database Schema Standardization and UUID Implementation](../../delivery/9/prd.md)* 