# AWS RDS PostgreSQL Migration Guide

## Overview

This guide provides detailed instructions for migrating the optimized database schema to Amazon RDS for PostgreSQL. RDS offers managed PostgreSQL with automatic backups, Multi-AZ deployments, read replicas, and integration with AWS services.

## Prerequisites

### Required Tools
- AWS CLI (`aws`)
- PostgreSQL client tools (`psql`, `pg_dump`, `pg_restore`)
- Terraform (optional, for infrastructure as code)
- AWS Database Migration Service (DMS) for large-scale migrations

### Required Permissions
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "rds:*",
        "ec2:CreateSecurityGroup",
        "ec2:DescribeSecurityGroups",
        "ec2:AuthorizeSecurityGroupIngress",
        "ec2:CreateSubnetGroup",
        "ec2:DescribeSubnets",
        "ec2:DescribeVpcs",
        "secretsmanager:*",
        "cloudwatch:*",
        "logs:*"
      ],
      "Resource": "*"
    }
  ]
}
```

## RDS Instance Configuration

### Instance Creation via AWS Console

**Step 1: Create DB Instance**
1. Navigate to RDS in AWS Console
2. Click "Create database"
3. Choose "Standard create" and "PostgreSQL"

**Engine Configuration:**
```
Engine version: PostgreSQL 14.9
Templates: Production (or Dev/Test for non-prod)
```

**Settings:**
```
DB instance identifier: vibes-prod
Master username: vibes_admin
Master password: [Use AWS Secrets Manager]
```

**Instance Configuration:**
```
DB instance class: db.t3.medium (2 vCPU, 4 GB RAM)
Storage type: General Purpose SSD (gp3)
Allocated storage: 100 GB
Storage autoscaling: Enable (max 1000 GB)
```

**Connectivity:**
```
VPC: Custom VPC
Subnet group: Create new (private subnets)
Public access: No
VPC security groups: Create new
Database port: 5432
```

**Additional Configuration:**
```
Initial database name: vibes
Backup retention: 30 days
Backup window: 03:00-04:00 UTC
Maintenance window: sun:04:00-sun:05:00 UTC
Enable encryption: Yes
Performance Insights: Enable (7 days retention)
Monitoring: Enhanced monitoring (60 seconds)
Log exports: PostgreSQL log
```

### Instance Creation via AWS CLI

```bash
# Create DB subnet group
aws rds create-db-subnet-group \
    --db-subnet-group-name vibes-subnet-group \
    --db-subnet-group-description "Subnet group for Vibes database" \
    --subnet-ids subnet-12345678 subnet-87654321

# Create security group
aws ec2 create-security-group \
    --group-name vibes-rds-sg \
    --description "Security group for Vibes RDS instance" \
    --vpc-id vpc-12345678

# Allow PostgreSQL traffic from application security group
aws ec2 authorize-security-group-ingress \
    --group-id sg-rds123456 \
    --protocol tcp \
    --port 5432 \
    --source-group sg-app123456

# Create RDS instance
aws rds create-db-instance \
    --db-instance-identifier vibes-prod \
    --db-instance-class db.t3.medium \
    --engine postgres \
    --engine-version 14.9 \
    --master-username vibes_admin \
    --master-user-password $(aws secretsmanager get-secret-value --secret-id vibes-db-password --query SecretString --output text) \
    --allocated-storage 100 \
    --max-allocated-storage 1000 \
    --storage-type gp3 \
    --storage-encrypted \
    --vpc-security-group-ids sg-rds123456 \
    --db-subnet-group-name vibes-subnet-group \
    --backup-retention-period 30 \
    --preferred-backup-window "03:00-04:00" \
    --preferred-maintenance-window "sun:04:00-sun:05:00" \
    --enable-performance-insights \
    --performance-insights-retention-period 7 \
    --monitoring-interval 60 \
    --monitoring-role-arn arn:aws:iam::ACCOUNT:role/rds-monitoring-role \
    --enable-cloudwatch-logs-exports postgresql \
    --db-name vibes \
    --tags Key=Environment,Value=production Key=Application,Value=vibes
```

### Terraform Configuration

```hcl
# terraform/rds.tf
resource "aws_db_subnet_group" "vibes" {
  name       = "vibes-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name = "Vibes DB subnet group"
  }
}

