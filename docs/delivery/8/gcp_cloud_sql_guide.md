# GCP Cloud SQL Migration Guide

## Overview

This guide provides detailed instructions for migrating the optimized database schema to Google Cloud SQL for PostgreSQL. Cloud SQL offers managed PostgreSQL with built-in high availability, automatic backups, and seamless integration with Google Cloud services.

## Prerequisites

### Required Tools
- Google Cloud SDK (`gcloud`)
- PostgreSQL client tools (`psql`, `pg_dump`, `pg_restore`)
- Terraform (optional, for infrastructure as code)
- Cloud SQL Proxy (for secure connections)

### Required Permissions
```bash
# Required IAM roles
- Cloud SQL Admin
- Compute Network Admin (for VPC configuration)
- Security Admin (for IAM configuration)
- Monitoring Editor (for alerting setup)
```

## Cloud SQL Instance Configuration

### Instance Creation via Console

**Step 1: Create Instance**
1. Navigate to Cloud SQL in Google Cloud Console
2. Click "Create Instance" → "PostgreSQL"
3. Configure instance settings:

**Basic Configuration:**
```
Instance ID: vibes-prod
Password: [Use Secret Manager]
Database version: PostgreSQL 14
Region: us-central1 (or your preferred region)
Zone: Single zone or Multiple zones (HA)
```

**Machine Configuration:**
```
Machine type: Custom (2 vCPU, 7.5 GB memory)
Storage type: SSD
Storage capacity: 100 GB
Enable automatic storage increases: Yes
```

**Connections:**
```
Public IP: Disabled
Private IP: Enabled
Authorized networks: None (use VPC)
SSL: Required
```

### Instance Creation via gcloud CLI

```bash
# Create Cloud SQL instance
gcloud sql instances create vibes-prod \
    --database-version=POSTGRES_14 \
    --tier=db-custom-2-7680 \
    --region=us-central1 \
    --storage-type=SSD \
    --storage-size=100GB \
    --storage-auto-increase \
    --backup-start-time=03:00 \
    --backup-location=us-central1 \
    --enable-bin-log \
    --retained-backups-count=30 \
    --network=projects/PROJECT_ID/global/networks/VPC_NAME \
    --no-assign-ip \
    --database-flags=log_statement=all,shared_preload_libraries=pg_stat_statements

# Create database
gcloud sql databases create vibes --instance=vibes-prod

# Create user
gcloud sql users create vibes_app \
    --instance=vibes-prod \
    --password=PASSWORD_FROM_SECRET_MANAGER
```

### Terraform Configuration

```hcl
# terraform/cloud-sql.tf
resource "google_sql_database_instance" "vibes_prod" {
  name             = "vibes-prod"
  database_version = "POSTGRES_14"
  region          = var.region
  deletion_protection = true

  settings {
    tier = "db-custom-2-7680"
    
    disk_size       = 100
    disk_type       = "PD_SSD"
    disk_autoresize = true
    disk_autoresize_limit = 1000

    backup_configuration {
      enabled                        = true
      start_time                    = "03:00"
      location                      = var.region
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7
      backup_retention_settings {
        retained_backups = 30
        retention_unit   = "COUNT"
      }
    }

    ip_configuration {
      ipv4_enabled                                  = false
      private_network                              = var.vpc_network
      enable_private_path_for_google_cloud_services = true
      require_ssl                                  = true
    }

    database_flags {
      name  = "log_statement"
      value = "all"
    }

    database_flags {
      name  = "shared_preload_libraries"
      value = "pg_stat_statements"
    }

    database_flags {
      name  = "log_min_duration_statement"
      value = "1000"
    }

    insights_config {
      query_insights_enabled    = true
      record_application_tags   = true
      record_client_address     = true
      query_string_length       = 2048
      query_plans_per_minute    = 5
    }

    maintenance_window {
      day          = 7  # Sunday
      hour         = 4  # 4 AM
      update_track = "stable"
    }
  }

  replica_configuration {
    failover_target = false
  }
}

resource "google_sql_database" "vibes" {
  name     = "vibes"
  instance = google_sql_database_instance.vibes_prod.name
}

resource "google_sql_user" "vibes_app" {
  name     = "vibes_app"
  instance = google_sql_database_instance.vibes_prod.name
  password = random_password.vibes_app_password.result
}

resource "random_password" "vibes_app_password" {
  length  = 32
  special = true
}

resource "google_secret_manager_secret" "db_password" {
  secret_id = "vibes-db-password"
  
  replication {
    automatic = true
  }
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.vibes_app_password.result
}
```

