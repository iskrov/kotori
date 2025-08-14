# Kotori GCP Deployment Troubleshooting Guide

This document captures all the issues encountered during the successful deployment of Kotori to Google Cloud Platform and their solutions.

## Overview

The Kotori deployment consists of 4 main components:
1. **Database**: Cloud SQL PostgreSQL 17
2. **Backend API**: FastAPI on Cloud Run
3. **Frontend Web App**: React Native Web on Cloud Run
4. **Infrastructure**: GCP services, IAM, secrets, etc.

## Critical Issues Encountered & Solutions

### 0. Backend Container Startup Failures (August 2025)

**Issue**: Backend deployments consistently failing with container startup errors despite successful image builds.

**Symptoms**:
```
ERROR: Required environment variable 'DATABASE_URL' is not set in .env file
Container called exit(1)
Default STARTUP TCP probe failed 1 time consecutively for container "kotori-api-1" on port 8001
```

**Root Cause**: Environment variable mapping mismatch between:
- Backend code expectations: `DATABASE_URL`, `SECRET_KEY` (uppercase)
- Google Cloud secrets: `database-url`, `secret-key` (lowercase with hyphens)
- Deployment configuration: Incorrect secret mapping

**Failed Deployment Command**:
```bash
--set-secrets "database-url=database-url:latest,secret-key=secret-key:latest"
# This creates env vars: database-url, secret-key
# But backend expects: DATABASE_URL, SECRET_KEY
```

**Correct Solution**:
```bash
--set-secrets "DATABASE_URL=database-url:latest,SECRET_KEY=secret-key:latest,GOOGLE_CLOUD_PROJECT=google-cloud-project:latest,GOOGLE_CLOUD_LOCATION=google-cloud-location:latest,ENCRYPTION_MASTER_SALT=encryption-master-salt:latest"
```

**Required Secrets List**:
- `DATABASE_URL` → `database-url:latest`
- `SECRET_KEY` → `secret-key:latest` 
- `GOOGLE_CLOUD_PROJECT` → `google-cloud-project:latest`
- `GOOGLE_CLOUD_LOCATION` → `google-cloud-location:latest`
- `ENCRYPTION_MASTER_SALT` → `encryption-master-salt:latest`

**Debugging Commands**:
```bash
# Check logs for failed revision
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=kotori-api AND resource.labels.revision_name=kotori-api-00032-d9n" --limit=20

# Compare working vs failed configuration
gcloud run services describe kotori-api --region=us-central1 --format="export" > current-config.yaml
```

**Key Learning**: Service account changes require reviewing ALL environment variable mappings and ensuring complete secret configuration.

### 1. Cloud SQL PostgreSQL 17 Configuration Issues

**Issue**: Multiple failed attempts to create PostgreSQL 17 instance with correct tier/edition combinations.

**Failed Attempts**:
```bash
# Attempt 1: Default tier
--tier=db-f1-micro
# Error: Invalid Tier (db-f1-micro) for (ENTERPRISE_PLUS) Edition

# Attempt 2: Performance optimized
--tier=db-perf-optimized-N-2  
# Error: Invalid tier

# Attempt 3: Custom CPU/memory without edition
--cpu=1 --memory=3840MB
# Error: Invalid Tier (db-custom-1-3840) for (ENTERPRISE_PLUS) Edition
```

**Solution**: Use custom tier with ENTERPRISE edition for PostgreSQL 17:
```bash
gcloud sql instances create kotori-db \
    --database-version=POSTGRES_17 \
    --tier=db-custom-1-3840 \
    --edition=ENTERPRISE \
    --region=northamerica-northeast2
```

**Key Learning**: PostgreSQL 17 in Cloud SQL requires:
- Custom machine type (`db-custom-X-Y` format)
- ENTERPRISE edition (not ENTERPRISE_PLUS)
- Specific CPU/memory combinations

### 2. Backend Container Runtime Issues

**Issue**: Container failed to start due to psutil incompatibility in Cloud Run environment.

**Error**:
```
ValueError: b'rchar' field was not found in /proc/1/io; found fields are {b'char': 14893668, ...}
Container called exit(1).
```

