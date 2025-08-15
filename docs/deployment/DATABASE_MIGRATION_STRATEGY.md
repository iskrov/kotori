# Database Migration Strategy for Production Deployments

## 🎯 Overview

This document defines the safe deployment strategy for database migrations in Kotori's production environment. The strategy prioritizes **data safety**, **zero-downtime deployment**, and **rollback capability**.

Winning approach: Execute Alembic migrations from Google Cloud Build using a Private Worker Pool with VPC access to Cloud SQL (private IP), inject secrets from Secret Manager, and create an automatic pre-migration backup. Trigger this via the deployment script or run independently with `./scripts/cloud-deploy.sh --migrations-only --yes`.

## 🔍 Current Migration System Analysis

### Technology Stack
- **Migration Tool**: Alembic 1.12.1
- **Database**: PostgreSQL 17 (Cloud SQL)
- **ORM**: SQLAlchemy 2.0.23
- **Current Head**: `7c39d7b141c7` (add_consent_audit_fields_to_share_access)

### Migration Chain Status
```
7c39d7b141c7 (head) ← add_consent_audit_fields_to_share_access
↑
add_sharing_tables ← Sharing functionality tables
↑
add_share_templates_manual ← Share templates
↑
[... previous migrations ...]
```

### Key Migration Files
- **Configuration**: `backend/alembic.ini`
- **Environment**: `backend/migrations/env.py` 
- **Versions**: `backend/migrations/versions/`
- **Latest Migration**: `7c39d7b141c7_add_consent_audit_fields_to_share_access.py`

## 🛡️ Safety-First Migration Strategy

### Phase 1: Pre-Deployment Validation

#### 1.1 Migration Safety Check
```bash
# Check migration history consistency
cd backend
alembic history --verbose

# Validate migration syntax (dry-run)
alembic upgrade head --sql > migration_preview.sql

# Review generated SQL for safety
cat migration_preview.sql
```

#### 1.2 Production Database Backup
```bash
# Create point-in-time backup before migration
gcloud sql backups create --instance=kotori-db --description="Pre-migration backup $(date +%Y%m%d-%H%M%S)"

# Verify backup exists
gcloud sql backups list --instance=kotori-db --limit=5
```

#### 1.3 Migration Impact Assessment
- **Data Loss Risk**: ❌ No DROP COLUMN or DROP TABLE operations
- **Downtime Required**: ✅ Only for schema changes requiring locks
- **Rollback Complexity**: ✅ Simple - all migrations have downgrade functions
- **Performance Impact**: ⚠️ Index creation may temporarily impact queries

### Phase 2: Safe Migration Deployment

#### 2.1 Winning Strategy: Cloud Build Private Pool Runner

Migrations are executed inside Google Cloud Build using a Private Worker Pool to reach Cloud SQL over private IP. Secrets are injected from Secret Manager; a pre-migration Cloud SQL backup is created automatically.

Run it anytime with:

```bash
./scripts/cloud-deploy.sh --migrations-only --yes
```

What this does under the hood:

- Builds the backend image and tags it for the migration run: `us-central1-docker.pkg.dev/kotori-io/kotori-images/kotori-api:migration-${SHORT_SHA}`
- Creates a Cloud SQL backup on instance `kotori-db` with a timestamped description
- Runs Alembic from inside the backend image at `/home/kotori/.local/bin/alembic upgrade head`
- Injects secrets via Cloud Build `availableSecrets` → `secretEnv`:
  - `DATABASE_URL` ← Secret `database-url`
  - `SECRET_KEY` ← Secret `secret-key`
  - `GOOGLE_CLOUD_PROJECT` ← Secret `google-cloud-project`
  - `GOOGLE_CLOUD_LOCATION` ← Secret `google-cloud-location`
  - `ENCRYPTION_MASTER_SALT` ← Secret `encryption-master-salt`
- Runs entirely within the Private Worker Pool `projects/kotori-io/locations/us-central1/workerPools/private-pool`

Config reference: see `deploy/run-migrations.yaml` and `scripts/cloud-deploy.sh`.

### Phase 3: Post-Migration Validation