## Migration Procedures

### Method 1: Database Dump and Restore

**Step 1: Prepare Source Database**
```bash
# Create a consistent backup
pg_dump -h localhost -p 5432 -U postgres -d vibes \
    --verbose \
    --no-owner \
    --no-privileges \
    --format=custom \
    --file=vibes_backup.dump

# Verify backup
pg_restore --list vibes_backup.dump | head -20
```

**Step 2: Set up Cloud SQL Proxy**
```bash
# Download and install Cloud SQL Proxy
curl -o cloud_sql_proxy https://dl.google.com/cloudsql/cloud_sql_proxy.linux.amd64
chmod +x cloud_sql_proxy

# Start proxy (replace PROJECT_ID and INSTANCE_CONNECTION_NAME)
./cloud_sql_proxy -instances=PROJECT_ID:REGION:INSTANCE_NAME=tcp:5432
```

**Step 3: Restore to Cloud SQL**
```bash
# Test connection
psql -h 127.0.0.1 -p 5432 -U vibes_app -d vibes -c "SELECT version();"

# Create extensions
psql -h 127.0.0.1 -p 5432 -U vibes_app -d vibes << EOF
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
EOF

# Restore database
pg_restore -h 127.0.0.1 -p 5432 -U vibes_app -d vibes \
    --verbose \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    vibes_backup.dump
```

### Method 2: Database Migration Service (DMS)

**Step 1: Create Migration Job**
```bash
# Create a migration job
gcloud database migrate migration-jobs create vibes-migration \
    --region=us-central1 \
    --type=ONE_TIME \
    --dump-path=gs://your-bucket/migration-dumps/ \
    --source=SOURCE_CONNECTION_PROFILE \
    --destination=DESTINATION_CONNECTION_PROFILE
```

**Step 2: Configure Source Connection Profile**
```yaml
# source-profile.yaml
apiVersion: datamigration.googleapis.com/v1
kind: ConnectionProfile
metadata:
  name: source-postgres
spec:
  postgresql:
    host: SOURCE_HOST
    port: 5432
    username: postgres
    password: SOURCE_PASSWORD
    database: vibes
    ssl:
      type: SERVER_ONLY
```

**Step 3: Monitor Migration**
```bash
# Monitor migration progress
gcloud database migrate migration-jobs describe vibes-migration \
    --region=us-central1

# View migration logs
gcloud logging read "resource.type=gce_instance AND 
    logName=projects/PROJECT_ID/logs/datamigration.googleapis.com%2Fmigration"
```

### Method 3: Logical Replication (Minimal Downtime)

**Step 1: Configure Source Database**
```sql
-- On source database
ALTER SYSTEM SET wal_level = logical;
ALTER SYSTEM SET max_replication_slots = 4;
ALTER SYSTEM SET max_wal_senders = 4;

-- Restart PostgreSQL
-- sudo systemctl restart postgresql

-- Create publication
CREATE PUBLICATION vibes_migration FOR ALL TABLES;

-- Create replication slot
SELECT pg_create_logical_replication_slot('vibes_slot', 'pgoutput');
```

**Step 2: Initial Data Load**
```bash
# Create schema-only dump
pg_dump -h SOURCE_HOST -U postgres -d vibes \
    --schema-only \
    --no-owner \
    --no-privileges \
    --file=vibes_schema.sql

# Load schema to Cloud SQL
psql -h 127.0.0.1 -p 5432 -U vibes_app -d vibes \
    -f vibes_schema.sql

# Load initial data
pg_dump -h SOURCE_HOST -U postgres -d vibes \
    --data-only \
    --no-owner \
    --no-privileges \
    --format=custom \
    --file=vibes_data.dump

pg_restore -h 127.0.0.1 -p 5432 -U vibes_app -d vibes \
    --data-only \
    vibes_data.dump
```

