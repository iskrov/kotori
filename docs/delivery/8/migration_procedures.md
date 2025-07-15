# Migration Procedures for UUID Schema Conversion

## Overview

This document outlines the procedures for migrating existing data from the legacy string-based UUID schema to the new native UUID schema. The migration process is designed to be safe, reversible, and handle large datasets efficiently.

## Migration Architecture

### Components

1. **Data Migration Manager** (`backend/scripts/data_migration.py`)
   - Main migration orchestrator
   - Handles batch processing and error recovery
   - Provides rollback capabilities

2. **Migration Log Table** (`migration_log`)
   - Tracks all migration operations
   - Stores operation metadata and status
   - Enables audit trail and debugging

3. **Backup Schema** (`migration_backup`)
   - Stores original data before migration
   - Enables rollback operations
   - Validates migration success

### Migration Flow

```
1. Schema Validation
2. Data Backup Creation
3. User Model Migration
4. Foreign Key Migration
5. Data Validation
6. Cleanup (optional)
```

## Pre-Migration Requirements

### Prerequisites

- [ ] Database backup completed
- [ ] Application downtime scheduled
- [ ] Migration scripts tested in staging
- [ ] Rollback procedures verified
- [ ] Monitoring systems in place

### Environment Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Set database connection
export DATABASE_URL="postgresql://user:password@localhost/database"

# Create migration log directory
mkdir -p logs/migration
```

## Migration Procedures

### Step 1: Schema Validation

Validates the current schema state and determines if migration is needed.

```bash
cd backend
python scripts/data_migration.py --operation=validate_schema
```

**Success Criteria:**
- All required tables exist
- Column types are identified correctly
- No schema corruption detected

**Failure Handling:**
- Review schema inconsistencies
- Run Alembic migrations if needed
- Contact development team for schema issues

### Step 2: Data Backup Creation

Creates a complete backup of all data before migration begins.

```bash
python scripts/data_migration.py --operation=backup_data
```

**What it does:**
- Creates `migration_backup` schema
- Copies all data from target tables
- Verifies backup integrity
- Logs backup statistics

**Success Criteria:**
- Backup schema created successfully
- All data copied without errors
- Row counts match between original and backup

**Failure Handling:**
- Check disk space availability
- Verify database permissions
- Review connection stability

### Step 3: User Model Migration

Migrates the Users table from String(36) to native UUID primary keys.

```bash
python scripts/data_migration.py --operation=migrate_users
```

**Process:**
1. Adds temporary `id_uuid` column
2. Validates all existing IDs as proper UUIDs
3. Converts string UUIDs to native UUID type
4. Replaces original column with UUID column
5. Recreates primary key constraint

**Batch Processing:**
- Processes 1000 users per batch (configurable)
- Commits after each batch
- Logs progress regularly

**Success Criteria:**
- All users migrated successfully
- No invalid UUID formats found
- Primary key constraint recreated

### Step 4: Foreign Key Migration

Migrates foreign key references in dependent tables.

```bash
python scripts/data_migration.py --operation=migrate_foreign_keys
```

**Tables Affected:**
- `journal_entries.user_id`
- `tags.user_id`
- `reminders.user_id`

**Process:**
1. Adds temporary `user_id_uuid` column
2. Validates all foreign key values
3. Converts string UUIDs to native UUID type
4. Replaces original column with UUID column
5. Recreates foreign key constraints and indexes

**Success Criteria:**
- All foreign keys migrated successfully
- Referential integrity maintained
- Indexes recreated for performance

### Step 5: Data Validation

Validates the complete migration was successful.

```bash
python scripts/data_migration.py --operation=validate_migration
```

**Validation Checks:**
- All columns use native UUID types
- No orphaned records exist
- Data counts match backup
- Referential integrity maintained
- Index performance acceptable

**Success Criteria:**
- All validation checks pass
- No data loss detected
- Performance benchmarks met

### Step 6: Cleanup (Optional)

Removes backup data after successful migration.

```bash
python scripts/data_migration.py --operation=cleanup_backup
```

**⚠️ Warning:** Only run after complete validation and production testing.

## Full Migration Command

For complete automation, use the full migration command:

```bash
python scripts/data_migration.py --operation=full_migration
```

This executes all steps in sequence with proper error handling.

## Migration Parameters

### Batch Size Configuration

Default batch size is 1000 records. For large datasets:

```bash
python scripts/data_migration.py --operation=migrate_users --batch-size=5000
```

### Custom Database URL

```bash
python scripts/data_migration.py --operation=full_migration --database-url="postgresql://user:pass@host/db"
```

## Monitoring and Logging

### Migration Logs

All operations are logged to:
- `data_migration.log` - Detailed operation logs
- `migration_log` table - Database operation tracking
- Console output - Real-time progress

### Progress Monitoring

```sql
-- Check migration log
SELECT * FROM migration_log ORDER BY started_at DESC;