#### 3.1 Migration Success Verification
```bash
# Verify current migration state
alembic current

# Check database connectivity and basic queries
python -c "
from app.core.database import get_db
from app.models.user import User
import asyncio

async def test_db():
    async for db in get_db():
        result = await db.execute('SELECT COUNT(*) FROM users')
        print(f'User count: {result.scalar()}')
        break

asyncio.run(test_db())
"
```

#### 3.2 Application Health Check
```bash
# Deploy application and test critical endpoints
curl -f "$BACKEND_URL/api/health"
curl -f "$BACKEND_URL/api/v1/auth/me" -H "Authorization: Bearer test_token"
```

## 🚨 Rollback Procedures

### Immediate Rollback (Application Level)
```bash
# Rollback to previous Cloud Run revision
gcloud run services update-traffic kotori-api \
    --to-revisions=PREVIOUS_REVISION=100 \
    --region=us-central1
```

### Database Rollback (Schema Level)
```bash
# Identify target revision for rollback
alembic history

# Rollback to specific revision
alembic downgrade REVISION_ID

# Verify rollback success
alembic current
```

### Emergency Rollback (Full Restore)
```bash
# Restore from backup (LAST RESORT)
gcloud sql backups restore BACKUP_ID \
    --restore-instance=kotori-db \
    --backup-instance=kotori-db
```

## 🔧 Integration with Deployment Script and Cloud Build

### Deployment Flow (with Cloud Build migrations)

```mermaid
graph TD
    A[Start Deployment] --> B[Check Prerequisites]
    B --> C[Git Status Check]
    C --> D[Create Database Backup]
    D --> E[Run Migration Safety Check]
    E --> F{Migrations Safe?}
    F -->|No| G[Abort Deployment]
    F -->|Yes| H[Submit Cloud Build (Private Pool) to Run Alembic]
    H --> I{Migrations Success?}
    I -->|No| J[Rollback & Exit]
    I -->|Yes| K[Build & Deploy Backend]
    K --> L[Build & Deploy Frontend]
    L --> M[Health Checks]
    M --> N[Deployment Complete]
```

### Migration Runner Implementation (as built)

Key files and behavior:

- `scripts/cloud-deploy.sh` submits a Cloud Build using the Private Pool:

```bash
gcloud beta builds submit \
  --config=deploy/run-migrations.yaml \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --worker-pool="$PRIVATE_POOL_NAME" \
  .
```

- `deploy/run-migrations.yaml` builds the backend image, creates a Cloud SQL backup on `kotori-db`, then runs Alembic inside the image. Secrets are injected via `availableSecrets` → `secretEnv` and the build runs on the Private Pool.

## 📋 Migration Deployment Checklist

### Pre-Deployment
- [ ] **Backup Created**: Point-in-time backup before migration
- [ ] **Migration Preview**: SQL reviewed for safety
- [ ] **Rollback Plan**: Downgrade path confirmed
- [ ] **Team Notification**: Stakeholders informed of deployment window

### During Deployment  
- [ ] **Migration Execution**: Alembic upgrade successful
- [ ] **Revision Verification**: Current revision matches expected
- [ ] **Basic Connectivity**: Database responds to queries
- [ ] **Application Deployment**: Backend/frontend deployed successfully

### Post-Deployment
- [ ] **Health Checks**: All endpoints responding
- [ ] **Feature Testing**: New functionality works correctly
- [ ] **Performance Check**: No degradation in response times
- [ ] **Monitoring**: Logs show no migration-related errors

## ⚠️ Migration Risk Assessment

### Low Risk Migrations
- ✅ **Add Column** (nullable): Safe, no downtime
- ✅ **Add Index**: May cause temporary performance impact
- ✅ **Add Table**: Safe, no impact on existing data

### Medium Risk Migrations
- ⚠️ **Alter Column** (compatible): Test thoroughly
- ⚠️ **Add Constraint**: May fail on existing data
- ⚠️ **Rename Column**: Requires application compatibility

### High Risk Migrations  
- ❌ **Drop Column**: Requires careful coordination
- ❌ **Drop Table**: Data loss risk
- ❌ **Data Migration**: Large dataset transformations

## 🔍 Monitoring and Alerts

### Migration Monitoring
```bash
# Monitor migration progress
tail -f /var/log/alembic.log

# Check database locks during migration
SELECT * FROM pg_locks WHERE NOT granted;

# Monitor active connections
SELECT count(*) FROM pg_stat_activity;
```

