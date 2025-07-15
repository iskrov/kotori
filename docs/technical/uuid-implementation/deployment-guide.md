# Deployment Guide for UUID Schema Implementation

This document provides comprehensive procedures for deploying the UUID schema implementation to the Vibes application database.

## Table of Contents

1. [Pre-Deployment Preparation](#pre-deployment-preparation)
2. [Environment Setup](#environment-setup)
3. [Database Migration Procedures](#database-migration-procedures)
4. [Application Deployment](#application-deployment)
5. [Post-Deployment Validation](#post-deployment-validation)
6. [Monitoring and Alerting](#monitoring-and-alerting)
7. [Troubleshooting](#troubleshooting)

## Pre-Deployment Preparation

### 1. Prerequisites Checklist

Before beginning the deployment process, ensure the following prerequisites are met:

- [ ] **Database Backup**: Complete database backup created and verified
- [ ] **Application Code**: All UUID implementation code tested and approved
- [ ] **Environment Validation**: Target environment validated and accessible
- [ ] **Dependencies**: All required dependencies installed and configured
- [ ] **Access Permissions**: Deployment team has necessary database and application access
- [ ] **Maintenance Window**: Scheduled maintenance window confirmed
- [ ] **Communication**: Stakeholders notified of deployment schedule

### 2. Pre-Deployment Validation

#### Database Health Check
```bash
# Check database connectivity
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT version();"

# Verify current schema state
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "\dt"

# Check database size and available space
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT 
    pg_size_pretty(pg_database_size(current_database())) as database_size,
    pg_size_pretty(pg_total_relation_size('users')) as users_table_size,
    pg_size_pretty(pg_total_relation_size('journals')) as journals_table_size;
"
```

#### Application Health Check
```bash
# Verify application is running
curl -f http://localhost:8000/health

# Check current API endpoints
curl -f http://localhost:8000/api/v1/status

# Validate test suite passes
python -m pytest tests/ -v
```

### 3. Backup Procedures

#### Database Backup
```bash
# Create timestamped backup
BACKUP_FILE="vibes_backup_$(date +%Y%m%d_%H%M%S).sql"
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > $BACKUP_FILE

# Verify backup integrity
pg_restore --list $BACKUP_FILE | head -20

# Store backup in secure location
aws s3 cp $BACKUP_FILE s3://vibes-backups/pre-uuid-migration/
```

#### Application State Backup
```bash
# Backup current application configuration
cp -r /app/config /backup/config_$(date +%Y%m%d_%H%M%S)

# Backup current codebase
git tag pre-uuid-migration-$(date +%Y%m%d_%H%M%S)
git push origin --tags
```

## Environment Setup

### 1. Development Environment

```bash
# Navigate to project directory
cd /home/ai/src/vibes

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export DATABASE_URL="postgresql://user:password@localhost:5432/vibes_dev"
export ENVIRONMENT="development"
```

### 2. Test Environment

```bash
# Deploy to test environment first
export DATABASE_URL="postgresql://user:password@test-db:5432/vibes_test"
export ENVIRONMENT="test"

# Run migration in test environment
python -m alembic upgrade head
```

### 3. Production Environment

```bash
# Production deployment preparation
export DATABASE_URL="postgresql://user:password@prod-db:5432/vibes_prod"
export ENVIRONMENT="production"

# Enable maintenance mode
curl -X POST http://localhost:8000/admin/maintenance/enable
```

## Database Migration Procedures

### 1. Migration Execution

#### Step 1: Verify Migration Files
```bash
# Check migration files exist
ls -la migrations/versions/

# Verify migration SQL
cat migrations/versions/001_uuid_schema_migration.sql
```

#### Step 2: Execute Migration
```bash
# Run database migration
python -m alembic upgrade head

# Verify migration success
python -m alembic current
python -m alembic history
```

#### Step 3: Validate Schema Changes
```bash
# Check new schema structure
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "\d users"
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "\d journals"
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "\d tags"

# Verify indexes are created
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "\di"

# Check constraints
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT conname, contype, conkey 
FROM pg_constraint 
WHERE conrelid = 'users'::regclass;
"
```

### 2. Data Migration Validation

#### Verify Data Integrity
```bash
# Check record counts
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT 
    'users' as table_name, COUNT(*) as record_count 
FROM users
UNION ALL
SELECT 
    'journals' as table_name, COUNT(*) as record_count 
FROM journals
UNION ALL
SELECT 
    'tags' as table_name, COUNT(*) as record_count 
FROM tags;
"

# Verify UUID format
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT id, created_at 
FROM users 
WHERE id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
LIMIT 5;
"
```

#### Check Foreign Key Relationships
```bash
# Verify foreign key relationships
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT 
    j.id as journal_id,
    j.user_id,
    u.id as user_id_check,
    u.email
FROM journals j
JOIN users u ON j.user_id = u.id
LIMIT 5;
"
```

## Application Deployment

### 1. Code Deployment

#### Step 1: Deploy Application Code
```bash
# Pull latest code
git pull origin main

# Install dependencies
pip install -r requirements.txt

# Update application configuration
cp config/production.env .env
```

#### Step 2: Restart Application Services
```bash
# Restart FastAPI application
./scripts/stop.sh
./scripts/start.sh

# Verify application startup
sleep 10
curl -f http://localhost:8000/health
```

### 2. Configuration Updates

#### Update Environment Variables
```bash
# Update database connection settings
export DATABASE_URL="postgresql://user:password@localhost:5432/vibes_prod"

# Update application settings
export UUID_VERSION="4"
export ENABLE_UUID_VALIDATION="true"
```

#### Update Application Configuration
```python
# Update config/settings.py
DATABASE_CONFIG = {
    "use_uuid_primary_keys": True,
    "uuid_version": 4,
    "enable_uuid_validation": True
}
```

## Post-Deployment Validation

### 1. Functional Testing

#### API Endpoint Validation
```bash
# Test user creation with UUID
curl -X POST http://localhost:8000/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "testpass123"}'

# Test journal creation with UUID
curl -X POST http://localhost:8000/api/v1/journals \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title": "Test Journal", "content": "Test content"}'

# Test UUID parameter handling
USER_ID=$(curl -s http://localhost:8000/api/v1/users/me | jq -r '.id')
curl -f http://localhost:8000/api/v1/users/$USER_ID
```

#### Database Query Validation
```bash
# Test UUID queries
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT id, email, created_at 
FROM users 
WHERE id = '550e8400-e29b-41d4-a716-446655440000';
"

# Test join queries with UUIDs
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT u.email, j.title, j.created_at
FROM users u
JOIN journals j ON u.id = j.user_id
LIMIT 5;
"
```

### 2. Performance Validation

#### Query Performance Testing
```bash
# Test index performance
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
EXPLAIN ANALYZE 
SELECT * FROM users WHERE id = '550e8400-e29b-41d4-a716-446655440000';
"

# Test join performance
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
EXPLAIN ANALYZE 
SELECT u.email, COUNT(j.id) as journal_count
FROM users u
LEFT JOIN journals j ON u.id = j.user_id
GROUP BY u.id, u.email;
"
```

#### Application Performance Testing
```bash
# Run performance tests
python -m pytest tests/performance/ -v

# Check response times
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:8000/api/v1/users/me
```

### 3. Integration Testing

#### End-to-End Testing
```bash
# Run full test suite
python -m pytest tests/ -v --tb=short

# Run integration tests
python -m pytest tests/integration/ -v

# Run API tests
python -m pytest tests/api/ -v
```

## Monitoring and Alerting

### 1. Database Monitoring

#### Key Metrics to Monitor
```sql
-- Monitor query performance
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements
WHERE query LIKE '%uuid%'
ORDER BY total_time DESC
LIMIT 10;

-- Monitor index usage
SELECT 
    indexrelname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

#### Set Up Alerts
```bash
# Database connection alerts
# CPU usage alerts
# Memory usage alerts
# Query performance alerts
# Error rate alerts
```

### 2. Application Monitoring

#### Health Check Endpoints
```python
# Monitor UUID validation errors
GET /api/v1/health/uuid-validation

# Monitor database connection
GET /api/v1/health/database

# Monitor application metrics
GET /api/v1/metrics
```

#### Log Monitoring
```bash
# Monitor application logs
tail -f /var/log/vibes/application.log | grep -i uuid

# Monitor error logs
tail -f /var/log/vibes/error.log | grep -i error

# Monitor performance logs
tail -f /var/log/vibes/performance.log
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Migration Failures
```bash
# If migration fails, check error logs
tail -f /var/log/postgresql/postgresql.log

# Check migration status
python -m alembic current

# Rollback if necessary
python -m alembic downgrade -1
```

#### 2. UUID Validation Errors
```bash
# Check UUID format in database
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT id, length(id::text), id::text ~ '^[0-9a-f-]{36}$' as valid_format
FROM users
WHERE NOT (id::text ~ '^[0-9a-f-]{36}$')
LIMIT 10;
"
```

#### 3. Performance Issues
```bash
# Check slow queries
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
WHERE mean_time > 1000
ORDER BY mean_time DESC;
"

# Check index usage
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
WHERE idx_scan = 0;
"
```

### Emergency Procedures

#### 1. Immediate Rollback
```bash
# If critical issues are detected
python -m alembic downgrade -1

# Restart application with previous version
git checkout pre-uuid-migration
./scripts/stop.sh
./scripts/start.sh
```

#### 2. Database Recovery
```bash
# Restore from backup if necessary
pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME $BACKUP_FILE
```

## Deployment Checklist

### Pre-Deployment
- [ ] Database backup completed and verified
- [ ] Application code tested and approved
- [ ] Environment validated and accessible
- [ ] Dependencies installed and configured
- [ ] Access permissions verified
- [ ] Maintenance window scheduled
- [ ] Stakeholders notified

### During Deployment
- [ ] Database migration executed successfully
- [ ] Schema changes verified
- [ ] Data integrity validated
- [ ] Application code deployed
- [ ] Services restarted
- [ ] Configuration updated

### Post-Deployment
- [ ] Functional testing completed
- [ ] Performance validation passed
- [ ] Integration tests successful
- [ ] Monitoring and alerting configured
- [ ] Documentation updated
- [ ] Stakeholders notified of completion
- [ ] Maintenance mode disabled

## Contact Information

- **Database Administrator**: [Contact details]
- **Application Team Lead**: [Contact details]
- **DevOps Engineer**: [Contact details]
- **On-Call Support**: [Contact details]

---

*This document should be reviewed and updated regularly to reflect changes in deployment procedures and lessons learned from previous deployments.* 