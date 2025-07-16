# Rollback Procedures for UUID Schema Implementation

This document provides comprehensive procedures for rolling back the UUID schema implementation in case of deployment issues or critical problems.

## Table of Contents

1. [Rollback Triggers and Decision Criteria](#rollback-triggers-and-decision-criteria)
2. [Rollback Preparation](#rollback-preparation)
3. [Database Rollback Procedures](#database-rollback-procedures)
4. [Application Rollback Procedures](#application-rollback-procedures)
5. [Data Recovery and Restoration](#data-recovery-and-restoration)
6. [Rollback Validation](#rollback-validation)
7. [Post-Rollback Procedures](#post-rollback-procedures)
8. [Emergency Rollback Procedures](#emergency-rollback-procedures)

## Rollback Triggers and Decision Criteria

### 1. Automatic Rollback Triggers

The following conditions should trigger an immediate rollback:

#### Critical System Failures
- **Database Corruption**: Any indication of data corruption or loss
- **Application Crashes**: Repeated application crashes or startup failures
- **Performance Degradation**: >50% increase in response times or query execution times
- **Data Integrity Issues**: Foreign key constraint violations or orphaned records
- **Security Vulnerabilities**: Discovered security issues related to UUID implementation

#### Functional Failures
- **API Endpoint Failures**: >25% of API endpoints returning errors
- **User Authentication Issues**: Users unable to authenticate or access their data
- **Data Access Problems**: Users unable to retrieve or modify their existing data
- **Critical Feature Breakdown**: Core functionality (journal creation, user management) not working

### 2. Manual Rollback Decision Criteria

Consider manual rollback in the following scenarios:

#### Business Impact
- **User Complaints**: Significant increase in user support tickets
- **Data Loss Reports**: Any reports of users losing access to their data
- **Performance Issues**: Noticeable degradation in user experience
- **Integration Failures**: Third-party integrations failing due to UUID changes

#### Technical Indicators
- **Error Rate Increase**: Error rates >10% above baseline
- **Database Lock Issues**: Increased database locking or deadlock situations
- **Memory/CPU Spikes**: Unusual resource consumption patterns
- **Migration Incomplete**: Partial migration leaving system in inconsistent state

### 3. Rollback Decision Matrix

| Severity | Impact | Response Time | Action |
|----------|--------|---------------|---------|
| Critical | High | Immediate | Automatic rollback |
| High | Medium | 15 minutes | Manual rollback decision |
| Medium | Low | 1 hour | Monitor and assess |
| Low | Minimal | 24 hours | Document and plan fix |

## Rollback Preparation

### 1. Pre-Rollback Assessment

#### System State Evaluation
```bash
# Check current system status
curl -f http://localhost:8000/health

# Verify database connectivity
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT version();"

# Check migration status
python -m alembic current
python -m alembic history
```

#### Impact Assessment
```bash
# Check affected users
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT COUNT(*) as total_users FROM users;
"

# Check data integrity
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT 
    COUNT(*) as total_journals,
    COUNT(DISTINCT user_id) as users_with_journals
FROM journals;
"

# Monitor active sessions
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT COUNT(*) as active_connections 
FROM pg_stat_activity 
WHERE state = 'active';
"
```

### 2. Rollback Preparation Steps

#### Enable Maintenance Mode
```bash
# Enable maintenance mode
curl -X POST http://localhost:8000/admin/maintenance/enable

# Verify maintenance mode is active
curl http://localhost:8000/health
```

#### Notify Stakeholders
```bash
# Send rollback notification
echo "UUID migration rollback initiated at $(date)" | \
  mail -s "URGENT: Vibes Database Rollback in Progress" \
  stakeholders@company.com
```

#### Prepare Rollback Environment
```bash
# Create rollback workspace
mkdir -p /tmp/rollback_$(date +%Y%m%d_%H%M%S)
cd /tmp/rollback_$(date +%Y%m%d_%H%M%S)

# Backup current state before rollback
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > pre_rollback_backup.sql
```

## Database Rollback Procedures

### 1. Alembic Migration Rollback

#### Step 1: Verify Current Migration State
```bash
# Check current migration
python -m alembic current

# View migration history
python -m alembic history -v
```

#### Step 2: Execute Migration Rollback
```bash
# Rollback UUID migration
python -m alembic downgrade -1

# Verify rollback success
python -m alembic current
```

#### Step 3: Validate Schema Rollback
```bash
# Check table structure reverted
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "\d users"
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "\d journals"

# Verify primary keys are back to integers
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name IN ('users', 'journals', 'tags')
AND column_name = 'id';
"
```

### 2. Manual Database Rollback

If Alembic rollback fails, perform manual rollback:

#### Step 1: Drop UUID Tables
```sql
-- Connect to database
psql -h $DB_HOST -U $DB_USER -d $DB_NAME

-- Drop UUID tables (if safe to do so)
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS reminders CASCADE;
DROP TABLE IF EXISTS secret_tags CASCADE;
DROP TABLE IF EXISTS tags CASCADE;
DROP TABLE IF EXISTS journals CASCADE;
DROP TABLE IF EXISTS users CASCADE;
```

#### Step 2: Restore from Backup
```bash
# Restore from pre-migration backup
pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME -c pre_migration_backup.sql

# Verify restoration
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name IN ('users', 'journals', 'tags')
AND column_name = 'id';
"
```

### 3. Data Integrity Verification

#### Verify Data Consistency
```bash
# Check record counts match pre-migration
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

# Verify foreign key relationships
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT 
    j.id as journal_id,
    j.user_id,
    u.id as user_id_check
FROM journals j
JOIN users u ON j.user_id = u.id
LIMIT 10;
"
```

#### Check Data Types
```bash
# Verify integer IDs are restored
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT 
    id,
    pg_typeof(id) as id_type,
    email
FROM users
LIMIT 5;
"
```

## Application Rollback Procedures

### 1. Code Rollback

#### Step 1: Revert to Previous Version
```bash
# Navigate to application directory
cd /home/ai/src/vibes

# Checkout previous version
git checkout pre-uuid-migration

# Verify correct version
git log --oneline -5
```

#### Step 2: Restore Configuration
```bash
# Restore previous configuration
git checkout HEAD~1 -- config/
git checkout HEAD~1 -- .env.example

# Update environment variables
export UUID_ENABLED="false"
export USE_INTEGER_IDS="true"
```

#### Step 3: Reinstall Dependencies
```bash
# Install previous dependencies
pip install -r requirements.txt

# Verify dependencies
pip list | grep -E "(sqlalchemy|alembic|pydantic)"
```

### 2. Service Restart

#### Stop Current Services
```bash
# Stop current application
./scripts/stop.sh

# Verify services stopped
ps aux | grep -E "(uvicorn|gunicorn)"
```

#### Start Previous Version
```bash
# Start application with previous code
./scripts/start.sh

# Verify application startup
sleep 10
curl -f http://localhost:8000/health
```

### 3. Configuration Rollback

#### Restore Previous Settings
```python
# Restore previous settings.py
DATABASE_CONFIG = {
    "use_uuid_primary_keys": False,
    "uuid_version": None,
    "enable_uuid_validation": False
}

API_CONFIG = {
    "id_parameter_type": "int",
    "enable_uuid_endpoints": False
}
```

## Data Recovery and Restoration

### 1. Backup Restoration

#### Full Database Restore
```bash
# Stop application
./scripts/stop.sh

# Drop current database
psql -h $DB_HOST -U $DB_USER -c "DROP DATABASE vibes_prod;"

# Recreate database
psql -h $DB_HOST -U $DB_USER -c "CREATE DATABASE vibes_prod;"

# Restore from backup
pg_restore -h $DB_HOST -U $DB_USER -d vibes_prod pre_migration_backup.sql
```

#### Selective Data Restore
```bash
# Restore specific tables if needed
pg_restore -h $DB_HOST -U $DB_USER -d vibes_prod -t users pre_migration_backup.sql
pg_restore -h $DB_HOST -U $DB_USER -d vibes_prod -t journals pre_migration_backup.sql
```

### 2. Data Validation After Restore

#### Verify Data Integrity
```bash
# Check user data
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT 
    COUNT(*) as total_users,
    COUNT(DISTINCT email) as unique_emails,
    MIN(created_at) as oldest_user,
    MAX(created_at) as newest_user
FROM users;
"

# Check journal data
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT 
    COUNT(*) as total_journals,
    COUNT(DISTINCT user_id) as users_with_journals,
    MIN(created_at) as oldest_journal,
    MAX(created_at) as newest_journal
FROM journals;
"
```

#### Verify Relationships
```bash
# Check foreign key consistency
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT 
    COUNT(*) as orphaned_journals
FROM journals j
LEFT JOIN users u ON j.user_id = u.id
WHERE u.id IS NULL;
"
```

## Rollback Validation

### 1. Functional Testing

#### API Endpoint Testing
```bash
# Test user authentication
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password"}'

# Test journal creation
curl -X POST http://localhost:8000/api/v1/journals \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title": "Test Journal", "content": "Test content"}'

# Test user profile access
curl -f http://localhost:8000/api/v1/users/1
```

#### Database Query Testing
```bash
# Test integer ID queries
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT id, email, created_at 
FROM users 
WHERE id = 1;
"

# Test join queries
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT u.email, j.title, j.created_at
FROM users u
JOIN journals j ON u.id = j.user_id
WHERE u.id = 1;
"
```

### 2. Performance Validation

#### Query Performance
```bash
# Test query performance
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
EXPLAIN ANALYZE 
SELECT * FROM users WHERE id = 1;
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

#### Application Performance
```bash
# Run performance tests
python -m pytest tests/performance/ -v

# Check response times
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:8000/api/v1/users/1
```

### 3. Integration Testing

#### Full Test Suite
```bash
# Run complete test suite
python -m pytest tests/ -v --tb=short

# Run specific integration tests
python -m pytest tests/integration/ -v

# Run API tests
python -m pytest tests/api/ -v
```

## Post-Rollback Procedures

### 1. System Monitoring

#### Monitor Key Metrics
```bash
# Monitor application health
watch -n 30 'curl -s http://localhost:8000/health | jq'

# Monitor database performance
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT 
    query,
    calls,
    total_time,
    mean_time
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;
"
```

#### Check Error Rates
```bash
# Monitor application logs
tail -f /var/log/vibes/application.log | grep -i error

# Monitor database logs
tail -f /var/log/postgresql/postgresql.log | grep -i error
```

### 2. User Communication

#### Notify Users
```bash
# Send rollback completion notification
echo "UUID migration has been rolled back. System is stable." | \
  mail -s "Vibes System Update: Rollback Complete" \
  users@company.com
```

#### Update Status Page
```bash
# Update system status
curl -X POST http://status.company.com/api/incidents \
  -H "Content-Type: application/json" \
  -d '{"status": "resolved", "message": "Database rollback completed successfully"}'
```

### 3. Documentation and Analysis

#### Document Rollback
```bash
# Create rollback report
cat > rollback_report_$(date +%Y%m%d_%H%M%S).md << EOF
# UUID Migration Rollback Report

## Rollback Details
- Date: $(date)
- Reason: [Reason for rollback]
- Duration: [Duration of rollback process]
- Impact: [Impact on users/system]

## Actions Taken
- Database rollback completed
- Application code reverted
- Services restarted
- Data integrity verified

## Lessons Learned
- [Key lessons from the rollback]
- [Improvements for future deployments]
EOF
```

#### Root Cause Analysis
```bash
# Analyze what went wrong
# Review logs, metrics, and error reports
# Document findings for future reference
```

## Emergency Rollback Procedures

### 1. Immediate Actions

#### Critical System Failure
```bash
# Immediate database rollback
python -m alembic downgrade -1

# Emergency application restart
./scripts/stop.sh
git checkout pre-uuid-migration
./scripts/start.sh
```

#### Data Corruption
```bash
# Stop all services immediately
./scripts/stop.sh

# Restore from backup
pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME -c emergency_backup.sql

# Restart with previous version
git checkout pre-uuid-migration
./scripts/start.sh
```

### 2. Emergency Contacts

#### Escalation Procedures
- **Database Administrator**: [Emergency contact]
- **Application Team Lead**: [Emergency contact]
- **DevOps Engineer**: [Emergency contact]
- **Management**: [Emergency contact]

#### Communication Channels
- **Slack Channel**: #vibes-emergency
- **Email List**: emergency@company.com
- **Phone Tree**: [Emergency phone numbers]

## Rollback Checklist

### Pre-Rollback
- [ ] Rollback trigger identified and documented
- [ ] Impact assessment completed
- [ ] Maintenance mode enabled
- [ ] Stakeholders notified
- [ ] Backup of current state created
- [ ] Rollback team assembled

### During Rollback
- [ ] Database migration rolled back
- [ ] Application code reverted
- [ ] Services restarted
- [ ] Configuration restored
- [ ] Data integrity verified
- [ ] Performance validated

### Post-Rollback
- [ ] Functional testing completed
- [ ] Performance validation passed
- [ ] Integration tests successful
- [ ] Monitoring restored
- [ ] Users notified
- [ ] Documentation updated
- [ ] Root cause analysis initiated
- [ ] Maintenance mode disabled

## Recovery Time Objectives

| Component | RTO Target | Actual Time |
|-----------|------------|-------------|
| Database Rollback | 30 minutes | ___ |
| Application Rollback | 15 minutes | ___ |
| Service Restart | 5 minutes | ___ |
| Validation Testing | 20 minutes | ___ |
| **Total Rollback** | **70 minutes** | ___ |

---

*This document should be tested regularly through rollback drills to ensure procedures are current and effective.* 