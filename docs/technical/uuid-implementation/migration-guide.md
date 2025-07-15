# Migration Guide

## Table of Contents
- [Overview](#overview)
- [Pre-Migration Checklist](#pre-migration-checklist)
- [Migration Steps](#migration-steps)
- [Post-Migration Validation](#post-migration-validation)
- [Rollback Procedures](#rollback-procedures)
- [Environment-Specific Considerations](#environment-specific-considerations)
- [Troubleshooting](#troubleshooting)

## Overview

This guide provides step-by-step instructions for migrating from integer-based primary keys to UUID-based primary keys in the Vibes application. The migration involves database schema changes, application code updates, and comprehensive validation procedures.

### Migration Impact

- **Database Schema**: Complete restructure of all tables with UUID primary keys
- **Application Code**: Updated models, services, and API endpoints
- **Client Applications**: All client applications must be updated to handle UUIDs
- **Data Migration**: Existing data requires careful migration to new schema

### Prerequisites

- PostgreSQL 12+ with UUID extension support
- Application downtime window (estimated 30-60 minutes)
- Database backup and restore capabilities
- Staging environment for testing

## Pre-Migration Checklist

### 1. Environment Preparation

- [ ] **Database Backup**: Create full database backup
- [ ] **Application Backup**: Backup current application code
- [ ] **Environment Setup**: Prepare staging environment
- [ ] **Dependencies**: Verify PostgreSQL UUID extension availability
- [ ] **Monitoring**: Set up monitoring for migration process

### 2. Testing Validation

- [ ] **Unit Tests**: All tests pass in staging environment
- [ ] **Integration Tests**: API endpoints validated with UUID parameters
- [ ] **Performance Tests**: Query performance benchmarks established
- [ ] **Load Tests**: Application handles expected traffic with UUIDs

### 3. Team Preparation

- [ ] **Team Training**: Development team familiar with UUID implementation
- [ ] **Documentation**: All team members have access to documentation
- [ ] **Communication**: Stakeholders notified of migration schedule
- [ ] **Rollback Plan**: Team understands rollback procedures

### 4. Client Application Updates

- [ ] **API Clients**: All client applications updated to handle UUIDs
- [ ] **Mobile Apps**: Mobile applications updated and tested
- [ ] **Web Frontend**: Frontend applications updated and tested
- [ ] **Third-party Integrations**: External integrations updated

## Migration Steps

### Step 1: Database Preparation

#### 1.1 Create Database Backup

```bash
# Create full database backup
pg_dump -h localhost -U postgres -d vibes_db > vibes_backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup integrity
pg_restore --list vibes_backup_$(date +%Y%m%d_%H%M%S).sql
```

#### 1.2 Enable UUID Extension

```sql
-- Connect to database and enable UUID extension
\c vibes_db;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Verify extension is available
SELECT * FROM pg_extension WHERE extname = 'uuid-ossp';
```

### Step 2: Application Deployment

#### 2.1 Stop Application Services

```bash
# Stop backend services
./scripts/stop.sh

# Verify services are stopped
ps aux | grep -E "(uvicorn|gunicorn|python)"
```

#### 2.2 Deploy Updated Application Code

```bash
# Pull latest code with UUID implementation
git pull origin main

# Install dependencies
pip install -r requirements.txt

# Verify application configuration
python -c "from backend.app import app; print('Application loads successfully')"
```

### Step 3: Database Migration

#### 3.1 Execute Migration Script

```sql
-- Execute the UUID migration script
\i scripts/migrate_to_uuid.sql

-- Verify migration success
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND column_name = 'id';
```

#### 3.2 Verify Schema Changes

```sql
-- Check all tables have UUID primary keys
SELECT 
    t.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public' 
    AND c.column_name = 'id'
    AND t.table_type = 'BASE TABLE';

-- Verify foreign key relationships
SELECT 
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY';
```

### Step 4: Application Startup

#### 4.1 Start Application Services

```bash
# Start backend services
./scripts/start.sh

# Verify services are running
curl -f http://localhost:8000/health || echo "Health check failed"
```

#### 4.2 Run Application Tests

```bash
# Run unit tests
python -m pytest backend/tests/unit/ -v

# Run integration tests
python -m pytest backend/tests/integration/ -v

# Run performance tests
python -m pytest backend/tests/performance/ -v
```

### Step 5: Data Validation

#### 5.1 Validate Data Integrity

```sql
-- Check all tables have valid UUIDs
SELECT 'users' as table_name, COUNT(*) as count FROM users WHERE id IS NOT NULL;
SELECT 'journals' as table_name, COUNT(*) as count FROM journals WHERE id IS NOT NULL;
SELECT 'tags' as table_name, COUNT(*) as count FROM tags WHERE id IS NOT NULL;
SELECT 'reminders' as table_name, COUNT(*) as count FROM reminders WHERE id IS NOT NULL;
SELECT 'secret_tags' as table_name, COUNT(*) as count FROM secret_tags WHERE id IS NOT NULL;

-- Verify foreign key relationships
SELECT 
    j.id as journal_id,
    j.user_id,
    u.id as user_exists
FROM journals j
LEFT JOIN users u ON j.user_id = u.id
WHERE u.id IS NULL;
```

#### 5.2 API Endpoint Validation

```bash
# Test user endpoints
curl -X GET "http://localhost:8000/api/v1/users/me" \
  -H "Authorization: Bearer <test_token>"

# Test journal endpoints
curl -X GET "http://localhost:8000/api/v1/journals" \
  -H "Authorization: Bearer <test_token>"

# Test reminder endpoints
curl -X GET "http://localhost:8000/api/v1/reminders" \
  -H "Authorization: Bearer <test_token>"
```

## Post-Migration Validation

### 1. Functional Testing

#### 1.1 API Endpoint Testing

```bash
# Test creating a new journal with UUID
curl -X POST "http://localhost:8000/api/v1/journals" \
  -H "Authorization: Bearer <test_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Journal",
    "content": "Testing UUID implementation"
  }'

# Test retrieving journal by UUID
curl -X GET "http://localhost:8000/api/v1/journals/<uuid>" \
  -H "Authorization: Bearer <test_token>"
```

#### 1.2 Database Query Testing

```sql
-- Test primary key queries
SELECT * FROM users WHERE id = '<uuid>';
SELECT * FROM journals WHERE id = '<uuid>';

-- Test foreign key joins
SELECT j.*, u.email 
FROM journals j 
JOIN users u ON j.user_id = u.id 
LIMIT 5;

-- Test complex queries
SELECT 
    u.email,
    COUNT(j.id) as journal_count,
    COUNT(r.id) as reminder_count
FROM users u
LEFT JOIN journals j ON u.id = j.user_id
LEFT JOIN reminders r ON u.id = r.user_id
GROUP BY u.id, u.email;
```

### 2. Performance Validation

#### 2.1 Query Performance Testing

```bash
# Run performance tests
python backend/tests/performance/run_performance_tests.py

# Monitor query execution times
python -c "
import time
from backend.database import get_db
from backend.models import User

start = time.time()
db = next(get_db())
user = db.query(User).first()
end = time.time()
print(f'Query time: {(end - start) * 1000:.2f}ms')
"
```

#### 2.2 Load Testing

```bash
# Install load testing tool
pip install locust

# Run load test
locust -f tests/load/locustfile.py --host=http://localhost:8000 --users=50 --spawn-rate=10
```

### 3. Monitoring Setup

#### 3.1 Database Monitoring

```sql
-- Set up monitoring queries
CREATE OR REPLACE VIEW uuid_performance_monitor AS
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

-- Monitor index usage
SELECT * FROM uuid_performance_monitor;
```

#### 3.2 Application Monitoring

```bash
# Set up application monitoring
python -c "
import psutil
import time
from backend.app import app

# Monitor memory usage
process = psutil.Process()
print(f'Memory usage: {process.memory_info().rss / 1024 / 1024:.2f} MB')

# Monitor response times
start = time.time()
# Simulate API call
end = time.time()
print(f'Response time: {(end - start) * 1000:.2f}ms')
"
```

## Rollback Procedures

### Emergency Rollback

If critical issues are discovered during migration:

#### 1. Immediate Rollback Steps

```bash
# Stop application immediately
./scripts/stop.sh

# Restore database from backup
pg_restore --clean --if-exists -h localhost -U postgres -d vibes_db vibes_backup_<timestamp>.sql

# Deploy previous application version
git checkout <previous_commit>
pip install -r requirements.txt

# Start application with previous version
./scripts/start.sh
```

#### 2. Rollback Validation

```bash
# Verify application functionality
curl -f http://localhost:8000/health

# Run critical tests
python -m pytest backend/tests/integration/test_critical_paths.py -v

# Verify data integrity
python -c "
from backend.database import get_db
from backend.models import User, Journal
db = next(get_db())
print(f'Users: {db.query(User).count()}')
print(f'Journals: {db.query(Journal).count()}')
"
```

### Planned Rollback

If rollback is planned due to issues found in validation:

#### 1. Rollback Database Schema

```sql
-- Execute rollback script
\i scripts/rollback_uuid_migration.sql

-- Verify rollback success
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND column_name = 'id';
```

#### 2. Deploy Previous Application Version

```bash
# Deploy previous application code
git checkout <previous_version_tag>
pip install -r requirements.txt

# Run tests to verify functionality
python -m pytest backend/tests/ -v

# Start application
./scripts/start.sh
```

## Environment-Specific Considerations

### Development Environment

- **Database**: Use local PostgreSQL instance
- **Testing**: Run full test suite before migration
- **Backup**: Regular database snapshots
- **Monitoring**: Basic performance monitoring

### Staging Environment

- **Database**: Mirror production configuration
- **Testing**: Comprehensive integration and load testing
- **Backup**: Full backup before migration
- **Monitoring**: Production-level monitoring setup

### Production Environment

- **Database**: High-availability PostgreSQL cluster
- **Testing**: Minimal disruption testing procedures
- **Backup**: Multiple backup strategies with point-in-time recovery
- **Monitoring**: Real-time monitoring with alerting

#### Production-Specific Steps

```bash
# Production pre-migration checklist
# 1. Schedule maintenance window
# 2. Notify all stakeholders
# 3. Prepare rollback procedures
# 4. Set up monitoring and alerting
# 5. Coordinate with client application deployments

# Production migration execution
# 1. Enable maintenance mode
# 2. Stop application services
# 3. Create database backup
# 4. Execute migration
# 5. Start application services
# 6. Validate functionality
# 7. Disable maintenance mode
# 8. Monitor for issues
```

## Troubleshooting

### Common Issues and Solutions

#### 1. UUID Extension Not Available

**Problem**: PostgreSQL UUID extension not installed

**Solution**:
```sql
-- Install UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Alternative: Use gen_random_uuid() (PostgreSQL 13+)
SELECT gen_random_uuid();
```

#### 2. Foreign Key Constraint Violations

**Problem**: Foreign key relationships broken during migration

**Solution**:
```sql
-- Check for orphaned records
SELECT j.id, j.user_id 
FROM journals j 
LEFT JOIN users u ON j.user_id = u.id 
WHERE u.id IS NULL;

-- Clean up orphaned records
DELETE FROM journals WHERE user_id NOT IN (SELECT id FROM users);
```

#### 3. Application Startup Failures

**Problem**: Application fails to start after migration

**Solution**:
```bash
# Check application logs
tail -f logs/application.log

# Verify database connection
python -c "
from backend.database import engine
try:
    engine.connect()
    print('Database connection successful')
except Exception as e:
    print(f'Database connection failed: {e}')
"

# Check model definitions
python -c "
from backend.models import User, Journal
print('Models loaded successfully')
"
```

#### 4. Performance Issues

**Problem**: Slow query performance after migration

**Solution**:
```sql
-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM users WHERE id = '<uuid>';

-- Rebuild indexes if necessary
REINDEX TABLE users;
REINDEX TABLE journals;

-- Update table statistics
ANALYZE users;
ANALYZE journals;
```

#### 5. Client Application Errors

**Problem**: Client applications fail with UUID parameters

**Solution**:
```javascript
// Verify UUID format in client code
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(uuid) {
    return uuidRegex.test(uuid);
}

// Update API calls to use UUIDs
const response = await fetch(`/api/v1/journals/${journalId}`, {
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }
});
```

### Emergency Contacts

- **Database Administrator**: [Contact Information]
- **DevOps Team**: [Contact Information]
- **Development Team Lead**: [Contact Information]
- **System Administrator**: [Contact Information]

### Recovery Procedures

#### Data Recovery

```bash
# Point-in-time recovery
pg_restore --clean --if-exists -h localhost -U postgres -d vibes_db \
  --timestamp="2025-01-27 10:00:00" vibes_backup.sql

# Selective table recovery
pg_restore --clean --if-exists -h localhost -U postgres -d vibes_db \
  --table=users --table=journals vibes_backup.sql
```

#### Application Recovery

```bash
# Quick application restart
./scripts/stop.sh
./scripts/start.sh

# Full application reset
git stash
git checkout main
git pull origin main
pip install -r requirements.txt
./scripts/start.sh
```

---

*Last Updated: January 27, 2025*
*Version: 1.0*
*Related PBI: [PBI-9: Database Schema Standardization and UUID Implementation](../../delivery/9/prd.md)* 