### Post-Migration Monitoring
- **Database Performance**: Query response times
- **Application Errors**: Migration-related failures
- **Data Integrity**: Spot checks on critical tables
- **User Experience**: Frontend functionality validation

## 🎯 Success Criteria

A migration deployment is considered successful when:

1. ✅ **Migration Completed**: Alembic reports success
2. ✅ **Application Healthy**: All health checks pass
3. ✅ **Features Functional**: New/existing features work correctly
4. ✅ **Performance Maintained**: No significant degradation
5. ✅ **No Data Loss**: All existing data preserved
6. ✅ **Rollback Tested**: Rollback procedure verified (in staging)

## 📚 Related Documentation

- [Deployment Script](../../scripts/cloud-deploy.sh)
- [Deployment Troubleshooting](./DEPLOYMENT_TROUBLESHOOTING.md)
- [Alembic Documentation](https://alembic.sqlalchemy.org/en/latest/)
- [PostgreSQL Backup/Restore](https://cloud.google.com/sql/docs/postgres/backup-recovery)

---

*Last Updated: August 15, 2025*  
*Current Production Revision: 7c39d7b141c7*

---

## 🧰 Troubleshooting: What didn’t work and how we fixed it

- Wrong Secret Names in Cloud Run deploy
  - Symptom: Backend container failed to start; envs not resolved
  - Cause: Used uppercase names in `--set-secrets`; actual Secret Manager names are lowercase, hyphenated
  - Fix: Use `--set-secrets "DATABASE_URL=database-url:latest,SECRET_KEY=secret-key:latest,GOOGLE_CLOUD_PROJECT=google-cloud-project:latest,GOOGLE_CLOUD_LOCATION=google-cloud-location:latest,ENCRYPTION_MASTER_SALT=encryption-master-salt:latest"`

- Running Alembic locally from a developer machine
  - Symptom: `psycopg2.OperationalError: connection ... refused`
  - Cause: No network path to Cloud SQL Private IP from local shell
  - Fix: Run migrations inside GCP using Cloud Build Private Pools

- Cloud Build substitutions misuse (`INVALID_ARGUMENT` for `BACKUP_DESCRIPTION`, `PATH`)
  - Symptom: Errors like `key ... is not a valid built-in substitution`
  - Cause: Attempted to define ad-hoc substitutions or export PATH in YAML that Cloud Build treated as substitutions
  - Fix: Use shell expansion with `$$` inside the step; avoid `${...}`-style variables that Cloud Build parses; use absolute paths for tools

- Missing `--region` with Private Pool
  - Symptom: `--region flag required when workerpool resource includes region substitution`
  - Fix: Add `--region "$REGION"` to the submit command

- Disallowed `machineType` with Private Pools
  - Symptom: `machine_type option is disallowed for builds with a Worker Pool`
  - Fix: Remove `machineType` from Cloud Build `options`

- Secret Manager PermissionDenied in Cloud Build
  - Symptom: `Permission 'secretmanager.versions.access' denied`
  - Fix: Grant `roles/secretmanager.secretAccessor` to the Cloud Build SA and service agent; also grant `roles/cloudsql.client`

- Trying to `pip install` in runtime build step
  - Symptom: `ModuleNotFoundError: No module named 'alembic'` / permission errors
  - Fix: Use the prebuilt backend image that already contains Alembic; set `HOME` and `PYTHONPATH`; invoke Alembic via absolute path `/home/kotori/.local/bin/alembic`

- Migration failed due to non-existent indexes/tables
  - Symptom: `psycopg2.errors.UndefinedObject: index "..." does not exist`
  - Cause: Production schema diverged from autogenerate assumptions
  - Fix: Make migration idempotent (e.g., `if_exists=True`), or remove unconditional drops; verify with SQL preview

- Connectivity to Cloud SQL over private IP
  - Requirement: Private Worker Pool must be attached to the VPC/subnet with routes/firewalls to Cloud SQL Private IP
  - Fix: Ensure pool network config is correct; grant `roles/cloudsql.client`

Note: If Cloud Build shows transient `recvmsg: Connection reset by peer` but the build `STATUS` is `SUCCESS`, verify the final step outcomes in Cloud Logs before retrying.