**Step 3: Set up Logical Replication**
```sql
-- On Cloud SQL (subscriber)
CREATE SUBSCRIPTION vibes_subscription 
CONNECTION 'host=SOURCE_HOST port=5432 user=replication_user dbname=vibes' 
PUBLICATION vibes_migration;

-- Monitor replication
SELECT * FROM pg_stat_subscription;
SELECT * FROM pg_replication_slots;
```

## Network Configuration

### VPC and Firewall Setup

```bash
# Create VPC network
gcloud compute networks create vibes-vpc \
    --subnet-mode=custom \
    --bgp-routing-mode=regional

# Create subnet
gcloud compute networks subnets create vibes-subnet \
    --network=vibes-vpc \
    --range=10.0.0.0/24 \
    --region=us-central1

# Allocate IP range for Google services
gcloud compute addresses create google-managed-services-vibes-vpc \
    --global \
    --purpose=VPC_PEERING \
    --prefix-length=16 \
    --network=vibes-vpc

# Create private connection
gcloud services vpc-peerings connect \
    --service=servicenetworking.googleapis.com \
    --ranges=google-managed-services-vibes-vpc \
    --network=vibes-vpc
```

### Cloud SQL Auth Proxy Setup

```dockerfile
# Dockerfile for application with Cloud SQL Proxy
FROM python:3.11-slim

# Install Cloud SQL Proxy
RUN curl -o cloud_sql_proxy https://dl.google.com/cloudsql/cloud_sql_proxy.linux.amd64 \
    && chmod +x cloud_sql_proxy \
    && mv cloud_sql_proxy /usr/local/bin/

# Application code
COPY . /app
WORKDIR /app
RUN pip install -r requirements.txt

# Start script
COPY start.sh /start.sh
RUN chmod +x /start.sh

CMD ["/start.sh"]
```

```bash
#!/bin/bash
# start.sh
# Start Cloud SQL Proxy in background
cloud_sql_proxy -instances=$INSTANCE_CONNECTION_NAME=tcp:5432 &

# Wait for proxy to be ready
sleep 5

# Start application
python main.py
```

### Service Account Configuration

```bash
# Create service account for application
gcloud iam service-accounts create vibes-app \
    --display-name="Vibes Application Service Account"

# Grant Cloud SQL Client role
gcloud projects add-iam-policy-binding PROJECT_ID \
    --member="serviceAccount:vibes-app@PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/cloudsql.client"

# Create and download key
gcloud iam service-accounts keys create vibes-app-key.json \
    --iam-account=vibes-app@PROJECT_ID.iam.gserviceaccount.com
```

## Application Configuration

### Connection String Configuration

```python
# config.py
import os
from sqlalchemy import create_engine
from google.cloud import secretmanager

def get_cloud_sql_engine():
    """Create SQLAlchemy engine for Cloud SQL connection."""
    
    # Configuration from environment
    config = {
        'host': os.getenv('DB_HOST', '127.0.0.1'),  # Cloud SQL Proxy
        'port': os.getenv('DB_PORT', '5432'),
        'database': os.getenv('DB_NAME', 'vibes'),
        'user': os.getenv('DB_USER', 'vibes_app'),
    }
    
    # Get password from Secret Manager
    if os.getenv('GOOGLE_CLOUD_PROJECT'):
        client = secretmanager.SecretManagerServiceClient()
        secret_name = f"projects/{os.getenv('GOOGLE_CLOUD_PROJECT')}/secrets/vibes-db-password/versions/latest"
        response = client.access_secret_version(request={"name": secret_name})
        password = response.payload.data.decode("UTF-8")
    else:
        password = os.getenv('DB_PASSWORD')
    
    # Create connection string
    connection_string = (
        f"postgresql://{config['user']}:{password}"
        f"@{config['host']}:{config['port']}/{config['database']}"
        f"?sslmode=require"
    )
    
    # Create engine with Cloud SQL optimizations
    engine = create_engine(
        connection_string,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        pool_recycle=3600,
        echo=False,
        connect_args={
            "application_name": "vibes-app",
            "connect_timeout": 10,
        }
    )
    
    return engine
```

