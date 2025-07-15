# Rollback Procedures for UUID Schema Migration

## Overview

This document provides detailed procedures for rolling back the UUID schema migration if issues are encountered during or after the migration process. The rollback procedures are designed to restore the database to its original state using backup data and preserve data integrity.

## When to Rollback

### Immediate Rollback Scenarios

1. **Data Corruption Detected**
   - Invalid UUID conversion
   - Data loss during migration
   - Referential integrity violations

2. **Migration Failure**
   - Script execution errors
   - Timeout or resource issues
   - Incomplete migration steps

3. **Application Issues**
   - Critical application functionality broken
   - Performance degradation
   - User authentication failures

### Rollback Decision Matrix

| Issue Type | Severity | Rollback Recommended | Alternative Actions |
|------------|----------|---------------------|-------------------|
| Data Corruption | Critical | Yes | None - Immediate rollback |
| Migration Timeout | High | Yes | Consider batch size reduction |
| Application Error | High | Yes | Verify if fixable post-migration |
| Performance Issue | Medium | Depends | Monitor and optimize first |
| Minor Data Issues | Low | No | Fix issues in place |

## Rollback Architecture

### Backup Components

1. **Migration Backup Schema** (`migration_backup`)
   - Contains original data before migration
   - Preserves original data types and constraints
   - Enables complete restoration

2. **Migration Log Table** (`migration_log`)
   - Tracks all migration operations
   - Provides audit trail for rollback
   - Enables partial rollback if needed

3. **Rollback Scripts** (`backend/scripts/data_migration.py`)
   - Automated rollback procedures
   - Data validation and integrity checks
   - Progress monitoring and logging

## Pre-Rollback Checklist

### Assessment Phase

- [ ] Identify specific issue requiring rollback
- [ ] Document current database state
- [ ] Verify backup integrity
- [ ] Assess impact on running applications
- [ ] Notify stakeholders of rollback decision

### Preparation Phase

- [ ] Stop all application services
- [ ] Create current state backup (if data is recoverable)
- [ ] Verify rollback script availability
- [ ] Check database connectivity
- [ ] Prepare monitoring and logging

## Rollback Procedures

### Step 1: Emergency Application Shutdown

```bash
# Stop application services
sudo systemctl stop vibes-backend
sudo systemctl stop vibes-frontend

# Verify services are stopped
sudo systemctl status vibes-backend
sudo systemctl status vibes-frontend
```

### Step 2: Assess Current State

```bash
cd backend
python scripts/data_migration.py --operation=status
```

**Information Gathered:**
- Current migration state
- Completed operations
- Failed operations
- Data integrity status

### Step 3: Verify Backup Integrity

```bash
python -c "
from sqlalchemy import create_engine, text
from app.core.config import settings

engine = create_engine(settings.DATABASE_URL)
with engine.connect() as conn:
    # Check backup schema exists
    result = conn.execute(text(\"\"\"
        SELECT schema_name FROM information_schema.schemata 
        WHERE schema_name = 'migration_backup'
    \"\"\"))
    
    if result.fetchone():
        print('✓ Backup schema exists')
        
        # Check backup tables
        tables = ['users', 'journal_entries', 'tags', 'reminders']
        for table in tables:
            result = conn.execute(text(f\"\"\"
                SELECT COUNT(*) FROM migration_backup.{table}_backup
            \"\"\"))
            count = result.fetchone()[0]
            print(f'✓ {table}_backup: {count} records')
    else:
        print('✗ Backup schema not found')
"
```

### Step 4: Execute Rollback

```bash
python scripts/data_migration.py --operation=rollback
```

**Rollback Process:**
1. Validates backup schema exists
2. Drops current migrated tables
3. Recreates tables from backup data
4. Restores original constraints and indexes
5. Validates data integrity
6. Logs rollback completion

### Step 5: Validate Rollback Success

```bash
python scripts/data_migration.py --operation=validate_rollback
```

**Validation Checks:**
- All tables restored from backup
- Data counts match original
- Original data types restored
- Constraints and indexes recreated
- No orphaned records

### Step 6: Application Restart

```bash
# Restart application services
sudo systemctl start vibes-backend
sudo systemctl start vibes-frontend

# Verify services are running
sudo systemctl status vibes-backend
sudo systemctl status vibes-frontend
```

