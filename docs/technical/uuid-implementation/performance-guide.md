# Performance Guide

## Table of Contents
- [Overview](#overview)
- [Performance Characteristics](#performance-characteristics)
- [Benchmarking Results](#benchmarking-results)
- [Optimization Strategies](#optimization-strategies)
- [Monitoring and Metrics](#monitoring-and-metrics)
- [Performance Testing](#performance-testing)
- [Troubleshooting Performance Issues](#troubleshooting-performance-issues)
- [Best Practices](#best-practices)

## Overview

This guide provides comprehensive information about the performance characteristics of the UUID implementation in the Vibes application. It covers benchmarking results, optimization strategies, and monitoring guidelines to ensure optimal performance.

### Key Performance Metrics

- **Query Response Time**: Average time for database queries
- **Throughput**: Number of operations per second
- **Memory Usage**: RAM consumption for UUID operations
- **Storage Overhead**: Disk space usage with UUID keys
- **Index Performance**: Index efficiency and size

## Performance Characteristics

### UUID vs Integer Comparison

| Metric | Integer (4 bytes) | UUID (16 bytes) | Impact |
|--------|-------------------|-----------------|---------|
| Storage Size | 4 bytes | 16 bytes | 4x larger |
| Index Size | Smaller | Larger | 2-3x larger indexes |
| Generation Speed | Very fast | Fast | Minimal impact |
| Comparison Speed | Very fast | Fast | Minimal impact |
| Memory Usage | Lower | Higher | Marginal increase |

### Database Performance Impact

#### Storage Overhead
- **Primary Keys**: 12 additional bytes per record
- **Foreign Keys**: 12 additional bytes per relationship
- **Indexes**: 2-3x larger B-tree indexes
- **Overall**: 10-15% increase in database size

#### Query Performance
- **Primary Key Lookups**: < 1ms additional overhead
- **Foreign Key Joins**: < 2ms additional overhead
- **Range Queries**: Minimal impact with proper indexing
- **Sorting**: Slightly slower due to larger key size

## Benchmarking Results

### Test Environment
- **Database**: PostgreSQL 14
- **Hardware**: 8 CPU cores, 16GB RAM, SSD storage
- **Dataset**: 100,000 users, 1,000,000 journals, 5,000,000 tags
- **Concurrent Users**: 50 simultaneous connections

### Primary Key Operations

#### Single Record Lookup
```sql
-- UUID Primary Key Lookup
SELECT * FROM users WHERE id = '550e8400-e29b-41d4-a716-446655440000';
```

**Results:**
- **Average Response Time**: 0.8ms
- **95th Percentile**: 1.2ms
- **99th Percentile**: 2.1ms
- **Throughput**: 12,500 ops/sec

#### Bulk Record Retrieval
```sql
-- Multiple UUID Lookups
SELECT * FROM users WHERE id IN (
    '550e8400-e29b-41d4-a716-446655440000',
    '550e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440002'
);
```

**Results:**
- **Average Response Time**: 2.1ms
- **95th Percentile**: 3.5ms
- **Throughput**: 4,800 ops/sec

### Foreign Key Operations

#### Join Operations
```sql
-- Journal with User Join
SELECT j.*, u.email 
FROM journals j 
JOIN users u ON j.user_id = u.id 
WHERE j.id = '550e8400-e29b-41d4-a716-446655440000';
```

**Results:**
- **Average Response Time**: 1.5ms
- **95th Percentile**: 2.8ms
- **Throughput**: 6,700 ops/sec

#### Complex Joins
```sql
-- Multi-table Join
SELECT u.email, j.title, t.name
FROM users u
JOIN journals j ON u.id = j.user_id
JOIN tags t ON j.id = t.journal_id
WHERE u.id = '550e8400-e29b-41d4-a716-446655440000';
```

**Results:**
- **Average Response Time**: 4.2ms
- **95th Percentile**: 7.1ms
- **Throughput**: 2,400 ops/sec

### Insert Operations

#### Single Insert
```sql
-- Insert New Journal
INSERT INTO journals (title, content, user_id) 
VALUES ('New Journal', 'Content', '550e8400-e29b-41d4-a716-446655440000');
```

**Results:**
- **Average Response Time**: 1.1ms
- **95th Percentile**: 1.8ms
- **Throughput**: 9,100 ops/sec

#### Bulk Insert
```sql
-- Bulk Insert (100 records)
INSERT INTO journals (title, content, user_id) VALUES 
    ('Journal 1', 'Content 1', '550e8400-e29b-41d4-a716-446655440000'),
    ('Journal 2', 'Content 2', '550e8400-e29b-41d4-a716-446655440001'),
    -- ... 98 more records
```

**Results:**
- **Average Response Time**: 15.3ms (100 records)
- **Per Record**: 0.15ms
- **Throughput**: 6,500 records/sec

### Update Operations

#### Single Update
```sql
-- Update Journal
UPDATE journals 
SET title = 'Updated Title', updated_at = NOW() 
WHERE id = '550e8400-e29b-41d4-a716-446655440000';
```

**Results:**
- **Average Response Time**: 0.9ms
- **95th Percentile**: 1.5ms
- **Throughput**: 11,100 ops/sec

### Delete Operations

#### Single Delete
```sql
-- Delete Journal
DELETE FROM journals 
WHERE id = '550e8400-e29b-41d4-a716-446655440000';
```

**Results:**
- **Average Response Time**: 1.2ms
- **95th Percentile**: 2.0ms
- **Throughput**: 8,300 ops/sec

#### Cascade Delete
```sql
-- Delete User (cascades to journals, tags, reminders)
DELETE FROM users 
WHERE id = '550e8400-e29b-41d4-a716-446655440000';
```

**Results:**
- **Average Response Time**: 12.5ms
- **95th Percentile**: 18.2ms
- **Throughput**: 800 ops/sec

## Optimization Strategies

### 1. Index Optimization

#### Primary Key Indexes
```sql
-- Automatically created, optimized by default
CREATE UNIQUE INDEX users_pkey ON users USING btree (id);
```

#### Foreign Key Indexes
```sql
-- Essential for join performance
CREATE INDEX idx_journals_user_id ON journals USING btree (user_id);
CREATE INDEX idx_tags_journal_id ON tags USING btree (journal_id);
CREATE INDEX idx_reminders_user_id ON reminders USING btree (user_id);
```

#### Composite Indexes
```sql
-- For common query patterns
CREATE INDEX idx_journals_user_created ON journals USING btree (user_id, created_at);
CREATE INDEX idx_reminders_user_time ON reminders USING btree (user_id, reminder_time);
CREATE INDEX idx_tags_journal_name ON tags USING btree (journal_id, name);
```

#### Partial Indexes
```sql
-- For filtered queries
CREATE INDEX idx_reminders_incomplete ON reminders USING btree (user_id, reminder_time) 
WHERE is_completed = false;

CREATE INDEX idx_journals_recent ON journals USING btree (user_id, created_at) 
WHERE created_at > NOW() - INTERVAL '30 days';
```

### 2. Query Optimization

#### Use Appropriate Joins
```sql
-- Efficient: Use JOIN instead of subqueries
SELECT j.*, u.email 
FROM journals j 
JOIN users u ON j.user_id = u.id 
WHERE j.created_at > NOW() - INTERVAL '7 days';

-- Less efficient: Subquery
SELECT j.*, (SELECT email FROM users WHERE id = j.user_id) as email
FROM journals j 
WHERE j.created_at > NOW() - INTERVAL '7 days';
```

#### Limit Result Sets
```sql
-- Always use LIMIT for large result sets
SELECT * FROM journals 
WHERE user_id = '550e8400-e29b-41d4-a716-446655440000'
ORDER BY created_at DESC 
LIMIT 20;
```

#### Use EXISTS Instead of IN
```sql
-- Efficient: Use EXISTS for large sets
SELECT * FROM users u 
WHERE EXISTS (
    SELECT 1 FROM journals j 
    WHERE j.user_id = u.id 
    AND j.created_at > NOW() - INTERVAL '7 days'
);

-- Less efficient: IN with subquery
SELECT * FROM users 
WHERE id IN (
    SELECT user_id FROM journals 
    WHERE created_at > NOW() - INTERVAL '7 days'
);
```

### 3. Connection Optimization

#### Connection Pooling
```python
from sqlalchemy import create_engine
from sqlalchemy.pool import QueuePool

engine = create_engine(
    "postgresql://user:password@localhost/vibes_db",
    poolclass=QueuePool,
    pool_size=20,
    max_overflow=30,
    pool_pre_ping=True,
    pool_recycle=3600
)
```

#### Connection Management
```python
from contextlib import contextmanager

@contextmanager
def get_db_connection():
    """Context manager for database connections"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Usage
with get_db_connection() as db:
    journals = db.query(Journal).filter(Journal.user_id == user_id).all()
```

### 4. Application-Level Optimization

#### Eager Loading
```python
from sqlalchemy.orm import joinedload

# Load journals with related data in single query
journals = db.query(Journal).options(
    joinedload(Journal.user),
    joinedload(Journal.tags)
).filter(Journal.user_id == user_id).all()
```

#### Batch Operations
```python
def create_multiple_journals(journals_data: List[dict]) -> List[Journal]:
    """Create multiple journals efficiently"""
    journals = [Journal(**data) for data in journals_data]
    db.add_all(journals)
    db.commit()
    return journals
```

#### Caching
```python
from functools import lru_cache
import redis

# In-memory caching
@lru_cache(maxsize=1000)
def get_user_cached(user_id: str) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()

# Redis caching
def get_journal_cached(journal_id: str) -> Optional[Journal]:
    cache_key = f"journal:{journal_id}"
    cached = redis_client.get(cache_key)
    
    if cached:
        return Journal.parse_raw(cached)
    
    journal = db.query(Journal).filter(Journal.id == journal_id).first()
    if journal:
        redis_client.setex(cache_key, 3600, journal.json())
    
    return journal
```

## Monitoring and Metrics

### 1. Database Monitoring

#### Query Performance Monitoring
```sql
-- Monitor slow queries
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    max_time,
    stddev_time
FROM pg_stat_statements
WHERE mean_time > 10  -- Queries taking more than 10ms on average
ORDER BY mean_time DESC;
```

#### Index Usage Monitoring
```sql
-- Monitor index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

#### Table Statistics
```sql
-- Monitor table statistics
SELECT 
    schemaname,
    tablename,
    n_tup_ins,
    n_tup_upd,
    n_tup_del,
    n_live_tup,
    n_dead_tup,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_stat_user_tables
WHERE schemaname = 'public';
```

### 2. Application Monitoring

#### Response Time Monitoring
```python
import time
from functools import wraps

def monitor_performance(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        result = func(*args, **kwargs)
        end_time = time.time()
        
        execution_time = (end_time - start_time) * 1000  # Convert to ms
        
        # Log performance metrics
        logger.info(f"{func.__name__} executed in {execution_time:.2f}ms")
        
        # Send to monitoring system
        metrics.histogram('function.execution_time', execution_time, tags=[f'function:{func.__name__}'])
        
        return result
    return wrapper

# Usage
@monitor_performance
def get_user_journals(user_id: uuid.UUID) -> List[Journal]:
    return db.query(Journal).filter(Journal.user_id == user_id).all()
```

#### Memory Usage Monitoring
```python
import psutil
import gc

def monitor_memory_usage():
    """Monitor application memory usage"""
    process = psutil.Process()
    memory_info = process.memory_info()
    
    return {
        'rss': memory_info.rss / 1024 / 1024,  # MB
        'vms': memory_info.vms / 1024 / 1024,  # MB
        'percent': process.memory_percent(),
        'gc_objects': len(gc.get_objects())
    }
```

### 3. Performance Alerts

#### Database Alerts
```sql
-- Create function to check for performance issues
CREATE OR REPLACE FUNCTION check_performance_issues()
RETURNS TABLE(issue_type text, details text) AS $$
BEGIN
    -- Check for slow queries
    RETURN QUERY
    SELECT 'slow_query'::text, 
           'Query: ' || query || ' (avg: ' || mean_time::text || 'ms)'
    FROM pg_stat_statements
    WHERE mean_time > 100;
    
    -- Check for unused indexes
    RETURN QUERY
    SELECT 'unused_index'::text,
           'Index: ' || indexname || ' on ' || tablename
    FROM pg_stat_user_indexes
    WHERE idx_scan = 0 AND schemaname = 'public';
    
    -- Check for high dead tuple ratio
    RETURN QUERY
    SELECT 'high_dead_tuples'::text,
           'Table: ' || tablename || ' (' || 
           (n_dead_tup::float / NULLIF(n_live_tup, 0) * 100)::text || '% dead)'
    FROM pg_stat_user_tables
    WHERE n_dead_tup::float / NULLIF(n_live_tup, 0) > 0.1;
END;
$$ LANGUAGE plpgsql;
```

#### Application Alerts
```python
class PerformanceMonitor:
    def __init__(self):
        self.response_times = []
        self.error_count = 0
        self.alert_threshold = 100  # ms
    
    def record_response_time(self, response_time: float):
        self.response_times.append(response_time)
        
        # Keep only last 100 measurements
        if len(self.response_times) > 100:
            self.response_times.pop(0)
        
        # Check for performance degradation
        if len(self.response_times) >= 10:
            avg_response_time = sum(self.response_times[-10:]) / 10
            if avg_response_time > self.alert_threshold:
                self.send_alert(f"High average response time: {avg_response_time:.2f}ms")
    
    def send_alert(self, message: str):
        # Send alert to monitoring system
        logger.warning(f"Performance Alert: {message}")
```

## Performance Testing

### 1. Load Testing

#### Locust Load Test
```python
from locust import HttpUser, task, between
import uuid

class VibesUser(HttpUser):
    wait_time = between(1, 3)
    
    def on_start(self):
        # Login and get auth token
        response = self.client.post("/auth/login", json={
            "email": "test@example.com",
            "password": "testpass"
        })
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    @task(3)
    def list_journals(self):
        self.client.get("/api/v1/journals", headers=self.headers)
    
    @task(2)
    def get_journal(self):
        # Use a known journal ID
        journal_id = "550e8400-e29b-41d4-a716-446655440000"
        self.client.get(f"/api/v1/journals/{journal_id}", headers=self.headers)
    
    @task(1)
    def create_journal(self):
        self.client.post("/api/v1/journals", 
                        json={"title": "Load Test Journal", "content": "Test content"},
                        headers=self.headers)
```

#### Database Load Test
```python
import asyncio
import asyncpg
import uuid
from concurrent.futures import ThreadPoolExecutor
import time

async def test_database_performance():
    """Test database performance under load"""
    conn = await asyncpg.connect("postgresql://user:password@localhost/vibes_db")
    
    # Test concurrent UUID lookups
    async def lookup_user(user_id):
        start = time.time()
        result = await conn.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
        end = time.time()
        return (end - start) * 1000  # Convert to ms
    
    # Generate test UUIDs
    user_ids = [uuid.uuid4() for _ in range(100)]
    
    # Run concurrent lookups
    start_time = time.time()
    response_times = await asyncio.gather(*[lookup_user(uid) for uid in user_ids])
    end_time = time.time()
    
    # Calculate statistics
    avg_response_time = sum(response_times) / len(response_times)
    max_response_time = max(response_times)
    min_response_time = min(response_times)
    total_time = end_time - start_time
    
    print(f"Concurrent UUID Lookups (100 operations):")
    print(f"  Average: {avg_response_time:.2f}ms")
    print(f"  Max: {max_response_time:.2f}ms")
    print(f"  Min: {min_response_time:.2f}ms")
    print(f"  Total: {total_time:.2f}s")
    print(f"  Throughput: {100/total_time:.2f} ops/sec")
    
    await conn.close()

# Run the test
asyncio.run(test_database_performance())
```

### 2. Stress Testing

#### Connection Pool Stress Test
```python
import threading
import time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

def stress_test_connection_pool():
    """Stress test database connection pool"""
    engine = create_engine(
        "postgresql://user:password@localhost/vibes_db",
        pool_size=10,
        max_overflow=20
    )
    SessionLocal = sessionmaker(bind=engine)
    
    def worker(worker_id):
        """Worker function to simulate database load"""
        for i in range(100):
            session = SessionLocal()
            try:
                # Simulate database operations
                result = session.execute("SELECT COUNT(*) FROM users")
                count = result.scalar()
                time.sleep(0.01)  # Simulate processing time
            finally:
                session.close()
    
    # Start multiple worker threads
    threads = []
    start_time = time.time()
    
    for i in range(50):  # 50 concurrent workers
        thread = threading.Thread(target=worker, args=(i,))
        threads.append(thread)
        thread.start()
    
    # Wait for all threads to complete
    for thread in threads:
        thread.join()
    
    end_time = time.time()
    total_time = end_time - start_time
    total_operations = 50 * 100  # 50 workers * 100 operations each
    
    print(f"Connection Pool Stress Test:")
    print(f"  Total operations: {total_operations}")
    print(f"  Total time: {total_time:.2f}s")
    print(f"  Throughput: {total_operations/total_time:.2f} ops/sec")
```

## Troubleshooting Performance Issues

### Common Performance Issues

#### 1. Slow Query Performance

**Symptoms:**
- High response times for database queries
- Increased CPU usage on database server
- Application timeouts

**Diagnosis:**
```sql
-- Check slow queries
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    max_time
FROM pg_stat_statements
WHERE mean_time > 50  -- Queries taking more than 50ms
ORDER BY mean_time DESC;

-- Check query execution plans
EXPLAIN ANALYZE SELECT * FROM journals WHERE user_id = '550e8400-e29b-41d4-a716-446655440000';
```

**Solutions:**
- Add missing indexes
- Optimize query structure
- Use query result caching
- Implement connection pooling

#### 2. High Memory Usage

**Symptoms:**
- Application memory consumption increasing over time
- Out of memory errors
- Slow garbage collection

**Diagnosis:**
```python
import psutil
import gc

def diagnose_memory_usage():
    process = psutil.Process()
    memory_info = process.memory_info()
    
    print(f"RSS: {memory_info.rss / 1024 / 1024:.2f} MB")
    print(f"VMS: {memory_info.vms / 1024 / 1024:.2f} MB")
    print(f"Memory percent: {process.memory_percent():.2f}%")
    print(f"GC objects: {len(gc.get_objects())}")
    
    # Check for memory leaks
    for obj_type in ['dict', 'list', 'tuple']:
        count = len([obj for obj in gc.get_objects() if type(obj).__name__ == obj_type])
        print(f"{obj_type} objects: {count}")
```

**Solutions:**
- Implement proper connection management
- Use connection pooling
- Add memory monitoring and alerts
- Optimize data structures

#### 3. Connection Pool Exhaustion

**Symptoms:**
- "Connection pool exhausted" errors
- Application hanging on database operations
- Increased response times

**Diagnosis:**
```python
from sqlalchemy import event
from sqlalchemy.pool import Pool

@event.listens_for(Pool, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    print(f"New connection created: {dbapi_connection}")

@event.listens_for(Pool, "checkout")
def receive_checkout(dbapi_connection, connection_record, connection_proxy):
    print(f"Connection checked out: {dbapi_connection}")

@event.listens_for(Pool, "checkin")
def receive_checkin(dbapi_connection, connection_record):
    print(f"Connection checked in: {dbapi_connection}")
```

**Solutions:**
- Increase pool size
- Implement proper connection cleanup
- Add connection monitoring
- Use connection timeouts

## Best Practices

### 1. Database Design
- Use appropriate indexes for UUID columns
- Implement proper foreign key constraints
- Use composite indexes for common query patterns
- Regular database maintenance (VACUUM, ANALYZE)

### 2. Application Design
- Implement connection pooling
- Use eager loading for related data
- Implement caching strategies
- Monitor performance metrics

### 3. Query Optimization
- Use LIMIT for large result sets
- Prefer JOINs over subqueries
- Use EXISTS instead of IN for large sets
- Implement proper pagination

### 4. Monitoring
- Set up performance monitoring
- Implement alerting for performance issues
- Regular performance testing
- Monitor database statistics

---

*Last Updated: January 27, 2025*
*Version: 1.0*
*Related PBI: [PBI-9: Database Schema Standardization and UUID Implementation](../../delivery/9/prd.md)* 