### Kubernetes Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vibes-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: vibes-app
  template:
    metadata:
      labels:
        app: vibes-app
    spec:
      serviceAccountName: vibes-app-ksa
      containers:
      - name: vibes-app
        image: gcr.io/PROJECT_ID/vibes-app:latest
        env:
        - name: INSTANCE_CONNECTION_NAME
          value: "PROJECT_ID:us-central1:vibes-prod"
        - name: DB_HOST
          value: "127.0.0.1"
        - name: DB_USER
          value: "vibes_app"
        - name: GOOGLE_CLOUD_PROJECT
          value: "PROJECT_ID"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: vibes-app-ksa
  annotations:
    iam.gke.io/gcp-service-account: vibes-app@PROJECT_ID.iam.gserviceaccount.com
```

## Monitoring and Alerting

### Cloud Monitoring Setup

```yaml
# monitoring/alerting.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: cloudsql-alerts
spec:
  groups:
  - name: cloudsql.rules
    rules:
    - alert: CloudSQLHighCPU
      expr: cloudsql_database_cpu_utilization > 0.8
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "Cloud SQL CPU usage is high"
        description: "CPU usage has been above 80% for 5 minutes"
    
    - alert: CloudSQLHighMemory
      expr: cloudsql_database_memory_utilization > 0.85
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "Cloud SQL memory usage is high"
        description: "Memory usage has been above 85% for 5 minutes"
    
    - alert: CloudSQLHighConnections
      expr: cloudsql_database_postgresql_num_backends > 80
      for: 2m
      labels:
        severity: critical
      annotations:
        summary: "Too many connections to Cloud SQL"
        description: "Connection count is {{ $value }}"
```

### Custom Metrics

```python
# monitoring.py
from google.cloud import monitoring_v3
import time

def send_custom_metric(project_id, metric_value, metric_type):
    """Send custom metric to Cloud Monitoring."""
    client = monitoring_v3.MetricServiceClient()
    project_name = f"projects/{project_id}"
    
    series = monitoring_v3.TimeSeries()
    series.metric.type = f"custom.googleapis.com/{metric_type}"
    series.resource.type = "global"
    
    now = time.time()
    seconds = int(now)
    nanos = int((now - seconds) * 10 ** 9)
    interval = monitoring_v3.TimeInterval(
        {"end_time": {"seconds": seconds, "nanos": nanos}}
    )
    point = monitoring_v3.Point(
        {"interval": interval, "value": {"double_value": metric_value}}
    )
    series.points = [point]
    
    client.create_time_series(name=project_name, time_series=[series])

# Usage in application
def track_database_query_time(duration_seconds):
    send_custom_metric(
        project_id=os.getenv('GOOGLE_CLOUD_PROJECT'),
        metric_value=duration_seconds,
        metric_type="database/query_duration"
    )
```

## Backup and Recovery

### Automated Backup Configuration

```bash
# Configure backup settings
gcloud sql instances patch vibes-prod \
    --backup-start-time=03:00 \
    --backup-location=us-central1 \
    --retained-backups-count=30 \
    --retained-transaction-log-days=7
```

### Manual Backup Procedures

```bash
# Create on-demand backup
gcloud sql backups create \
    --instance=vibes-prod \
    --description="Pre-migration backup $(date '+%Y-%m-%d %H:%M:%S')"

# List backups
gcloud sql backups list --instance=vibes-prod

# Export to Cloud Storage
gcloud sql export sql vibes-prod gs://vibes-backups/export-$(date +%Y%m%d-%H%M%S).sql \
    --database=vibes \
    --offload
```

### Disaster Recovery Procedures

```bash
# Create read replica for disaster recovery
gcloud sql instances create vibes-replica \
    --master-instance-name=vibes-prod \
    --tier=db-custom-2-7680 \
    --region=us-east1 \
    --replica-type=READ \
    --availability-type=ZONAL

# Promote replica to standalone (failover)
gcloud sql instances promote-replica vibes-replica

# Point-in-time recovery
gcloud sql instances clone vibes-prod vibes-recovery \
    --point-in-time='2024-01-15T10:30:00.000Z'
```

## Performance Optimization

### Query Performance Insights

```bash
# Enable Query Insights
gcloud sql instances patch vibes-prod \
    --insights-config-query-insights-enabled \
    --insights-config-record-application-tags \
    --insights-config-record-client-address \
    --insights-config-query-string-length=2048
```

### Connection Pooling

```python
# pgbouncer.py - Connection pooling configuration
import asyncio
import asyncpg
from contextlib import asynccontextmanager