## Rollback Scenarios

### Scenario 1: Full Migration Rollback

**Situation:** Complete migration failed or caused critical issues

```bash
# Execute full rollback
python scripts/data_migration.py --operation=rollback

# Validate rollback
python scripts/data_migration.py --operation=validate_rollback
```

**Expected Outcome:**
- Database restored to pre-migration state
- All original data types and constraints restored
- Application functionality restored

### Scenario 2: Partial Migration Rollback

**Situation:** Migration partially completed but encountered issues

```bash
# Check current state
python scripts/data_migration.py --operation=status

# Execute rollback
python scripts/data_migration.py --operation=rollback

# Validate specific components
python -c "
from sqlalchemy import create_engine, text
from app.core.config import settings

engine = create_engine(settings.DATABASE_URL)
with engine.connect() as conn:
    # Check specific table states
    result = conn.execute(text(\"\"\"
        SELECT table_name, column_name, data_type 
        FROM information_schema.columns 
        WHERE column_name IN ('id', 'user_id')
        AND table_name IN ('users', 'journal_entries', 'tags', 'reminders')
        ORDER BY table_name, column_name
    \"\"\"))
    
    for row in result.fetchall():
        print(f'{row[0]}.{row[1]}: {row[2]}')
"
```

### Scenario 3: Emergency Rollback

**Situation:** Critical data corruption or system failure

```bash
# Immediate rollback without validation
python scripts/data_migration.py --operation=rollback --force

# Post-rollback validation
python scripts/data_migration.py --operation=validate_rollback
```

## Post-Rollback Procedures

### Step 1: Data Integrity Verification

```sql
-- Verify table structures
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('users', 'journal_entries', 'tags', 'reminders')
AND column_name IN ('id', 'user_id')
ORDER BY table_name, column_name;

-- Check data counts
SELECT 
    'users' as table_name, COUNT(*) as record_count FROM users
UNION ALL
SELECT 
    'journal_entries' as table_name, COUNT(*) as record_count FROM journal_entries
UNION ALL
SELECT 
    'tags' as table_name, COUNT(*) as record_count FROM tags
UNION ALL
SELECT 
    'reminders' as table_name, COUNT(*) as record_count FROM reminders;

-- Verify referential integrity
SELECT COUNT(*) as orphaned_entries 
FROM journal_entries 
WHERE user_id NOT IN (SELECT id FROM users);

SELECT COUNT(*) as orphaned_tags 
FROM tags 
WHERE user_id NOT IN (SELECT id FROM users);

SELECT COUNT(*) as orphaned_reminders 
FROM reminders 
WHERE user_id NOT IN (SELECT id FROM users);
```

### Step 2: Application Functionality Testing

```bash
# Test basic application endpoints
curl -X GET http://localhost:8000/health
curl -X GET http://localhost:8000/api/v1/users/me

# Test critical functionality
python -m pytest tests/integration/test_user_operations.py -v
python -m pytest tests/integration/test_journal_operations.py -v
```

### Step 3: Performance Validation

```sql
-- Check query performance
EXPLAIN ANALYZE SELECT * FROM users WHERE id = 'sample-uuid';
EXPLAIN ANALYZE SELECT * FROM journal_entries WHERE user_id = 'sample-uuid';

-- Verify indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename IN ('users', 'journal_entries', 'tags', 'reminders');
```

## Rollback Troubleshooting

### Common Issues

#### 1. Backup Schema Not Found

**Symptom:** Rollback fails with "backup schema not found"

**Diagnosis:**
```bash
python -c "
from sqlalchemy import create_engine, text
from app.core.config import settings

engine = create_engine(settings.DATABASE_URL)
with engine.connect() as conn:
    result = conn.execute(text(\"\"\"
        SELECT schema_name FROM information_schema.schemata 
        WHERE schema_name = 'migration_backup'
    \"\"\"))
    
    if result.fetchone():
        print('Backup schema exists')
    else:
        print('Backup schema missing')
"
```

**Solution:**
1. Check if backup was created during migration
2. Restore from external database backup
3. Manually recreate original schema structure

#### 2. Incomplete Rollback

