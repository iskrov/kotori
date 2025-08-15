# Kotori GCP Deployment Configs

This directory contains configuration files and utilities for deploying Kotori to Google Cloud Platform.

## 🚀 Quick Start

For deployment, use the main orchestrator script:

```bash
# Full deployment (migrations + frontend + backend)
./scripts/cloud-deploy.sh --yes

# Migrations only
./scripts/cloud-deploy.sh --migrations-only --yes
```

See [deployment docs](../docs/deployment/README.md) for complete instructions.

## 📁 Files in this Directory

### Configuration Files
- `run-migrations.yaml` - Cloud Build config for database migrations (used by `scripts/cloud-deploy.sh`)
- `production-env.yaml` - Runtime environment variables for Cloud Run services
- `production-env-vars.yaml` - Alternative env format (used by some utilities)
- `production.env.template` - Template for environment variables

### Utilities & Scripts
- `gcp-setup.sh` - Initial GCP infrastructure provisioning (one-time setup)
- `verify-deployment.sh` - Post-deployment verification tests
- `rollback.sh` - Emergency rollback procedures
- `setup-monitoring.sh` - Monitoring and alerting setup

### Documentation
- `GENERATED_SECRETS.md` - Production secrets (generated, not in git)

## 🏗️ Current Architecture

- **Project**: `kotori-io`
- **Region**: `us-central1`
- **Services**: Cloud Run (kotori-api, kotori-app)
- **Database**: Cloud SQL PostgreSQL 17 (kotori-db)
- **Migrations**: Cloud Build Private Pool + Secret Manager
- **Images**: Artifact Registry (`us-central1-docker.pkg.dev/kotori-io/kotori-images`)

## 🔧 Manual Operations (Advanced)

For manual deployment steps:

#### Step 1: Enable APIs
```bash
gcloud services enable \
    run.googleapis.com \
    sql-component.googleapis.com \
    sqladmin.googleapis.com \
    secretmanager.googleapis.com \
    storage.googleapis.com \
    speech.googleapis.com \
    certificatemanager.googleapis.com \
    cloudbuild.googleapis.com \
    artifactregistry.googleapis.com \
    logging.googleapis.com \
    monitoring.googleapis.com \
    compute.googleapis.com \
    servicenetworking.googleapis.com \
    vpcaccess.googleapis.com
```

#### Step 2: Create Service Account
```bash
# Create service account
gcloud iam service-accounts create kotori-api \
    --description="Service account for Kotori API backend" \
    --display-name="Kotori API Service Account"

# Grant roles
gcloud projects add-iam-policy-binding kotori-io \
    --member="serviceAccount:kotori-api@kotori-io.iam.gserviceaccount.com" \
    --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding kotori-io \
    --member="serviceAccount:kotori-api@kotori-io.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding kotori-io \
    --member="serviceAccount:kotori-api@kotori-io.iam.gserviceaccount.com" \
    --role="roles/speech.client"
```

#### Step 3: Create Cloud SQL Instance
```bash
# Create PostgreSQL 17 instance
gcloud sql instances create kotori-db \
    --database-version=POSTGRES_17 \
    --tier=db-f1-micro \
    --region=us-central1 \
    --storage-type=SSD \
    --storage-size=20GB \
    --storage-auto-increase \
    --backup-start-time=03:00 \
    --backup-location=us-central1 \
    --retained-backups-count=7 \
    --enable-bin-log \
    --maintenance-window-day=SUN \
    --maintenance-window-hour=04 \
    --maintenance-release-channel=production \
    --deletion-protection

# Create database and user
gcloud sql databases create kotori_prod --instance=kotori-db
gcloud sql users create kotori_user --instance=kotori-db --password=YOUR_SECURE_PASSWORD
```

#### Step 4: Store Secrets
```bash
# Generate secrets (save these securely!)
SECRET_KEY=$(openssl rand -hex 32)
ENCRYPTION_MASTER_SALT=$(openssl rand -hex 32)
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)

# Store in Secret Manager
echo -n "postgresql://kotori_user:${DB_PASSWORD}@PRIVATE_IP:5432/kotori_prod" | \
    gcloud secrets create database-url --data-file=-

echo -n "${SECRET_KEY}" | gcloud secrets create secret-key --data-file=-
echo -n "${ENCRYPTION_MASTER_SALT}" | gcloud secrets create encryption-master-salt --data-file=-
echo -n "kotori-io" | gcloud secrets create google-cloud-project --data-file=-
echo -n "us-central1" | gcloud secrets create google-cloud-location --data-file=-
```

#### Step 5: Build and Deploy
```bash
# Create Artifact Registry repository
gcloud artifacts repositories create kotori-images \
    --repository-format=docker \
    --location=us-central1

# Build and push image
gcloud builds submit ../backend \
    --tag us-central1-docker.pkg.dev/kotori-io/kotori-images/kotori-api:latest \
    --region=us-central1

# Deploy to Cloud Run
gcloud run deploy kotori-api \
    --image=us-central1-docker.pkg.dev/kotori-io/kotori-images/kotori-api:latest \
    --platform=managed \
    --region=us-central1 \
    --service-account=kotori-api@kotori-io.iam.gserviceaccount.com \
    --set-env-vars="ENVIRONMENT=production,DEBUG=false,ENABLE_SECRET_TAGS=false,PORT=8001,CORS_ORIGINS=https://kotori.io,https://www.kotori.io" \
    --set-secrets="DATABASE_URL=database-url:latest,SECRET_KEY=secret-key:latest,ENCRYPTION_MASTER_SALT=encryption-master-salt:latest,GOOGLE_CLOUD_PROJECT=google-cloud-project:latest,GOOGLE_CLOUD_LOCATION=google-cloud-location:latest" \
    --allow-unauthenticated \
    --min-instances=1 \
    --max-instances=10 \
    --memory=1Gi \
    --cpu=1 \
    --concurrency=100 \
    --timeout=300 \
    --port=8001
```

## 📚 Documentation

For complete deployment instructions, troubleshooting, and migration procedures, see:
- [Deployment Documentation](../docs/deployment/README.md)
- [Database Migration Strategy](../docs/deployment/DATABASE_MIGRATION_STRATEGY.md)
- [Deployment Troubleshooting](../docs/deployment/DEPLOYMENT_TROUBLESHOOTING.md)