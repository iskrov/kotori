# Troubleshooting Guide

## Table of Contents
- [Overview](#overview)
- [Common Issues](#common-issues)
- [Database Issues](#database-issues)
- [Application Issues](#application-issues)
- [Performance Issues](#performance-issues)
- [Migration Issues](#migration-issues)
- [API Issues](#api-issues)
- [Client Integration Issues](#client-integration-issues)
- [Debugging Tools](#debugging-tools)
- [Recovery Procedures](#recovery-procedures)

## Overview

This guide provides comprehensive troubleshooting information for the UUID implementation in the Vibes application. It covers common issues, diagnostic procedures, and solutions for problems that may arise during development, testing, or production use.

### Quick Reference

| Issue Type | Symptoms | Quick Fix |
|------------|----------|-----------|
| Invalid UUID Format | 422 validation errors | Check UUID format |
| Foreign Key Violations | IntegrityError exceptions | Verify related records exist |
| Performance Issues | Slow queries | Check indexes |
| Connection Issues | Database connection errors | Verify connection pool |
| Migration Failures | Schema errors | Check migration scripts |

## Common Issues

### 1. Invalid UUID Format

**Symptoms:**
- HTTP 422 validation errors
- `ValueError: badly formed hexadecimal UUID string`
- API requests failing with UUID validation errors

**Causes:**
- Client sending invalid UUID strings
- Manual UUID construction with wrong format
- Database returning corrupted UUID data

**Diagnosis:**
```python
import uuid

def validate_uuid_format(uuid_string):
    """Validate UUID format"""
    try:
        uuid.UUID(uuid_string)
        return True
    except ValueError as e:
        print(f"Invalid UUID format: {e}")
        return False

# Test examples
test_uuids = [
    "550e8400-e29b-41d4-a716-446655440000",  # Valid
    "550e8400-e29b-41d4-a716",              # Invalid - too short
    "550e8400-e29b-41d4-a716-44665544000g", # Invalid - contains 'g'
    "invalid-uuid-string"                    # Invalid - wrong format
]

for test_uuid in test_uuids:
    print(f"{test_uuid}: {validate_uuid_format(test_uuid)}")
```

**Solutions:**
```python
# 1. Client-side validation
function isValidUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
}

# 2. Server-side validation with better error messages
from fastapi import HTTPException, status
import uuid

def validate_uuid_parameter(uuid_string: str) -> uuid.UUID:
    """Validate and convert UUID parameter"""
    try:
        return uuid.UUID(uuid_string)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid UUID format: {uuid_string}"
        )

# 3. Database-level validation
SELECT id FROM users WHERE id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
```

### 2. Foreign Key Constraint Violations

**Symptoms:**
- `IntegrityError: foreign key constraint fails`
- Database rollback on insert/update operations
- Orphaned records in related tables

**Causes:**
- Attempting to reference non-existent UUID
- Race conditions in concurrent operations
- Incorrect UUID generation or assignment

**Diagnosis:**
```sql
-- Check for orphaned records
SELECT j.id, j.user_id, u.id as user_exists
FROM journals j
LEFT JOIN users u ON j.user_id = u.id
WHERE u.id IS NULL;

-- Check foreign key constraints
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public';
```

**Solutions:**
```python
# 1. Validate foreign key existence before insert
def create_journal_safe(db: Session, title: str, content: str, user_id: uuid.UUID) -> Journal:
    """Create journal with foreign key validation"""
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

# 2. Use database transactions for related operations
from sqlalchemy.orm import Session
from contextlib import contextmanager

@contextmanager
def db_transaction(db: Session):
    """Database transaction context manager"""
    try:
        yield db
        db.commit()
    except Exception as e:
        db.rollback()
        raise e

# Usage
with db_transaction(db) as session:
    user = User(email="test@example.com")
    session.add(user)
    session.flush()  # Get user ID without committing
    
    journal = Journal(
        title="Test Journal",
        content="Content",
        user_id=user.id
    )
    session.add(journal)
    # Transaction commits here if successful
```

### 3. UUID Generation Issues

**Symptoms:**
- Duplicate UUID errors
- NULL UUID values
- Performance issues with UUID generation

**Causes:**
- Incorrect UUID generation method
- Database default value not working
- Race conditions in UUID generation

**Diagnosis:**
```python
import uuid
import time

def test_uuid_generation():
    """Test UUID generation performance and uniqueness"""
    start_time = time.time()
    uuids = set()
    
    for i in range(10000):
        new_uuid = uuid.uuid4()
        if new_uuid in uuids:
            print(f"Duplicate UUID found: {new_uuid}")
        uuids.add(new_uuid)
    
    end_time = time.time()
    print(f"Generated {len(uuids)} unique UUIDs in {end_time - start_time:.2f}s")
    print(f"Generation rate: {len(uuids) / (end_time - start_time):.0f} UUIDs/sec")

test_uuid_generation()
```

**Solutions:**
```python
# 1. Proper SQLAlchemy model definition
from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import UUID
import uuid

class User(Base):
    __tablename__ = "users"
    
    # Correct: Use callable, not called function
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Incorrect: Don't call uuid.uuid4()
    # id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4())

# 2. Database-level UUID generation
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL
);

# 3. Manual UUID generation with validation
def generate_unique_uuid(db: Session, model_class) -> uuid.UUID:
    """Generate unique UUID for a model"""
    max_attempts = 10
    
    for attempt in range(max_attempts):
        new_uuid = uuid.uuid4()
        
        # Check if UUID already exists
        existing = db.query(model_class).filter(model_class.id == new_uuid).first()
        if not existing:
            return new_uuid
    
    raise RuntimeError(f"Failed to generate unique UUID after {max_attempts} attempts")
```

## Database Issues

### 1. PostgreSQL UUID Extension Missing

**Symptoms:**
- `ERROR: function gen_random_uuid() does not exist`
- `ERROR: type "uuid" does not exist`
- Database migration failures

**Diagnosis:**
```sql
-- Check if UUID extension is installed
SELECT * FROM pg_extension WHERE extname = 'uuid-ossp';

-- Check available UUID functions
SELECT proname FROM pg_proc WHERE proname LIKE '%uuid%';
```

**Solutions:**
```sql
-- Install UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Alternative: Use built-in gen_random_uuid() (PostgreSQL 13+)
SELECT gen_random_uuid();

-- Verify installation
SELECT uuid_generate_v4();
```

### 2. Index Performance Issues

**Symptoms:**
- Slow query performance
- High CPU usage during queries
- Query timeouts

**Diagnosis:**
```sql
-- Check index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Check for missing indexes
SELECT 
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch
FROM pg_stat_user_tables
WHERE schemaname = 'public'
AND seq_scan > idx_scan;

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM journals WHERE user_id = '550e8400-e29b-41d4-a716-446655440000';
```

**Solutions:**
```sql
-- Create missing indexes
CREATE INDEX idx_journals_user_id ON journals USING btree (user_id);
CREATE INDEX idx_tags_journal_id ON tags USING btree (journal_id);
CREATE INDEX idx_reminders_user_id ON reminders USING btree (user_id);

-- Create composite indexes for common queries
CREATE INDEX idx_journals_user_created ON journals USING btree (user_id, created_at);
CREATE INDEX idx_reminders_user_time ON reminders USING btree (user_id, reminder_time);

-- Rebuild indexes if necessary
REINDEX TABLE journals;

-- Update table statistics
ANALYZE journals;
```

### 3. Connection Pool Issues

**Symptoms:**
- Connection pool exhausted errors
- Database connection timeouts
- Application hanging on database operations

**Diagnosis:**
```python
from sqlalchemy import event
from sqlalchemy.pool import Pool

# Monitor connection pool
@event.listens_for(Pool, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    print(f"New connection created: {dbapi_connection}")

@event.listens_for(Pool, "checkout")
def receive_checkout(dbapi_connection, connection_record, connection_proxy):
    print(f"Connection checked out: {dbapi_connection}")

@event.listens_for(Pool, "checkin")
def receive_checkin(dbapi_connection, connection_record):
    print(f"Connection checked in: {dbapi_connection}")

# Check pool status
def check_pool_status(engine):
    pool = engine.pool
    print(f"Pool size: {pool.size()}")
    print(f"Checked out connections: {pool.checkedout()}")
    print(f"Overflow connections: {pool.overflow()}")
```

**Solutions:**
```python
# 1. Optimize connection pool configuration
from sqlalchemy import create_engine

engine = create_engine(
    "postgresql://user:password@localhost/vibes_db",
    pool_size=20,           # Increase pool size
    max_overflow=30,        # Allow overflow connections
    pool_pre_ping=True,     # Validate connections
    pool_recycle=3600       # Recycle connections after 1 hour
)

# 2. Implement proper connection management
from contextlib import contextmanager

@contextmanager
def get_db_connection():
    """Context manager for database connections"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# 3. Monitor and alert on connection usage
def monitor_connection_pool(engine):
    """Monitor connection pool usage"""
    pool = engine.pool
    
    if pool.checkedout() > pool.size() * 0.8:
        logger.warning(f"High connection pool usage: {pool.checkedout()}/{pool.size()}")
    
    if pool.overflow() > 0:
        logger.warning(f"Connection pool overflow: {pool.overflow()} connections")
```

## Application Issues

### 1. Serialization Problems

**Symptoms:**
- `TypeError: Object of type UUID is not JSON serializable`
- API responses with UUID serialization errors
- Frontend unable to parse UUID responses

**Diagnosis:**
```python
import json
import uuid

# Test UUID serialization
test_uuid = uuid.uuid4()
try:
    json.dumps({"id": test_uuid})
except TypeError as e:
    print(f"Serialization error: {e}")
```

**Solutions:**
```python
# 1. Custom JSON encoder
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

# 2. Pydantic automatic serialization
from pydantic import BaseModel, UUID4

class UserResponse(BaseModel):
    id: UUID4
    email: str
    
    class Config:
        orm_mode = True

# 3. FastAPI response model
from fastapi import FastAPI
from pydantic import BaseModel, UUID4

app = FastAPI()

class JournalResponse(BaseModel):
    id: UUID4
    title: str

@app.get("/journals/{journal_id}", response_model=JournalResponse)
async def get_journal(journal_id: UUID4):
    # FastAPI handles UUID serialization automatically
    return JournalResponse(id=journal_id, title="Test Journal")
```

### 2. ORM Relationship Issues

**Symptoms:**
- Lazy loading errors with UUID foreign keys
- Relationship queries returning None
- N+1 query problems

**Diagnosis:**
```python
from sqlalchemy.orm import sessionmaker
from backend.models import User, Journal

# Test relationship loading
def test_relationships():
    session = SessionLocal()
    
    # Test user -> journals relationship
    user = session.query(User).first()
    if user:
        print(f"User {user.id} has {len(user.journals)} journals")
        
        # Test journal -> user relationship
        for journal in user.journals:
            print(f"Journal {journal.id} belongs to user {journal.user.id}")
    
    session.close()

test_relationships()
```

**Solutions:**
```python
# 1. Proper relationship definition
from sqlalchemy import Column, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID

class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Correct relationship definition
    journals = relationship("Journal", back_populates="user", cascade="all, delete-orphan")

class Journal(Base):
    __tablename__ = "journals"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Correct back reference
    user = relationship("User", back_populates="journals")

# 2. Eager loading to avoid N+1 queries
from sqlalchemy.orm import joinedload

def get_users_with_journals():
    """Get users with journals using eager loading"""
    return session.query(User).options(
        joinedload(User.journals)
    ).all()

# 3. Explicit join queries
def get_user_journals(user_id: uuid.UUID):
    """Get user journals with explicit join"""
    return session.query(Journal).join(User).filter(
        User.id == user_id
    ).all()
```

### 3. Caching Issues

**Symptoms:**
- Stale data in cache with UUID keys
- Cache misses for UUID-based queries
- Memory leaks in UUID caching

**Diagnosis:**
```python
import redis
import uuid

# Test Redis UUID caching
redis_client = redis.Redis(host='localhost', port=6379, db=0)

def test_uuid_caching():
    """Test UUID caching behavior"""
    test_uuid = uuid.uuid4()
    cache_key = f"user:{test_uuid}"
    
    # Set cache
    redis_client.set(cache_key, "test_data", ex=3600)
    
    # Get cache
    cached_data = redis_client.get(cache_key)
    print(f"Cached data: {cached_data}")
    
    # Test key pattern matching
    pattern = "user:*"
    keys = redis_client.keys(pattern)
    print(f"Found {len(keys)} user keys")

test_uuid_caching()
```

**Solutions:**
```python
# 1. Proper UUID cache key generation
import uuid
import redis

def generate_cache_key(prefix: str, uuid_value: uuid.UUID) -> str:
    """Generate consistent cache key for UUID"""
    return f"{prefix}:{str(uuid_value)}"

# 2. Cache invalidation for UUID-based data
class UUIDCacheManager:
    def __init__(self, redis_client):
        self.redis = redis_client
    
    def set_user_cache(self, user_id: uuid.UUID, data: dict, ttl: int = 3600):
        """Set user cache with UUID key"""
        key = generate_cache_key("user", user_id)
        self.redis.setex(key, ttl, json.dumps(data, cls=UUIDEncoder))
    
    def get_user_cache(self, user_id: uuid.UUID) -> dict:
        """Get user cache with UUID key"""
        key = generate_cache_key("user", user_id)
        cached_data = self.redis.get(key)
        
        if cached_data:
            return json.loads(cached_data)
        return None
    
    def invalidate_user_cache(self, user_id: uuid.UUID):
        """Invalidate user cache"""
        key = generate_cache_key("user", user_id)
        self.redis.delete(key)
        
        # Also invalidate related caches
        pattern = f"user:{user_id}:*"
        keys = self.redis.keys(pattern)
        if keys:
            self.redis.delete(*keys)

# 3. Memory-efficient UUID caching
from functools import lru_cache

@lru_cache(maxsize=1000)
def get_user_cached(user_id_str: str):
    """Cache user data with string UUID key"""
    user_id = uuid.UUID(user_id_str)
    return get_user_from_db(user_id)

# Clear cache when needed
get_user_cached.cache_clear()
```

## Performance Issues

### 1. Slow UUID Queries

**Symptoms:**
- Query response times > 100ms
- High CPU usage during UUID operations
- Database timeout errors

**Diagnosis:**
```sql
-- Enable query statistics
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Check slow queries
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    max_time,
    stddev_time
FROM pg_stat_statements
WHERE mean_time > 50  -- Queries taking more than 50ms
ORDER BY mean_time DESC;

-- Analyze specific query
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM journals WHERE user_id = '550e8400-e29b-41d4-a716-446655440000';
```

**Solutions:**
```sql
-- 1. Add missing indexes
CREATE INDEX CONCURRENTLY idx_journals_user_id ON journals USING btree (user_id);
CREATE INDEX CONCURRENTLY idx_tags_journal_id ON tags USING btree (journal_id);

-- 2. Optimize queries with proper WHERE clauses
-- Good: Use indexed column
SELECT * FROM journals WHERE user_id = '550e8400-e29b-41d4-a716-446655440000';

-- Bad: Function on indexed column
SELECT * FROM journals WHERE user_id::text = '550e8400-e29b-41d4-a716-446655440000';

-- 3. Use LIMIT for large result sets
SELECT * FROM journals 
WHERE user_id = '550e8400-e29b-41d4-a716-446655440000'
ORDER BY created_at DESC 
LIMIT 20;
```

### 2. Memory Usage Issues

**Symptoms:**
- High memory consumption
- Out of memory errors
- Slow garbage collection

**Diagnosis:**
```python
import psutil
import gc
import uuid

def diagnose_memory_usage():
    """Diagnose memory usage issues"""
    process = psutil.Process()
    memory_info = process.memory_info()
    
    print(f"RSS: {memory_info.rss / 1024 / 1024:.2f} MB")
    print(f"VMS: {memory_info.vms / 1024 / 1024:.2f} MB")
    print(f"Memory percent: {process.memory_percent():.2f}%")
    
    # Check for UUID objects in memory
    uuid_objects = [obj for obj in gc.get_objects() if isinstance(obj, uuid.UUID)]
    print(f"UUID objects in memory: {len(uuid_objects)}")
    
    # Check for large collections
    large_lists = [obj for obj in gc.get_objects() 
                   if isinstance(obj, list) and len(obj) > 1000]
    print(f"Large lists in memory: {len(large_lists)}")

diagnose_memory_usage()
```

**Solutions:**
```python
# 1. Implement proper connection management
from contextlib import contextmanager
from sqlalchemy.orm import Session

@contextmanager
def get_db_session():
    """Context manager for database sessions"""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

# 2. Use generators for large datasets
def get_all_journals_generator(db: Session):
    """Generator for large journal datasets"""
    offset = 0
    batch_size = 1000
    
    while True:
        journals = db.query(Journal).offset(offset).limit(batch_size).all()
        if not journals:
            break
        
        for journal in journals:
            yield journal
        
        offset += batch_size

# 3. Implement memory monitoring
import threading
import time

class MemoryMonitor:
    def __init__(self, threshold_mb=1000):
        self.threshold_mb = threshold_mb
        self.monitoring = False
    
    def start_monitoring(self):
        """Start memory monitoring thread"""
        self.monitoring = True
        thread = threading.Thread(target=self._monitor_memory)
        thread.daemon = True
        thread.start()
    
    def _monitor_memory(self):
        """Monitor memory usage"""
        while self.monitoring:
            process = psutil.Process()
            memory_mb = process.memory_info().rss / 1024 / 1024
            
            if memory_mb > self.threshold_mb:
                logger.warning(f"High memory usage: {memory_mb:.2f} MB")
                gc.collect()  # Force garbage collection
            
            time.sleep(30)  # Check every 30 seconds
```

## Migration Issues

### 1. Schema Migration Failures

**Symptoms:**
- Migration scripts failing to execute
- Data type conversion errors
- Foreign key constraint violations during migration

**Diagnosis:**
```sql
-- Check current schema
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'id';

-- Check for data inconsistencies
SELECT 
    table_name,
    COUNT(*) as row_count
FROM information_schema.tables t
JOIN (
    SELECT 'users' as table_name, COUNT(*) as count FROM users
    UNION ALL
    SELECT 'journals' as table_name, COUNT(*) as count FROM journals
) counts ON t.table_name = counts.table_name
WHERE t.table_schema = 'public';
```

**Solutions:**
```sql
-- 1. Backup before migration
pg_dump -h localhost -U postgres -d vibes_db > backup_before_uuid_migration.sql

-- 2. Test migration on copy of production data
CREATE DATABASE vibes_test WITH TEMPLATE vibes_db;

-- 3. Use transactions for migration
BEGIN;

-- Migration steps here
CREATE TABLE users_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- If any step fails, rollback
ROLLBACK;
-- If all steps succeed, commit
COMMIT;
```

### 2. Data Migration Issues

**Symptoms:**
- Data loss during migration
- Orphaned records after migration
- Performance issues during large data migration

**Diagnosis:**
```sql
-- Check for orphaned records
SELECT 
    'journals' as table_name,
    COUNT(*) as orphaned_count
FROM journals j
LEFT JOIN users u ON j.user_id = u.id
WHERE u.id IS NULL;

-- Check data integrity
SELECT 
    COUNT(DISTINCT u.id) as unique_users,
    COUNT(j.id) as total_journals
FROM users u
LEFT JOIN journals j ON u.id = j.user_id;
```

**Solutions:**
```python
# 1. Batch data migration
def migrate_data_in_batches(source_table, target_table, batch_size=1000):
    """Migrate data in batches to avoid memory issues"""
    offset = 0
    
    while True:
        # Get batch of data
        batch = db.execute(f"""
            SELECT * FROM {source_table}
            ORDER BY id
            LIMIT {batch_size} OFFSET {offset}
        """).fetchall()
        
        if not batch:
            break
        
        # Process batch
        for row in batch:
            # Convert to UUID and insert into target table
            new_uuid = uuid.uuid4()
            db.execute(f"""
                INSERT INTO {target_table} (id, ...) 
                VALUES ('{new_uuid}', ...)
            """)
        
        db.commit()
        offset += batch_size
        print(f"Migrated {offset} records")

# 2. Validation after migration
def validate_migration():
    """Validate data after migration"""
    # Check record counts
    old_count = db.execute("SELECT COUNT(*) FROM users_old").scalar()
    new_count = db.execute("SELECT COUNT(*) FROM users").scalar()
    
    if old_count != new_count:
        raise ValueError(f"Record count mismatch: {old_count} vs {new_count}")
    
    # Check for orphaned records
    orphaned = db.execute("""
        SELECT COUNT(*) FROM journals j
        LEFT JOIN users u ON j.user_id = u.id
        WHERE u.id IS NULL
    """).scalar()
    
    if orphaned > 0:
        raise ValueError(f"Found {orphaned} orphaned journal records")
    
    print("Migration validation passed")
```

## API Issues

### 1. UUID Parameter Validation

**Symptoms:**
- 422 Unprocessable Entity errors
- Invalid UUID format messages
- API endpoints not accepting UUID parameters

**Diagnosis:**
```python
import requests
import uuid

def test_api_uuid_handling():
    """Test API UUID parameter handling"""
    base_url = "http://localhost:8000/api/v1"
    
    # Test valid UUID
    valid_uuid = str(uuid.uuid4())
    response = requests.get(f"{base_url}/journals/{valid_uuid}")
    print(f"Valid UUID response: {response.status_code}")
    
    # Test invalid UUID
    invalid_uuid = "invalid-uuid-string"
    response = requests.get(f"{base_url}/journals/{invalid_uuid}")
    print(f"Invalid UUID response: {response.status_code}")
    print(f"Error message: {response.json()}")

test_api_uuid_handling()
```

**Solutions:**
```python
# 1. Proper FastAPI parameter validation
from fastapi import APIRouter, HTTPException, status
import uuid

router = APIRouter()

@router.get("/journals/{journal_id}")
async def get_journal(journal_id: uuid.UUID):
    """FastAPI automatically validates UUID format"""
    try:
        # Process journal_id as UUID
        journal = get_journal_by_id(journal_id)
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

# 2. Custom UUID validation
from pydantic import BaseModel, validator
import uuid

class JournalUpdate(BaseModel):
    title: str
    content: str
    
    @validator('*', pre=True)
    def validate_strings(cls, v):
        if isinstance(v, str) and len(v.strip()) == 0:
            raise ValueError('String fields cannot be empty')
        return v

# 3. Error handling middleware
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse

@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    """Handle ValueError exceptions"""
    return JSONResponse(
        status_code=400,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": str(exc),
                "details": {"request_path": str(request.url.path)}
            }
        }
    )
```

### 2. Response Serialization Issues

**Symptoms:**
- JSON serialization errors with UUID fields
- Inconsistent UUID format in responses
- Client unable to parse UUID responses

**Solutions:**
```python
# 1. Consistent Pydantic response models
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
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID4: lambda v: str(v)
        }

# 2. Custom JSON encoder for FastAPI
from fastapi.encoders import jsonable_encoder
import uuid

def custom_jsonable_encoder(obj):
    """Custom JSON encoder that handles UUIDs"""
    if isinstance(obj, uuid.UUID):
        return str(obj)
    return jsonable_encoder(obj)

# 3. Response formatting middleware
from fastapi import Request, Response
from fastapi.responses import JSONResponse
import json

@app.middleware("http")
async def format_response_middleware(request: Request, call_next):
    """Middleware to format API responses"""
    response = await call_next(request)
    
    if isinstance(response, JSONResponse):
        # Ensure consistent UUID formatting
        content = response.body.decode()
        data = json.loads(content)
        
        # Process data to ensure UUID consistency
        formatted_data = format_uuids_in_response(data)
        
        return JSONResponse(
            content=formatted_data,
            status_code=response.status_code,
            headers=dict(response.headers)
        )
    
    return response

def format_uuids_in_response(data):
    """Recursively format UUIDs in response data"""
    if isinstance(data, dict):
        return {k: format_uuids_in_response(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [format_uuids_in_response(item) for item in data]
    elif isinstance(data, uuid.UUID):
        return str(data)
    else:
        return data
```

## Client Integration Issues

### 1. Frontend UUID Handling

**Symptoms:**
- JavaScript errors with UUID manipulation
- Inconsistent UUID format in frontend
- Client-side validation failures

**Solutions:**
```javascript
// 1. UUID validation function
function isValidUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
}

// 2. UUID handling in API calls
class ApiClient {
    constructor(baseURL) {
        this.baseURL = baseURL;
    }
    
    async getJournal(journalId) {
        if (!isValidUUID(journalId)) {
            throw new Error(`Invalid UUID format: ${journalId}`);
        }
        
        const response = await fetch(`${this.baseURL}/journals/${journalId}`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.getToken()}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'API request failed');
        }
        
        return response.json();
    }
    
    async createJournal(journalData) {
        const response = await fetch(`${this.baseURL}/journals/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.getToken()}`
            },
            body: JSON.stringify(journalData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to create journal');
        }
        
        return response.json();
    }
}

// 3. React component with UUID handling
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

function JournalDetail() {
    const { journalId } = useParams();
    const [journal, setJournal] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        async function fetchJournal() {
            try {
                if (!isValidUUID(journalId)) {
                    throw new Error('Invalid journal ID format');
                }
                
                const apiClient = new ApiClient('/api/v1');
                const journalData = await apiClient.getJournal(journalId);
                setJournal(journalData);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        
        fetchJournal();
    }, [journalId]);
    
    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;
    if (!journal) return <div>Journal not found</div>;
    
    return (
        <div>
            <h1>{journal.title}</h1>
            <p>{journal.content}</p>
            <small>ID: {journal.id}</small>
        </div>
    );
}
```

### 2. Mobile App Integration

**Symptoms:**
- UUID handling issues in mobile apps
- Serialization problems between mobile and API
- Performance issues with UUID operations

**Solutions:**
```swift
// iOS Swift UUID handling
import Foundation

extension UUID {
    var uuidString: String {
        return self.uuidString.lowercased()
    }
}

class APIClient {
    private let baseURL = "https://api.vibes.app/v1"
    
    func getJournal(journalId: UUID) async throws -> Journal {
        guard let url = URL(string: "\(baseURL)/journals/\(journalId.uuidString)") else {
            throw APIError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard httpResponse.statusCode == 200 else {
            throw APIError.httpError(httpResponse.statusCode)
        }
        
        let journal = try JSONDecoder().decode(Journal.self, from: data)
        return journal
    }
}

// Journal model with UUID
struct Journal: Codable {
    let id: UUID
    let userId: UUID
    let title: String
    let content: String
    let createdAt: Date
    let updatedAt: Date
    
    enum CodingKeys: String, CodingKey {
        case id, title, content
        case userId = "user_id"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}
```

## Debugging Tools

### 1. Database Debugging

```sql
-- Enable query logging
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_duration = on;
ALTER SYSTEM SET log_min_duration_statement = 100;  -- Log queries > 100ms

-- Check active queries
SELECT 
    pid,
    now() - pg_stat_activity.query_start AS duration,
    query,
    state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';

-- Check locks
SELECT 
    blocked_locks.pid AS blocked_pid,
    blocked_activity.usename AS blocked_user,
    blocking_locks.pid AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query AS blocked_statement,
    blocking_activity.query AS current_statement_in_blocking_process
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

### 2. Application Debugging

```python
# Debug logging configuration
import logging
import uuid

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# UUID-specific logger
uuid_logger = logging.getLogger('uuid_operations')

def debug_uuid_operation(operation_name, uuid_value, additional_info=None):
    """Debug UUID operations"""
    uuid_logger.debug(f"UUID Operation: {operation_name}")
    uuid_logger.debug(f"UUID Value: {uuid_value}")
    uuid_logger.debug(f"UUID Type: {type(uuid_value)}")
    
    if isinstance(uuid_value, uuid.UUID):
        uuid_logger.debug(f"UUID Version: {uuid_value.version}")
        uuid_logger.debug(f"UUID Variant: {uuid_value.variant}")
    
    if additional_info:
        uuid_logger.debug(f"Additional Info: {additional_info}")

# Performance debugging
import time
from functools import wraps

def debug_performance(func):
    """Decorator to debug function performance"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        result = func(*args, **kwargs)
        end_time = time.time()
        
        execution_time = (end_time - start_time) * 1000  # Convert to ms
        
        logger.debug(f"{func.__name__} executed in {execution_time:.2f}ms")
        
        if execution_time > 100:  # Warn if > 100ms
            logger.warning(f"Slow operation: {func.__name__} took {execution_time:.2f}ms")
        
        return result
    return wrapper

# Usage
@debug_performance
def get_user_journals(user_id: uuid.UUID):
    debug_uuid_operation("get_user_journals", user_id, f"Fetching journals for user")
    return db.query(Journal).filter(Journal.user_id == user_id).all()
```

### 3. API Debugging

```python
# FastAPI debugging middleware
from fastapi import Request, Response
import time
import uuid

@app.middleware("http")
async def debug_requests(request: Request, call_next):
    """Debug API requests and responses"""
    start_time = time.time()
    
    # Log request
    logger.debug(f"Request: {request.method} {request.url}")
    
    # Extract UUID from path
    path_parts = str(request.url.path).split('/')
    uuids_in_path = []
    for part in path_parts:
        try:
            uuid_obj = uuid.UUID(part)
            uuids_in_path.append(str(uuid_obj))
        except ValueError:
            continue
    
    if uuids_in_path:
        logger.debug(f"UUIDs in path: {uuids_in_path}")
    
    response = await call_next(request)
    
    # Log response
    process_time = time.time() - start_time
    logger.debug(f"Response: {response.status_code} in {process_time:.2f}s")
    
    return response
```

## Recovery Procedures

### 1. Database Recovery

```sql
-- Point-in-time recovery
pg_restore --clean --if-exists -h localhost -U postgres -d vibes_db \
  --timestamp="2025-01-27 10:00:00" vibes_backup.sql

-- Selective table recovery
pg_restore --clean --if-exists -h localhost -U postgres -d vibes_db \
  --table=users --table=journals vibes_backup.sql

-- Check data integrity after recovery
SELECT 
    'users' as table_name,
    COUNT(*) as count,
    COUNT(DISTINCT id) as unique_ids
FROM users
UNION ALL
SELECT 
    'journals' as table_name,
    COUNT(*) as count,
    COUNT(DISTINCT id) as unique_ids
FROM journals;
```

### 2. Application Recovery

```python
# Graceful application restart
import signal
import sys
from contextlib import contextmanager

class GracefulShutdown:
    def __init__(self):
        self.shutdown = False
        signal.signal(signal.SIGINT, self._exit_gracefully)
        signal.signal(signal.SIGTERM, self._exit_gracefully)
    
    def _exit_gracefully(self, signum, frame):
        self.shutdown = True
        logger.info("Graceful shutdown initiated")
        
        # Close database connections
        engine.dispose()
        
        # Close other resources
        sys.exit(0)

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Check database connection
        db = next(get_db())
        db.execute("SELECT 1")
        db.close()
        
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "version": "1.0.0"
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(status_code=503, detail="Service unavailable")

# Data consistency check
def check_data_consistency():
    """Check data consistency after recovery"""
    db = next(get_db())
    
    try:
        # Check for orphaned records
        orphaned_journals = db.execute("""
            SELECT COUNT(*) FROM journals j
            LEFT JOIN users u ON j.user_id = u.id
            WHERE u.id IS NULL
        """).scalar()
        
        if orphaned_journals > 0:
            logger.error(f"Found {orphaned_journals} orphaned journal records")
            return False
        
        # Check UUID format consistency
        invalid_uuids = db.execute("""
            SELECT COUNT(*) FROM users
            WHERE id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        """).scalar()
        
        if invalid_uuids > 0:
            logger.error(f"Found {invalid_uuids} invalid UUID records")
            return False
        
        logger.info("Data consistency check passed")
        return True
        
    except Exception as e:
        logger.error(f"Data consistency check failed: {str(e)}")
        return False
    finally:
        db.close()
```

---

*Last Updated: January 27, 2025*
*Version: 1.0*
*Related PBI: [PBI-9: Database Schema Standardization and UUID Implementation](../../delivery/9/prd.md)* 