resource "aws_security_group" "rds" {
  name_prefix = "vibes-rds-"
  vpc_id      = var.vpc_id

  ingress {
    description     = "PostgreSQL from application"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.app_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "vibes-rds-sg"
  }
}

resource "aws_db_instance" "vibes_prod" {
  identifier = "vibes-prod"

  # Engine
  engine         = "postgres"
  engine_version = "14.9"
  instance_class = var.db_instance_class

  # Storage
  allocated_storage     = 100
  max_allocated_storage = 1000
  storage_type         = "gp3"
  storage_encrypted    = true
  kms_key_id          = var.kms_key_id

  # Database
  db_name  = "vibes"
  username = "vibes_admin"
  password = random_password.master_password.result

  # Network
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.vibes.name
  publicly_accessible    = false

  # Backup
  backup_retention_period = 30
  backup_window          = "03:00-04:00"
  copy_tags_to_snapshot  = true
  delete_automated_backups = false

  # Maintenance
  maintenance_window         = "sun:04:00-sun:05:00"
  auto_minor_version_upgrade = true

  # Monitoring
  monitoring_interval                 = 60
  monitoring_role_arn                = aws_iam_role.rds_monitoring.arn
  performance_insights_enabled       = true
  performance_insights_retention_period = 7
  enabled_cloudwatch_logs_exports    = ["postgresql"]

  # Deletion protection
  deletion_protection = true
  skip_final_snapshot = false
  final_snapshot_identifier = "vibes-prod-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"

  tags = {
    Name        = "vibes-prod"
    Environment = var.environment
    Backup      = "required"
  }
}

resource "random_password" "master_password" {
  length  = 32
  special = true
}

resource "aws_secretsmanager_secret" "db_password" {
  name = "vibes-db-master-password"
  
  replica {
    region = var.backup_region
  }
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = jsonencode({
    username = aws_db_instance.vibes_prod.username
    password = random_password.master_password.result
    endpoint = aws_db_instance.vibes_prod.endpoint
    port     = aws_db_instance.vibes_prod.port
    dbname   = aws_db_instance.vibes_prod.db_name
  })
}