class ConnectionPool:
    def __init__(self, dsn, min_size=10, max_size=20):
        self.dsn = dsn
        self.min_size = min_size
        self.max_size = max_size
        self.pool = None
    
    async def initialize(self):
        self.pool = await asyncpg.create_pool(
            self.dsn,
            min_size=self.min_size,
            max_size=self.max_size,
            command_timeout=60,
            server_settings={
                'application_name': 'vibes-app',
                'search_path': 'public',
            }
        )
    
    @asynccontextmanager
    async def acquire(self):
        async with self.pool.acquire() as connection:
            yield connection
    
    async def close(self):
        if self.pool:
            await self.pool.close()
```

### Index Optimization

```sql
-- Create indexes for common query patterns
CREATE INDEX CONCURRENTLY idx_journal_entries_user_created 
    ON journal_entries(user_id, created_at DESC)
    WHERE created_at > NOW() - INTERVAL '1 year';

CREATE INDEX CONCURRENTLY idx_journal_entries_content_search 
    ON journal_entries USING gin(to_tsvector('english', content))
    WHERE content IS NOT NULL;

-- Monitor index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

## Cost Optimization

### Right-Sizing Strategy

```bash
# Monitor resource utilization
gcloud monitoring metrics list --filter="resource.type=cloudsql_database"

# Resize instance based on metrics
gcloud sql instances patch vibes-prod --tier=db-custom-4-15360
```

### Storage Optimization

```bash
# Monitor storage usage
gcloud sql instances describe vibes-prod \
    --format="value(settings.dataDiskSizeGb,settings.storageAutoResizeLimit)"

# Optimize storage type
gcloud sql instances patch vibes-prod --storage-type=SSD
```

## Security Best Practices

### IAM and Access Control

```bash
# Create custom IAM role
gcloud iam roles create vibesDbUser \
    --project=PROJECT_ID \
    --title="Vibes Database User" \
    --description="Custom role for Vibes application database access" \
    --permissions="cloudsql.instances.connect"

# Bind role to service account
gcloud projects add-iam-policy-binding PROJECT_ID \
    --member="serviceAccount:vibes-app@PROJECT_ID.iam.gserviceaccount.com" \
    --role="projects/PROJECT_ID/roles/vibesDbUser"
```

### SSL Certificate Management

```bash
# Create client certificate
gcloud sql ssl-certs create vibes-client-cert \
    --instance=vibes-prod

# Download certificates
gcloud sql ssl-certs describe vibes-client-cert \
    --instance=vibes-prod \
    --format="get(cert)" > client-cert.pem

gcloud sql instances describe vibes-prod \
    --format="get(serverCaCert.cert)" > server-ca.pem
```

## Troubleshooting

### Common Issues and Solutions

**Issue: Connection timeout to Cloud SQL**
```bash
# Check Cloud SQL Auth proxy logs
kubectl logs -l app=vibes-app -c cloud-sql-proxy

# Verify instance connection name
gcloud sql instances describe vibes-prod --format="value(connectionName)"
```

**Issue: SSL connection errors**
```python
# Ensure SSL is properly configured
connection_string = f"postgresql://user:pass@host:5432/db?sslmode=require&sslcert=client-cert.pem&sslkey=client-key.pem&sslrootcert=server-ca.pem"
```

**Issue: High memory usage**
```sql
-- Check for large queries and memory usage
SELECT 
    query,
    total_time,
    calls,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements 
WHERE total_time > 1000
ORDER BY total_time DESC;
```

### Monitoring and Debugging

```sql
-- Check Cloud SQL specific metrics
SELECT 
    pg_size_pretty(pg_database_size(current_database())) as db_size,
    numbackends as connections,
    xact_commit as commits,
    xact_rollback as rollbacks
FROM pg_stat_database 
WHERE datname = current_database();

-- Monitor replication lag (if using read replicas)
SELECT 
    application_name,
    state,
    sync_state,
    pg_wal_lsn_diff(pg_current_wal_lsn(), flush_lsn) AS flush_lag
FROM pg_stat_replication;
```

This guide provides comprehensive coverage of migrating to GCP Cloud SQL for PostgreSQL. For additional platform-specific guidance, refer to the main [Cloud Migration Guide](./cloud_migration_guide.md). 