**Root Cause**: `psutil.Process().io_counters()` not available in Cloud Run's containerized environment.

**Solution**: Made performance monitor resilient to Cloud Run:
```python
# In backend/app/utils/performance_monitor.py
try:
    self.last_disk_io = self.process.io_counters()
except (ValueError, OSError) as e:
    logger.warning(f"Unable to initialize disk IO counters (common in containerized environments): {e}")
    self.last_disk_io = None

# Similar pattern for network IO and usage methods
if self.last_disk_io is not None:
    try:
        current_disk_io = self.process.io_counters()
        # ... calculate metrics
    except (ValueError, OSError):
        pass  # Graceful fallback
```

### 3. Cloud Run Environment Variables Syntax Issues

**Issue**: CORS_ORIGINS with comma-separated values failed deployment.

**Failed Attempts**:
```bash
# Direct command line - failed
--set-env-vars="CORS_ORIGINS=https://kotori.io,https://www.kotori.io"
# Error: Bad syntax for dict arg: [https://www.kotori.io]

# Multiple --set-env-vars flags - failed
--set-env-vars=CORS_ORIGINS="https://kotori.io,https://www.kotori.io"
# Same syntax error
```

**Solution**: Use environment variables file:
```yaml
# env-vars.yaml
ENVIRONMENT: production
DEBUG: "false"
ENABLE_SECRET_TAGS: "false"
CORS_ORIGINS: "https://kotori.io,https://www.kotori.io"
```
```bash
gcloud run services update kotori-api \
  --region=northamerica-northeast2 \
  --env-vars-file=env-vars.yaml
```

### 4. Cloud Run CPU/Concurrency Constraints

**Issue**: Frontend deployment failed with CPU constraint error.

**Error**:
```
ERROR: spec.template.spec.containers.resources.limits.cpu: Invalid value specified for cpu. 
Total cpu < 1 is not supported with concurrency > 1.
```

**Failed Configuration**:
```bash
--cpu=0.5 \
--concurrency=100
```

**Solution**: Use minimum 1 CPU for concurrency > 1:
```bash
--cpu=1 \
--concurrency=100
```

### 5. Frontend Build Context Issues

**Issue**: Docker build couldn't find `web-build` directory despite it existing locally.

**Root Cause**: `.dockerignore` was excluding build outputs, including the pre-built `web-build` directory needed for production.

**Failed Approach**: Multi-stage build with npm dependencies in container:
- Too slow (2+ minute builds)
- Environment variable issues with `dotenv/config`
- Complex dependency resolution

**Solution**: Pre-build locally and use simple nginx container:
```dockerfile
# Simple nginx-based frontend serving pre-built files
FROM nginx:alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy pre-built web assets
COPY build-output /usr/share/nginx/html
```

**Process**:
1. Build locally: `npx expo export:web`
2. Copy to `build-output` directory
3. Update `.dockerignore` to include build outputs
4. Use simple nginx container

### 6. Project ID Mismatches

**Issue**: Deployment scripts had hardcoded wrong project ID.

**Error Pattern**:
```bash
[FAIL] Please set the correct project: gcloud config set project kotori-prod
# But actual project was kotori-io
```

**Solution**: Updated all deployment scripts with correct project ID:
```bash
PROJECT_ID="kotori-io"  # Was kotori-prod
```

**Affected Files**:
- `deploy/verify-deployment.sh`
- `deploy/setup-monitoring.sh`
- `deploy/rollback.sh`
- `deploy/GENERATED_SECRETS.md`

### 7. Database Schema Initialization on Private Cloud SQL

**Issue**: Running historical Alembic migrations on a fresh DB took too long and sometimes stalled. Private-only Cloud SQL connectivity complicated job-based approaches.

**Solution (Pragmatic, fast for empty DB)**:
1. Temporarily enable Public IP on the Cloud SQL instance
2. Upload `create_tables.sql` to a GCS bucket
3. Grant the Cloud SQL service account read access to the bucket
4. Use `gcloud sql import sql` to execute the schema
5. Stamp Alembic to `head` via Cloud Run Job (`alembic -c alembic.ini stamp head`)
6. Disable Public IP to return to private-only posture

