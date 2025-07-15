# Cloud Migration Guide for Optimized Database Schema

## Overview

This guide provides comprehensive instructions for migrating the UUID-optimized database schema to cloud PostgreSQL instances. The optimized schema includes native UUID types, comprehensive indexing, and performance improvements that are particularly well-suited for cloud deployment.

## Table of Contents

1. [Pre-Migration Planning](#pre-migration-planning)
2. [Cloud Platform Comparison](#cloud-platform-comparison)
3. [Migration Strategy](#migration-strategy)
4. [Platform-Specific Guides](#platform-specific-guides)
5. [Post-Migration Validation](#post-migration-validation)
6. [Performance Optimization](#performance-optimization)
7. [Monitoring and Maintenance](#monitoring-and-maintenance)
8. [Troubleshooting](#troubleshooting)

## Pre-Migration Planning

### Requirements Assessment

**Database Requirements:**
- PostgreSQL 12+ (recommended 14+ for optimal UUID performance)
- Native UUID extension support
- Timezone handling capabilities
- JSON/JSONB support for monitoring data
- Full-text search capabilities (if needed)

**Performance Requirements:**
- Minimum 2 vCPUs, 4GB RAM for production
- SSD storage with minimum 3000 IOPS
- Automatic backup retention (7-30 days recommended)
- Read replicas for high availability (optional)

**Security Requirements:**
- SSL/TLS encryption in transit
- Encryption at rest
- VPC/private network access
- IAM-based authentication
- Audit logging capabilities

### Schema Compatibility Check

The optimized schema includes these key features that must be supported:

```sql
-- Native UUID types
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Timezone-aware timestamps
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comprehensive indexing
CREATE INDEX CONCURRENTLY idx_journal_entries_user_date 
    ON journal_entries(user_id, entry_date);
CREATE INDEX CONCURRENTLY idx_journal_entries_content_gin 
    ON journal_entries USING gin(to_tsvector('english', content));
```

## Cloud Platform Comparison

| Feature | GCP Cloud SQL | AWS RDS | Azure Database |
|---------|---------------|---------|----------------|
| **PostgreSQL Versions** | 11, 12, 13, 14, 15 | 11, 12, 13, 14, 15 | 11, 12, 13, 14, 15 |
| **UUID Extension** | ✅ Built-in | ✅ Built-in | ✅ Built-in |
| **Automatic Backups** | ✅ Point-in-time | ✅ Point-in-time | ✅ Point-in-time |
| **Read Replicas** | ✅ Cross-region | ✅ Cross-region | ✅ Cross-region |
| **SSL/TLS** | ✅ Required | ✅ Required | ✅ Required |
| **VPC Support** | ✅ Private IP | ✅ VPC | ✅ VNet |
| **IAM Integration** | ✅ Cloud IAM | ✅ AWS IAM | ✅ Azure AD |
| **Monitoring** | Cloud Monitoring | CloudWatch | Azure Monitor |
| **Cost Model** | Per hour + storage | Per hour + storage | Per hour + storage |

## Migration Strategy

### 1. Database Dump and Restore Approach

**Recommended for:**
- Initial migration
- Smaller databases (< 100GB)
- Minimal downtime tolerance

**Steps:**
1. Create optimized cloud database instance
2. Export current database with schema and data
3. Import to cloud instance
4. Validate data integrity
5. Update application connection strings
6. Switch traffic to cloud database

### 2. Logical Replication Approach

**Recommended for:**
- Large databases (> 100GB)
- Minimal downtime requirements
- Gradual migration preferred

**Steps:**
1. Set up cloud database instance
2. Configure logical replication
3. Initial data sync
4. Monitor replication lag
5. Coordinated cutover
6. Cleanup old instance

### 3. Migration Tools Comparison

| Tool | Best For | Pros | Cons |
|------|----------|------|------|
| `pg_dump`/`pg_restore` | Small-medium DBs | Simple, reliable | Downtime required |
| Logical Replication | Large DBs | Minimal downtime | Complex setup |
| DMS (AWS) | AWS migrations | Managed service | AWS-specific |
| Database Migration Service (GCP) | GCP migrations | Managed service | GCP-specific |

## Platform-Specific Guides

### GCP Cloud SQL for PostgreSQL

**Instance Configuration:**
```yaml
# terraform example
resource "google_sql_database_instance" "vibes_prod" {
  name             = "vibes-prod"
  database_version = "POSTGRES_14"
  region          = "us-central1"
  
  settings {
    tier = "db-custom-2-7680"  # 2 vCPU, 7.5GB RAM
    
    disk_size = 100
    disk_type = "PD_SSD"
    disk_autoresize = true
    
    backup_configuration {
      enabled                        = true
      start_time                    = "03:00"
      point_in_time_recovery_enabled = true
      backup_retention_settings {
        retained_backups = 30
      }
    }
    
    ip_configuration {
      ipv4_enabled    = false
      private_network = var.vpc_network
      require_ssl     = true
    }
    
    database_flags {
      name  = "log_statement"
      value = "all"
    }
    
    insights_config {
      query_insights_enabled  = true
      record_application_tags = true
    }
  }
}
```

**Connection Configuration:**
```python
# Python connection example
import os
from sqlalchemy import create_engine

def get_cloud_sql_engine():
    db_config = {
        'host': os.getenv('CLOUD_SQL_HOST', 'localhost'),
        'port': os.getenv('CLOUD_SQL_PORT', '5432'),
        'database': os.getenv('CLOUD_SQL_DATABASE', 'vibes'),
        'username': os.getenv('CLOUD_SQL_USERNAME'),
        'password': os.getenv('CLOUD_SQL_PASSWORD'),
    }
    
    connection_string = (
        f"postgresql://{db_config['username']}:{db_config['password']}"
        f"@{db_config['host']}:{db_config['port']}/{db_config['database']}"
        f"?sslmode=require"
    )
    
    return create_engine(
        connection_string,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        echo=False
    )
```

### AWS RDS for PostgreSQL

**Instance Configuration:**
```yaml
# terraform example
resource "aws_db_instance" "vibes_prod" {
  identifier = "vibes-prod"
  
  engine         = "postgres"
  engine_version = "14.9"
  instance_class = "db.t3.medium"
  
  allocated_storage     = 100
  max_allocated_storage = 1000
  storage_type         = "gp3"
  storage_encrypted    = true
  
  db_name  = "vibes"
  username = var.db_username
  password = var.db_password
  
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.vibes.name
  
  backup_retention_period = 30
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  
  skip_final_snapshot = false
  final_snapshot_identifier = "vibes-prod-final-snapshot"
  
  enabled_cloudwatch_logs_exports = ["postgresql"]
  
  performance_insights_enabled = true
  monitoring_interval         = 60
  monitoring_role_arn        = aws_iam_role.rds_monitoring.arn
  
  tags = {
    Name = "vibes-prod"
    Environment = "production"
  }
}
```

**Connection Configuration:**
```python
# Python connection example for RDS
import boto3
from sqlalchemy import create_engine

def get_rds_engine():
    # Use IAM authentication (recommended)
    client = boto3.client('rds')
    
    db_config = {
        'host': os.getenv('RDS_HOST'),
        'port': 5432,
        'database': 'vibes',
        'username': os.getenv('RDS_USERNAME'),
        'region': os.getenv('AWS_REGION', 'us-east-1')
    }
    
    # Generate IAM auth token
    token = client.generate_db_auth_token(
        DBHostname=db_config['host'],
        Port=db_config['port'],
        DBUsername=db_config['username'],
        Region=db_config['region']
    )
    
    connection_string = (
        f"postgresql://{db_config['username']}:{token}"
        f"@{db_config['host']}:{db_config['port']}/{db_config['database']}"
        f"?sslmode=require"
    )
    
    return create_engine(
        connection_string,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        pool_recycle=3600  # Recycle connections hourly for IAM tokens
    )
```

## Post-Migration Validation

### Schema Validation

Run these queries to validate the migrated schema:

```sql
-- Verify UUID extension is available
SELECT * FROM pg_available_extensions WHERE name = 'uuid-ossp';

-- Check that all tables exist with correct structure
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- Validate UUID fields
SELECT table_name, column_name
FROM information_schema.columns
WHERE data_type = 'uuid'
ORDER BY table_name;

-- Check indexes
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Verify foreign key constraints
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY';
```

### Data Validation

```sql
-- Check record counts match
SELECT 'users' as table_name, count(*) as record_count FROM users
UNION ALL
SELECT 'journal_entries', count(*) FROM journal_entries
UNION ALL
SELECT 'tags', count(*) FROM tags
UNION ALL
SELECT 'reminders', count(*) FROM reminders;

-- Validate UUID format and consistency
SELECT 
    'users' as table_name,
    count(*) as total_records,
    count(CASE WHEN id IS NOT NULL THEN 1 END) as non_null_ids,
    count(DISTINCT id) as unique_ids
FROM users
UNION ALL
SELECT 
    'journal_entries',
    count(*),
    count(CASE WHEN id IS NOT NULL THEN 1 END),
    count(DISTINCT id)
FROM journal_entries;

-- Validate foreign key relationships
SELECT 
    'journal_entries_user_fk' as constraint_name,
    count(*) as total_entries,
    count(u.id) as valid_user_references
FROM journal_entries je
LEFT JOIN users u ON je.user_id = u.id;
```

### Performance Validation

```sql
-- Test index usage with EXPLAIN ANALYZE
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM journal_entries 
WHERE user_id = '123e4567-e89b-12d3-a456-426614174000'::uuid;

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM journal_entries 
WHERE user_id = '123e4567-e89b-12d3-a456-426614174000'::uuid 
  AND entry_date >= '2024-01-01'::date;

-- Test query performance
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements 
WHERE query LIKE '%journal_entries%'
ORDER BY mean_time DESC;
```

## Performance Optimization

### Cloud-Specific Optimizations

**GCP Cloud SQL:**
```sql
-- Enable recommended extensions
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pgstattuple;

-- Optimize configuration
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET track_activity_query_size = 2048;
ALTER SYSTEM SET log_min_duration_statement = 1000;
```

**AWS RDS:**
```sql
-- Parameter group settings (via AWS Console or CLI)
-- shared_preload_libraries = 'pg_stat_statements'
-- log_statement = 'all'
-- log_min_duration_statement = 1000
-- track_activities = on
-- track_counts = on
```

### Index Optimization

```sql
-- Monitor index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY tablename;

-- Create additional indexes if needed
CREATE INDEX CONCURRENTLY idx_journal_entries_created_at 
    ON journal_entries(created_at) 
    WHERE created_at > NOW() - INTERVAL '1 year';

-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY idx_journal_entries_user_created 
    ON journal_entries(user_id, created_at DESC);
```

### Connection Pooling

**PgBouncer Configuration:**
```ini
[databases]
vibes = host=your-cloud-db-host port=5432 dbname=vibes

[pgbouncer]
listen_port = 6432
listen_addr = 0.0.0.0
auth_type = md5
auth_file = userlist.txt
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
max_db_connections = 100
reserve_pool_size = 5
server_reset_query = DISCARD ALL
```

## Monitoring and Maintenance

### Essential Metrics to Monitor

**Database Performance:**
- Query response times
- Connection count and pool utilization
- Index hit ratio (should be > 95%)
- Cache hit ratio (should be > 95%)
- Replication lag (if using read replicas)

**Resource Utilization:**
- CPU usage (should be < 80% average)
- Memory usage (should be < 85%)
- Disk I/O and IOPS
- Network I/O
- Storage usage and growth rate

**Application Metrics:**
- Transaction rate
- Error rate
- UUID generation performance
- Foreign key constraint violations

### Monitoring Setup Examples

**GCP Cloud SQL:**
```yaml
# monitoring.yaml for Cloud Monitoring
resources:
  - name: cloudsql-alerts
    type: gcp-types/monitoring-v1:projects.alertPolicies
    properties:
      displayName: "Cloud SQL Alerts"
      conditions:
        - displayName: "High CPU Usage"
          conditionThreshold:
            filter: 'resource.type="cloudsql_database"'
            comparison: COMPARISON_GREATER_THAN
            thresholdValue: 0.8
            duration: 300s
```

**AWS RDS:**
```yaml
# cloudwatch-alarms.yaml
Resources:
  HighCPUAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: RDS-High-CPU
      MetricName: CPUUtilization
      Namespace: AWS/RDS
      Statistic: Average
      Period: 300
      EvaluationPeriods: 2
      Threshold: 80
      ComparisonOperator: GreaterThanThreshold
      Dimensions:
        - Name: DBInstanceIdentifier
          Value: !Ref DatabaseInstance
```

### Maintenance Procedures

**Weekly Maintenance:**
```sql
-- Update table statistics
ANALYZE;

-- Check for unused indexes
SELECT 
    schemaname, 
    tablename, 
    indexname,
    idx_scan,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes 
WHERE idx_scan < 10
ORDER BY pg_relation_size(indexrelid) DESC;

-- Monitor slow queries
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements 
WHERE mean_time > 1000
ORDER BY mean_time DESC
LIMIT 10;
```

**Monthly Maintenance:**
```sql
-- Vacuum and analyze heavy tables
VACUUM ANALYZE journal_entries;
VACUUM ANALYZE users;

-- Check database size growth
SELECT 
    pg_size_pretty(pg_database_size(current_database())) as db_size,
    pg_size_pretty(pg_total_relation_size('journal_entries')) as journal_size,
    pg_size_pretty(pg_total_relation_size('users')) as users_size;

-- Review and optimize query performance
SELECT 
    substring(query from 1 for 60) as query_snippet,
    calls,
    total_time / calls as avg_time_ms,
    rows / calls as avg_rows
FROM pg_stat_statements 
WHERE calls > 100
ORDER BY total_time / calls DESC
LIMIT 20;
```

## Backup and Recovery

### Automated Backup Strategy

**Backup Types:**
1. **Continuous WAL Archiving** - Point-in-time recovery
2. **Daily Full Backups** - Complete database snapshots
3. **Weekly Application-Level Exports** - For cross-platform compatibility

**Retention Policy:**
- WAL archives: 7 days
- Daily backups: 30 days
- Weekly exports: 12 weeks
- Monthly archives: 12 months

### Recovery Procedures

**Point-in-Time Recovery (GCP):**
```bash
# Create new instance from backup
gcloud sql instances clone vibes-prod vibes-recovery \
    --backup-id=backup-id \
    --bin-log-file-name=mysql-bin.000001 \
    --bin-log-position=123456

# Alternative: restore to specific timestamp
gcloud sql backups restore backup-id \
    --restore-instance=vibes-recovery \
    --backup-instance=vibes-prod
```

**Point-in-Time Recovery (AWS):**
```bash
# Restore from automated backup
aws rds restore-db-instance-to-point-in-time \
    --source-db-instance-identifier vibes-prod \
    --target-db-instance-identifier vibes-recovery \
    --restore-time 2024-01-15T10:30:00.000Z
```

### Disaster Recovery Testing

**Monthly DR Test Procedure:**
1. Create test recovery instance
2. Validate data integrity
3. Test application connectivity
4. Measure recovery time (RTO)
5. Measure data loss (RPO)
6. Document results and improvements
7. Clean up test resources

## Security Best Practices

### Network Security

**VPC Configuration:**
- Private subnets for database instances
- Security groups with minimal required access
- No direct internet access to database
- VPN or bastion host for administrative access

**Connection Security:**
- SSL/TLS encryption required
- Certificate validation enabled
- Regular certificate rotation
- No plain-text credentials in code

### Authentication and Authorization

**IAM Integration:**
```python
# Example IAM-based connection
import boto3
from sqlalchemy import create_engine, event

def get_iam_token():
    rds_client = boto3.client('rds')
    return rds_client.generate_db_auth_token(
        DBHostname=DB_HOST,
        Port=5432,
        DBUsername=DB_USER,
        Region=AWS_REGION
    )

def create_iam_engine():
    engine = create_engine(
        f"postgresql://{DB_USER}@{DB_HOST}:5432/{DB_NAME}",
        creator=lambda: create_connection_with_iam()
    )
    return engine
```

**Database Roles and Permissions:**
```sql
-- Create application-specific roles
CREATE ROLE vibes_app_role;
CREATE ROLE vibes_readonly_role;

-- Grant minimal required permissions
GRANT CONNECT ON DATABASE vibes TO vibes_app_role;
GRANT USAGE ON SCHEMA public TO vibes_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO vibes_app_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO vibes_app_role;

-- Read-only access for reporting
GRANT CONNECT ON DATABASE vibes TO vibes_readonly_role;
GRANT USAGE ON SCHEMA public TO vibes_readonly_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO vibes_readonly_role;
```

### Audit and Compliance

**Audit Logging Configuration:**
```sql
-- Enable comprehensive audit logging
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_connections = 'on';
ALTER SYSTEM SET log_disconnections = 'on';
ALTER SYSTEM SET log_duration = 'on';
ALTER SYSTEM SET log_hostname = 'on';
ALTER SYSTEM SET log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h ';
```

**Compliance Considerations:**
- Data encryption at rest and in transit
- Access logging and monitoring
- Regular security updates
- Backup encryption
- Geographic data residency requirements

## Cost Optimization

### Right-Sizing Strategies

**Performance Monitoring for Sizing:**
```sql
-- Monitor resource utilization
SELECT 
    now() as timestamp,
    numbackends as active_connections,
    xact_commit as transactions_committed,
    xact_rollback as transactions_rolled_back,
    blks_read as disk_blocks_read,
    blks_hit as buffer_cache_hits,
    temp_files as temp_files_created,
    temp_bytes as temp_bytes_written
FROM pg_stat_database 
WHERE datname = current_database();
```

**Instance Sizing Guidelines:**
- Start with smaller instances and scale up based on metrics
- Monitor CPU, memory, and IOPS utilization
- Consider burstable instances for variable workloads
- Use read replicas to offload read traffic

### Storage Optimization

**GCP Cloud SQL:**
- Use SSD storage for better performance
- Enable automatic storage increase
- Monitor storage growth patterns
- Consider different storage types based on IOPS requirements

**AWS RDS:**
- Use gp3 storage for cost-effective performance
- Enable storage autoscaling
- Monitor storage metrics
- Consider Provisioned IOPS for high-performance needs

### Reserved Instances and Committed Use

**Long-term Cost Savings:**
- Reserved Instances (AWS) - 1-3 year commitments
- Committed Use Discounts (GCP) - 1-3 year commitments
- Right-size before committing to reserved capacity
- Monitor utilization to ensure value

## Troubleshooting

### Common Migration Issues

**Issue: SSL Connection Failures**
```
Error: SSL connection required
```
**Solution:**
```python
# Ensure SSL is enabled in connection string
connection_string = f"postgresql://user:pass@host:5432/db?sslmode=require"

# For self-signed certificates
connection_string = f"postgresql://user:pass@host:5432/db?sslmode=require&sslcert=client-cert.pem&sslkey=client-key.pem&sslrootcert=ca-cert.pem"
```

**Issue: UUID Extension Not Available**
```
Error: function uuid_generate_v4() does not exist
```
**Solution:**
```sql
-- Connect as superuser and create extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Verify extension is available
SELECT * FROM pg_available_extensions WHERE name = 'uuid-ossp';
```

**Issue: Connection Pool Exhaustion**
```
Error: remaining connection slots reserved for non-replication superuser connections
```
**Solution:**
```python
# Implement connection pooling
from sqlalchemy.pool import QueuePool

engine = create_engine(
    connection_string,
    poolclass=QueuePool,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=3600
)
```

**Issue: High Replication Lag**
```
Warning: Replica lag > 30 seconds
```
**Solution:**
- Check network connectivity between regions
- Verify replica instance has sufficient IOPS
- Monitor primary database load
- Consider increasing replica instance size

### Performance Troubleshooting

**Slow Query Analysis:**
```sql
-- Enable pg_stat_statements if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Find slowest queries
SELECT 
    substring(query from 1 for 100) as query_snippet,
    calls,
    total_time,
    total_time / calls as avg_time,
    rows / calls as avg_rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) as hit_percent
FROM pg_stat_statements 
WHERE calls > 100
ORDER BY total_time DESC
LIMIT 20;

-- Check for missing indexes
SELECT 
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    seq_tup_read / seq_scan as avg_seq_read
FROM pg_stat_user_tables
WHERE seq_scan > 0
ORDER BY seq_tup_read DESC;
```

**Connection Issues:**
```sql
-- Monitor active connections
SELECT 
    datname,
    state,
    count(*) as connection_count
FROM pg_stat_activity 
WHERE state IS NOT NULL
GROUP BY datname, state
ORDER BY connection_count DESC;

-- Find long-running queries
SELECT 
    pid,
    usename,
    datname,
    state,
    query_start,
    now() - query_start as duration,
    query
FROM pg_stat_activity 
WHERE state != 'idle' 
  AND now() - query_start > interval '5 minutes'
ORDER BY duration DESC;
```

### Monitoring and Alerting Setup

**Key Metrics Dashboard:**
- Database connections (current/max)
- Query response times (p50, p95, p99)
- Index hit ratio (should be > 95%)
- Buffer cache hit ratio (should be > 95%)
- Replication lag (if applicable)
- Storage usage and growth rate
- CPU and memory utilization

**Alert Thresholds:**
- CPU > 80% for 5 minutes
- Memory > 85% for 5 minutes
- Connection count > 80% of max
- Replication lag > 30 seconds
- Query response time p95 > 1 second
- Index hit ratio < 90%
- Storage usage > 85%

## Conclusion

This guide provides a comprehensive framework for migrating the optimized database schema to cloud PostgreSQL instances. The key success factors are:

1. **Thorough Planning** - Understand requirements and constraints
2. **Proper Testing** - Validate schema, data, and performance
3. **Monitoring Setup** - Implement comprehensive observability
4. **Security Best Practices** - Follow cloud security guidelines
5. **Cost Optimization** - Right-size and monitor resource usage

For platform-specific details, refer to the dedicated guides:
- [GCP Cloud SQL Migration Guide](./gcp_cloud_sql_guide.md)
- [AWS RDS Migration Guide](./aws_rds_guide.md)
- [Backup and Recovery Procedures](./backup_recovery_procedures.md)
- [Performance Monitoring Guide](./performance_monitoring_guide.md)

Remember to always test migration procedures in a non-production environment first and have a rollback plan ready. 