-- Check migration progress
SELECT 
    operation,
    status,
    started_at,
    completed_at,
    message
FROM migration_log
WHERE started_at > NOW() - INTERVAL '1 day';
```

### Performance Monitoring

```sql
-- Check batch processing performance
SELECT 
    operation,
    AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds
FROM migration_log
WHERE status = 'completed'
GROUP BY operation;
```

## Error Handling

### Common Issues

1. **Invalid UUID Format**
   - **Symptom:** Migration fails with UUID validation error
   - **Solution:** Identify and fix invalid UUID strings
   - **Prevention:** Add UUID validation to application

2. **Orphaned Records**
   - **Symptom:** Foreign key migration fails
   - **Solution:** Clean up orphaned records or assign to valid users
   - **Prevention:** Enforce referential integrity

3. **Disk Space Issues**
   - **Symptom:** Backup creation fails
   - **Solution:** Free disk space or use external backup location
   - **Prevention:** Monitor disk usage before migration

4. **Long-Running Transactions**
   - **Symptom:** Migration hangs or times out
   - **Solution:** Reduce batch size or restart migration
   - **Prevention:** Use appropriate batch sizes for dataset

### Recovery Procedures

1. **Partial Migration Failure**
   ```bash
   # Check migration status
   python scripts/data_migration.py --operation=status
   
   # Rollback if needed
   python scripts/data_migration.py --operation=rollback
   ```

2. **Complete Migration Failure**
   ```bash
   # Full rollback
   python scripts/data_migration.py --operation=rollback
   
   # Restart from validation
   python scripts/data_migration.py --operation=validate_schema
   ```

## Testing Procedures

### Pre-Production Testing

1. **Staging Environment**
   - Test full migration on staging data
   - Verify application functionality
   - Test rollback procedures

2. **Performance Testing**
   - Measure migration time for production data size
   - Test batch size optimization
   - Verify system resource usage

3. **Rollback Testing**
   - Test rollback at each migration step
   - Verify data integrity after rollback
   - Test application functionality after rollback

### Production Validation

1. **Post-Migration Checks**
   - Run validation queries
   - Test critical application functions
   - Monitor system performance

2. **Data Integrity Verification**
   ```sql
   -- Verify UUID types
   SELECT table_name, column_name, data_type 
   FROM information_schema.columns 
   WHERE column_name IN ('id', 'user_id')
   AND table_name IN ('users', 'journal_entries', 'tags', 'reminders');
   
   -- Check referential integrity
   SELECT COUNT(*) FROM journal_entries 
   WHERE user_id NOT IN (SELECT id FROM users);
   ```

## Production Deployment

### Deployment Checklist

- [ ] Staging migration tested successfully
- [ ] Rollback procedures verified
- [ ] Application downtime scheduled
- [ ] Monitoring alerts configured
- [ ] Database backup completed
- [ ] Migration scripts deployed
- [ ] Team notified and on standby

### Migration Execution

1. **Pre-Migration**
   - Stop application services
   - Create database backup
   - Enable enhanced monitoring

2. **Migration**
   - Execute full migration command
   - Monitor progress and logs
   - Validate each step completion

3. **Post-Migration**
   - Run validation checks
   - Start application services
   - Monitor application performance
   - Verify user functionality

### Post-Migration Monitoring

- Application error rates
- Database performance metrics
- User experience metrics
- System resource usage

## Support and Troubleshooting

### Contact Information

- **Development Team:** dev-team@company.com
- **Database Team:** dba-team@company.com
- **DevOps Team:** devops@company.com

### Emergency Procedures

1. **Critical Issues**
   - Immediate rollback if data corruption detected
   - Escalate to development team
   - Document all issues and actions taken

2. **Performance Issues**
   - Monitor system resources
   - Consider reducing batch sizes
   - Implement additional monitoring

### Documentation Updates

This document should be updated after each production migration to reflect:
- Lessons learned
- Performance improvements
- Process optimizations
- New troubleshooting procedures 