This created tables immediately and established a clean baseline. Future schema changes should use Alembic migrations and a Cloud Run Job with the Cloud SQL connector (Unix socket) to keep the DB fully private.

### 8. OPAQUE Registration Failing: `No such file or directory: 'node'`

**Issue**: OPAQUE flow uses Node.js `@serenity-kit/opaque` invoked via Python `subprocess` (`node -e ...`). The backend image lacked Node.

**Fix**:
- Install Node.js 18 and `@serenity-kit/opaque` inside the backend image (see `backend/Dockerfile`)
- Rebuild and redeploy `kotori-api`

**Result**: Registration succeeds using real OPAQUE protocol.

## Deployment Architecture

### Final Working Configuration

```
┌─────────────────────────────────────────────────────────────┐
│                    Google Cloud Project: kotori-io          │
├─────────────────────────────────────────────────────────────┤
│  Region: northamerica-northeast2                            │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   Cloud SQL     │  │   Cloud Run     │  │  Cloud Run   │ │
│  │                 │  │                 │  │              │ │
│  │   kotori-db     │◄─┤   kotori-api    │  │ kotori-web   │ │
│  │   PostgreSQL 17 │  │   (Backend)     │  │ (Frontend)   │ │
│  │   Custom Tier   │  │   Port: 8001    │  │ Port: 8080   │ │
│  │   Enterprise    │  │   1 CPU, 1Gi    │  │ 1 CPU, 512Mi │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
│           │                     │                    │      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ Secret Manager  │  │ Artifact Reg.   │  │   IAM        │ │
│  │                 │  │                 │  │              │ │
│  │ - DATABASE_URL  │  │ - kotori-api    │  │ kotori-api@  │ │
│  │ - SECRET_KEY    │  │ - kotori-web    │  │ service      │ │
│  │ - MASTER_SALT   │  │   images        │  │ account      │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘

External URLs:
├─ Backend API: https://kotori-api-412014849981.northamerica-northeast2.run.app
└─ Frontend:    https://kotori-web-412014849981.northamerica-northeast2.run.app
```

## Lessons Learned

### 1. Cloud SQL PostgreSQL 17 Requirements
- Always use `--edition=ENTERPRISE` with custom tiers
- Use `db-custom-X-Y` format for CPU/memory specification
- Test tier combinations in development first

### 2. Cloud Run Environment Compatibility
- Test psutil and system-level libraries in containerized environments
- Implement graceful fallbacks for system monitoring
- Use environment variable files for complex configurations

### 3. Container Build Optimization
- Pre-build static assets locally for faster deployments
- Use simple base images (nginx) for static content serving
- Carefully manage `.dockerignore` for build context

### 4. Deployment Script Management
- Use variables for project IDs and regions
- Implement idempotent scripts with `|| true` patterns
- Test all scripts in clean environments

### 5. Documentation During Development
- Document issues immediately when encountered
- Capture exact error messages and solutions
- Maintain troubleshooting guides for complex deployments

## Quick Recovery Commands

### Redeploy Backend
```bash
cd /home/ai/src/kotori
gcloud builds submit --tag northamerica-northeast2-docker.pkg.dev/kotori-io/kotori-images/kotori-api:latest backend/
gcloud run deploy kotori-api --image=northamerica-northeast2-docker.pkg.dev/kotori-io/kotori-images/kotori-api:latest --region=northamerica-northeast2
```

### Redeploy Frontend
```bash
cd /home/ai/src/kotori/frontend
npx expo export:web
cp -r web-build/* build-output/
cd /home/ai/src/kotori
gcloud builds submit --tag northamerica-northeast2-docker.pkg.dev/kotori-io/kotori-images/kotori-web:latest frontend/
gcloud run deploy kotori-web --image=northamerica-northeast2-docker.pkg.dev/kotori-io/kotori-images/kotori-web:latest --region=northamerica-northeast2
```

### Check Service Status
```bash
gcloud run services list --region=northamerica-northeast2
gcloud sql instances list
gcloud secrets list
```

This troubleshooting guide should help future deployments avoid the same pitfalls and provide quick solutions to common issues.