**Symptom:** Some tables restored, others still in migrated state

**Diagnosis:**
```sql
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE column_name IN ('id', 'user_id')
AND table_name IN ('users', 'journal_entries', 'tags', 'reminders');
```

**Solution:**
1. Identify partially rolled back tables
2. Manually restore remaining tables
3. Re-run rollback procedure

#### 3. Constraint Recreation Failures

**Symptom:** Tables restored but constraints missing

**Diagnosis:**
```sql
SELECT 
    tc.table_name, 
    tc.constraint_name, 
    tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_name IN ('users', 'journal_entries', 'tags', 'reminders');
```

**Solution:**
```sql
-- Manually recreate constraints
ALTER TABLE users ADD PRIMARY KEY (id);
ALTER TABLE journal_entries ADD PRIMARY KEY (id);
ALTER TABLE tags ADD PRIMARY KEY (id);
ALTER TABLE reminders ADD PRIMARY KEY (id);

-- Recreate foreign keys
ALTER TABLE journal_entries 
ADD CONSTRAINT fk_journal_entries_user_id 
FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE tags 
ADD CONSTRAINT fk_tags_user_id 
FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE reminders 
ADD CONSTRAINT fk_reminders_user_id 
FOREIGN KEY (user_id) REFERENCES users(id);
```

### Recovery from Failed Rollback

#### Option 1: External Backup Restore

If rollback fails and backup is corrupted:

```bash
# Restore from external backup
pg_restore -h localhost -U postgres -d vibes_db backup_file.dump

# Verify restoration
python scripts/data_migration.py --operation=validate_schema
```

#### Option 2: Manual Schema Recreation

If all else fails, manually recreate the original schema:

```sql
-- Drop existing tables
DROP TABLE IF EXISTS journal_entries CASCADE;
DROP TABLE IF EXISTS tags CASCADE;
DROP TABLE IF EXISTS reminders CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Recreate with original structure
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recreate other tables with original foreign key types
-- ... (continue with original schema)
```

## Monitoring and Alerting

### Rollback Monitoring

```bash
# Monitor rollback progress
tail -f data_migration.log | grep -i rollback

# Check rollback status
python scripts/data_migration.py --operation=status
```

### Post-Rollback Alerts

Set up monitoring for:
- Application error rates
- Database performance metrics
- User authentication success rates
- Data integrity checks

## Documentation and Communication

### Rollback Documentation

Document the following for each rollback:

1. **Rollback Trigger**
   - Issue that caused rollback
   - Decision timeline
   - Stakeholders involved

2. **Rollback Execution**
   - Steps performed
   - Duration of rollback
   - Issues encountered

3. **Validation Results**
   - Data integrity checks
   - Application functionality tests
   - Performance validation

4. **Lessons Learned**
   - Root cause analysis
   - Prevention measures
   - Process improvements

### Communication Plan

**During Rollback:**
- Notify development team
- Update stakeholders on progress
- Document all actions taken

**Post-Rollback:**
- Send completion notification
- Share validation results
- Schedule post-mortem meeting

## Prevention and Best Practices

### Migration Testing

1. **Staging Environment**
   - Test migration in staging first
   - Validate rollback procedures
   - Measure performance impact

2. **Backup Validation**
   - Verify backup integrity before migration
   - Test restore procedures
   - Ensure backup completeness

3. **Monitoring Setup**
   - Configure alerts for migration issues
   - Monitor database performance
   - Track application metrics

### Rollback Preparedness

1. **Regular Backup Testing**
   - Monthly rollback procedure tests
   - Validate backup integrity
   - Update procedures based on tests

2. **Team Training**
   - Train team on rollback procedures
   - Practice emergency scenarios
   - Document team responsibilities

3. **Automation**
   - Automate rollback procedures
   - Implement safety checks
   - Enable quick execution

## Contact Information

### Emergency Contacts

- **Database Team:** dba-team@company.com
- **Development Team:** dev-team@company.com
- **DevOps Team:** devops@company.com
- **On-Call Engineer:** +1-555-0123

### Escalation Matrix

1. **Level 1:** Database Administrator
2. **Level 2:** Senior Developer
3. **Level 3:** Engineering Manager
4. **Level 4:** CTO/VP Engineering 