resource "aws_iam_role" "rds_monitoring" {
  name = "rds-monitoring-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}
```

## Migration Procedures

### Method 1: Database Dump and Restore

**Step 1: Create Source Database Backup**
```bash
# Create consistent backup with --serializable-deferrable
pg_dump -h source-host -p 5432 -U postgres -d vibes \
    --verbose \
    --no-owner \
    --no-privileges \
    --format=custom \
    --serializable-deferrable \
    --file=vibes_backup.dump

# Verify backup integrity
pg_restore --list vibes_backup.dump | wc -l
```

**Step 2: Restore to RDS**
```bash
# Get RDS endpoint
RDS_ENDPOINT=$(aws rds describe-db-instances \
    --db-instance-identifier vibes-prod \
    --query 'DBInstances[0].Endpoint.Address' \
    --output text)

# Test connection
psql -h $RDS_ENDPOINT -p 5432 -U vibes_admin -d vibes -c "SELECT version();"

# Create extensions (as superuser)
psql -h $RDS_ENDPOINT -p 5432 -U vibes_admin -d vibes << EOF
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
EOF

# Restore database
pg_restore -h $RDS_ENDPOINT -p 5432 -U vibes_admin -d vibes \
    --verbose \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    --single-transaction \
    vibes_backup.dump
```

### Method 2: AWS Database Migration Service (DMS)

**Step 1: Create DMS Resources**
```bash
# Create replication subnet group
aws dms create-replication-subnet-group \
    --replication-subnet-group-identifier vibes-dms-subnet-group \
    --replication-subnet-group-description "DMS subnet group for Vibes migration" \
    --subnet-ids subnet-12345678 subnet-87654321

# Create replication instance
aws dms create-replication-instance \
    --replication-instance-identifier vibes-migration-instance \
    --replication-instance-class dms.t3.medium \
    --allocated-storage 100 \
    --vpc-security-group-ids sg-dms123456 \
    --replication-subnet-group-identifier vibes-dms-subnet-group \
    --multi-az \
    --engine-version 3.4.7
```

**Step 2: Create Source and Target Endpoints**
```bash
# Create source endpoint
aws dms create-endpoint \
    --endpoint-identifier vibes-source \
    --endpoint-type source \
    --engine-name postgres \
    --server-name source-host \
    --port 5432 \
    --database-name vibes \
    --username postgres \
    --password source-password

# Create target endpoint (RDS)
aws dms create-endpoint \
    --endpoint-identifier vibes-target \
    --endpoint-type target \
    --engine-name postgres \
    --server-name $RDS_ENDPOINT \
    --port 5432 \
    --database-name vibes \
    --username vibes_admin \
    --password $(aws secretsmanager get-secret-value --secret-id vibes-db-password --query SecretString --output text | jq -r .password)

# Test endpoints
aws dms test-connection \
    --replication-instance-arn arn:aws:dms:region:account:rep:vibes-migration-instance \
    --endpoint-arn arn:aws:dms:region:account:endpoint:vibes-source

aws dms test-connection \
    --replication-instance-arn arn:aws:dms:region:account:rep:vibes-migration-instance \
    --endpoint-arn arn:aws:dms:region:account:endpoint:vibes-target
```

**Step 3: Create and Start Migration Task**
```bash
# Create migration task
aws dms create-replication-task \
    --replication-task-identifier vibes-migration-task \
    --source-endpoint-arn arn:aws:dms:region:account:endpoint:vibes-source \
    --target-endpoint-arn arn:aws:dms:region:account:endpoint:vibes-target \
    --replication-instance-arn arn:aws:dms:region:account:rep:vibes-migration-instance \
    --migration-type full-load-and-cdc \
    --table-mappings file://table-mappings.json \
    --replication-task-settings file://task-settings.json

# Start migration task
aws dms start-replication-task \
    --replication-task-arn arn:aws:dms:region:account:task:vibes-migration-task \
    --start-replication-task-type start-replication

# Monitor migration progress
aws dms describe-replication-tasks \
    --filters Name=replication-task-id,Values=vibes-migration-task
```

**Table Mappings Configuration (table-mappings.json):**
```json
{
  "rules": [
    {
      "rule-type": "selection",
      "rule-id": "1",
      "rule-name": "1",
      "object-locator": {
        "schema-name": "public",
        "table-name": "%"
      },
      "rule-action": "include"
    },
    {
      "rule-type": "transformation",
      "rule-id": "2",
      "rule-name": "2",
      "rule-target": "schema",
      "object-locator": {
        "schema-name": "public"
      },
      "rule-action": "rename",
      "value": "public"
    }
  ]
}
```

### Method 3: Logical Replication (Blue-Green Deployment)

**Step 1: Set up Logical Replication**
```sql
-- On source database
ALTER SYSTEM SET wal_level = logical;
ALTER SYSTEM SET max_replication_slots = 4;
ALTER SYSTEM SET max_wal_senders = 4;
-- Restart required

-- Create publication
CREATE PUBLICATION vibes_migration FOR ALL TABLES;

-- Create replication slot
SELECT pg_create_logical_replication_slot('vibes_replication', 'pgoutput');
```

**Step 2: Initial Schema and Data Load**
```bash
# Export schema
pg_dump -h source-host -U postgres -d vibes \
    --schema-only \
    --no-owner \
    --no-privileges \
    --file=vibes_schema.sql

# Load schema to RDS
psql -h $RDS_ENDPOINT -U vibes_admin -d vibes -f vibes_schema.sql

# Load initial data
pg_dump -h source-host -U postgres -d vibes \
    --data-only \
    --no-owner \
    --no-privileges \
    --format=custom \
    --file=vibes_initial_data.dump

pg_restore -h $RDS_ENDPOINT -U vibes_admin -d vibes \
    --data-only \
    --disable-triggers \
    vibes_initial_data.dump
```

**Step 3: Set up Subscription on RDS**
```sql
-- On RDS (target)
CREATE SUBSCRIPTION vibes_subscription
CONNECTION 'host=source-host port=5432 user=replication_user dbname=vibes'
PUBLICATION vibes_migration;

-- Monitor replication
SELECT * FROM pg_stat_subscription;
```

## Application Configuration

### IAM Database Authentication

**Step 1: Enable IAM Authentication on RDS**
```bash
aws rds modify-db-instance \
    --db-instance-identifier vibes-prod \
    --enable-iam-database-authentication \
    --apply-immediately
```

**Step 2: Create Database User for IAM**
```sql
-- Connect as master user
CREATE USER vibes_app;
GRANT rds_iam TO vibes_app;
GRANT ALL PRIVILEGES ON DATABASE vibes TO vibes_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO vibes_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO vibes_app;
```

**Step 3: Create IAM Policy and Role**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "rds-db:connect"
      ],
      "Resource": [
        "arn:aws:rds-db:us-east-1:ACCOUNT:dbuser:vibes-prod/vibes_app"
      ]
    }
  ]
}
```

### Application Connection Code

```python
# connection.py
import boto3
import psycopg2
from sqlalchemy import create_engine, event
import os

def get_rds_auth_token():
    """Generate RDS IAM authentication token."""
    rds_client = boto3.client('rds')
    
    return rds_client.generate_db_auth_token(
        DBHostname=os.getenv('RDS_ENDPOINT'),
        Port=5432,
        DBUsername=os.getenv('DB_USERNAME', 'vibes_app'),
        Region=os.getenv('AWS_REGION', 'us-east-1')
    )

def create_rds_connection():
    """Create connection using IAM authentication."""
    token = get_rds_auth_token()
    
    connection_params = {
        'host': os.getenv('RDS_ENDPOINT'),
        'port': 5432,
        'database': os.getenv('DB_NAME', 'vibes'),
        'user': os.getenv('DB_USERNAME', 'vibes_app'),
        'password': token,
        'sslmode': 'require',
        'connect_timeout': 10,
        'application_name': 'vibes-app'
    }
    
    return psycopg2.connect(**connection_params)

def get_rds_engine():
    """Create SQLAlchemy engine with IAM authentication."""
    
    def get_connection():
        return create_rds_connection()
    
    engine = create_engine(
        "postgresql://",
        creator=get_connection,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        pool_recycle=3600,  # Recycle connections every hour for token refresh
        echo=False
    )
    
    return engine

# Alternative: Using Secrets Manager for password
def get_rds_engine_with_secrets():
    """Create SQLAlchemy engine using AWS Secrets Manager."""
    secrets_client = boto3.client('secretsmanager')
    
    secret_value = secrets_client.get_secret_value(
        SecretId='vibes-db-master-password'
    )
    
    secret = json.loads(secret_value['SecretString'])
    
    connection_string = (
        f"postgresql://{secret['username']}:{secret['password']}"
        f"@{secret['endpoint']}:{secret['port']}/{secret['dbname']}"
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

### ECS Task Definition with RDS

```json
{
  "family": "vibes-app",
  "taskRoleArn": "arn:aws:iam::ACCOUNT:role/vibes-app-task-role",
  "executionRoleArn": "arn:aws:iam::ACCOUNT:role/vibes-app-execution-role",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [
    {
      "name": "vibes-app",
      "image": "ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/vibes-app:latest",
      "environment": [
        {
          "name": "RDS_ENDPOINT",
          "value": "vibes-prod.cluster-xyz.us-east-1.rds.amazonaws.com"
        },
        {
          "name": "DB_NAME",
          "value": "vibes"
        },
        {
          "name": "AWS_REGION",
          "value": "us-east-1"
        }
      ],
      "secrets": [
        {
          "name": "DB_USERNAME",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:vibes-db-creds:username"
        },
        {
          "name": "DB_PASSWORD",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:vibes-db-creds:password"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/vibes-app",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

## Monitoring and Alerting

### CloudWatch Metrics and Alarms

```bash
# Create CloudWatch alarms
aws cloudwatch put-metric-alarm \
    --alarm-name "RDS-High-CPU" \
    --alarm-description "RDS CPU utilization is high" \
    --metric-name CPUUtilization \
    --namespace AWS/RDS \
    --statistic Average \
    --period 300 \
    --evaluation-periods 2 \
    --threshold 80 \
    --comparison-operator GreaterThanThreshold \
    --dimensions Name=DBInstanceIdentifier,Value=vibes-prod \
    --alarm-actions arn:aws:sns:us-east-1:ACCOUNT:rds-alerts

aws cloudwatch put-metric-alarm \
    --alarm-name "RDS-High-Connections" \
    --alarm-description "RDS connection count is high" \
    --metric-name DatabaseConnections \
    --namespace AWS/RDS \
    --statistic Average \
    --period 300 \
    --evaluation-periods 2 \
    --threshold 80 \
    --comparison-operator GreaterThanThreshold \
    --dimensions Name=DBInstanceIdentifier,Value=vibes-prod

aws cloudwatch put-metric-alarm \
    --alarm-name "RDS-High-Read-Latency" \
    --alarm-description "RDS read latency is high" \
    --metric-name ReadLatency \
    --namespace AWS/RDS \
    --statistic Average \
    --period 300 \
    --evaluation-periods 3 \
    --threshold 0.2 \
    --comparison-operator GreaterThanThreshold \
    --dimensions Name=DBInstanceIdentifier,Value=vibes-prod
```

### Performance Insights Configuration

```python
# performance_insights.py
import boto3
from datetime import datetime, timedelta

def get_performance_insights_data():
    """Retrieve Performance Insights data for analysis."""
    pi_client = boto3.client('pi')
    
    end_time = datetime.utcnow()
    start_time = end_time - timedelta(hours=1)
    
    response = pi_client.get_resource_metrics(
        ServiceType='RDS',
        Identifier='vibes-prod-ResourceId',  # Get from describe-db-instances
        MetricQueries=[
            {
                'Metric': 'db.SQL.Innodb_rows_read.avg',
                'GroupBy': {
                    'Group': 'db.sql_tokenized.statement'
                }
            }
        ],
        StartTime=start_time,
        EndTime=end_time,
        PeriodInSeconds=3600
    )
    
    return response

def analyze_slow_queries():
    """Analyze slow queries from Performance Insights."""
    pi_data = get_performance_insights_data()
    
    for metric in pi_data['MetricList']:
        print(f"Metric: {metric['Key']['Metric']}")
        for datapoint in metric['DataPoints']:
            print(f"  Time: {datapoint['Timestamp']}, Value: {datapoint['Value']}")
```

### Custom Metrics and Dashboards

```python
# custom_metrics.py
import boto3
from datetime import datetime

def publish_custom_metrics(connection_pool_size, active_queries, avg_response_time):
    """Publish custom application metrics to CloudWatch."""
    cloudwatch = boto3.client('cloudwatch')
    
    cloudwatch.put_metric_data(
        Namespace='Vibes/Database',
        MetricData=[
            {
                'MetricName': 'ConnectionPoolSize',
                'Value': connection_pool_size,
                'Unit': 'Count',
                'Timestamp': datetime.utcnow()
            },
            {
                'MetricName': 'ActiveQueries',
                'Value': active_queries,
                'Unit': 'Count',
                'Timestamp': datetime.utcnow()
            },
            {
                'MetricName': 'AverageResponseTime',
                'Value': avg_response_time,
                'Unit': 'Milliseconds',
                'Timestamp': datetime.utcnow()
            }
        ]
    )
```

## Backup and Recovery

### Automated Backup Configuration

```bash
# Modify backup settings
aws rds modify-db-instance \
    --db-instance-identifier vibes-prod \
    --backup-retention-period 30 \
    --preferred-backup-window "03:00-04:00" \
    --copy-tags-to-snapshot \
    --apply-immediately
```

### Cross-Region Backup Replication

```bash
# Create read replica in different region for DR
aws rds create-db-instance-read-replica \
    --db-instance-identifier vibes-prod-replica-west \
    --source-db-instance-identifier arn:aws:rds:us-east-1:ACCOUNT:db:vibes-prod \
    --db-instance-class db.t3.medium \
    --availability-zone us-west-2a \
    --publicly-accessible false \
    --auto-minor-version-upgrade false
```

### Point-in-Time Recovery

```bash
# Restore to point in time
aws rds restore-db-instance-to-point-in-time \
    --source-db-instance-identifier vibes-prod \
    --target-db-instance-identifier vibes-recovery \
    --restore-time 2024-01-15T10:30:00.000Z \
    --db-instance-class db.t3.medium \
    --no-publicly-accessible

# Create snapshot for backup
aws rds create-db-snapshot \
    --db-snapshot-identifier vibes-snapshot-$(date +%Y%m%d-%H%M%S) \
    --db-instance-identifier vibes-prod
```

## High Availability and Disaster Recovery

### Multi-AZ Deployment

```bash
# Enable Multi-AZ
aws rds modify-db-instance \
    --db-instance-identifier vibes-prod \
    --multi-az \
    --apply-immediately
```

### Read Replica Configuration

```bash
# Create read replica for read scaling
aws rds create-db-instance-read-replica \
    --db-instance-identifier vibes-prod-read-replica \
    --source-db-instance-identifier vibes-prod \
    --db-instance-class db.t3.medium \
    --availability-zone us-east-1b

# Monitor replica lag
aws rds describe-db-instances \
    --db-instance-identifier vibes-prod-read-replica \
    --query 'DBInstances[0].ReadReplicaSourceDBInstanceIdentifier'
```

### Failover Procedures

```bash
# Promote read replica to standalone instance
aws rds promote-read-replica \
    --db-instance-identifier vibes-prod-read-replica

# Update application connection strings to point to new primary
# Update DNS records or load balancer configuration
```

## Security Best Practices

### Encryption Configuration

```bash
# Enable encryption at rest (for new instances)
aws rds create-db-instance \
    --storage-encrypted \
    --kms-key-id arn:aws:kms:us-east-1:ACCOUNT:key/key-id \
    # ... other parameters

# Enable encryption in transit (SSL)
aws rds modify-db-instance \
    --db-instance-identifier vibes-prod \
    --ca-certificate-identifier rds-ca-2019
```

### Network Security

```hcl
# Security group for RDS
resource "aws_security_group" "rds" {
  name_prefix = "vibes-rds-"
  vpc_id      = var.vpc_id

  ingress {
    description     = "PostgreSQL from application tier"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.app_security_group_id]
  }

  ingress {
    description = "PostgreSQL from bastion host"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [var.bastion_cidr]
  }

  tags = {
    Name = "vibes-rds-sg"
  }
}
```

### Database Security Configuration

```sql
-- Create application-specific database user
CREATE USER vibes_app WITH PASSWORD 'secure_password';

-- Grant minimal required privileges
GRANT CONNECT ON DATABASE vibes TO vibes_app;
GRANT USAGE ON SCHEMA public TO vibes_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO vibes_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO vibes_app;

-- Enable row-level security if needed
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_isolation ON users FOR ALL TO vibes_app USING (id = current_setting('app.current_user_id')::uuid);

-- Enable audit logging
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_connections = 'on';
ALTER SYSTEM SET log_disconnections = 'on';
SELECT pg_reload_conf();
```

## Cost Optimization

### Reserved Instance Strategy

```bash
# Purchase Reserved Instance for cost savings
aws rds purchase-reserved-db-instances-offering \
    --reserved-db-instances-offering-id offering-id \
    --reserved-db-instance-id vibes-prod-reserved \
    --db-instance-count 1
```

### Aurora Serverless Migration

```hcl
# Consider Aurora Serverless for variable workloads
resource "aws_rds_cluster" "vibes_aurora" {
  cluster_identifier     = "vibes-aurora"
  engine                = "aurora-postgresql"
  engine_mode           = "serverless"
  database_name         = "vibes"
  master_username       = "vibes_admin"
  master_password       = var.master_password
  
  scaling_configuration {
    auto_pause               = true
    max_capacity            = 16
    min_capacity            = 2
    seconds_until_auto_pause = 300
  }
  
  skip_final_snapshot = true
}
```

## Troubleshooting

### Common Connection Issues

**Issue: SSL connection required**
```python
# Ensure SSL is enabled
connection_string = "postgresql://user:pass@host:5432/db?sslmode=require"

# Download RDS CA certificate
# wget https://s3.amazonaws.com/rds-downloads/rds-ca-2019-root.pem
connection_string = "postgresql://user:pass@host:5432/db?sslmode=verify-full&sslrootcert=rds-ca-2019-root.pem"
```

**Issue: IAM authentication failures**
```python
# Check IAM token generation
import boto3
rds_client = boto3.client('rds')
token = rds_client.generate_db_auth_token(
    DBHostname='your-rds-endpoint',
    Port=5432,
    DBUsername='vibes_app',
    Region='us-east-1'
)
print(f"Generated token: {token[:50]}...")

# Verify IAM permissions
aws sts get-caller-identity
aws iam simulate-principal-policy \
    --policy-source-arn arn:aws:iam::ACCOUNT:role/vibes-app-role \
    --action-names rds-db:connect \
    --resource-arns arn:aws:rds-db:us-east-1:ACCOUNT:dbuser:vibes-prod/vibes_app
```

### Performance Troubleshooting

```sql
-- Check for long-running queries
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

-- Check index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan < 100
ORDER BY pg_relation_size(indexrelid) DESC;

-- Monitor connection counts
SELECT 
    state,
    count(*) as connection_count
FROM pg_stat_activity 
GROUP BY state
ORDER BY connection_count DESC;
```

This comprehensive guide covers all aspects of migrating to AWS RDS for PostgreSQL. For additional guidance, refer to the main [Cloud Migration Guide](./cloud_migration_guide.md). 