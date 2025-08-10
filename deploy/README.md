# Kotori GCP Deployment Guide

This guide provides step-by-step instructions for deploying the Kotori voice journaling application to Google Cloud Platform.

## 🏗️ Architecture Overview

Kotori is deployed using the following GCP services:

- **Cloud Run**: Hosts the FastAPI backend with auto-scaling
- **Cloud SQL**: PostgreSQL 17 database with high availability
- **Secret Manager**: Secure storage for sensitive configuration
- **Artifact Registry**: Container image storage
- **Cloud Build**: CI/CD pipeline for automated deployments
- **Certificate Manager**: TLS certificates for custom domain
- **Speech-to-Text API**: Voice transcription service
- **Cloud Logging & Monitoring**: Observability and alerting

## 📋 Prerequisites

### 1. Google Cloud Setup
- Google Cloud account with billing enabled
- Domain ownership verified for `kotori.io`
- `gcloud` CLI installed and authenticated
- Project created: `kotori-prod`

### 2. Local Requirements
- Docker installed (for local testing)
- `curl` command available
- `openssl` for secret generation

### 3. Authentication
```bash
# Authenticate with Google Cloud
gcloud auth login

# Set application default credentials
gcloud auth application-default login

# Verify authentication
gcloud auth list
```

## 🚀 Deployment Instructions

### Option 1: Automated Deployment (Recommended)

Run the automated deployment script:

```bash
cd deploy
chmod +x gcp-setup.sh
./gcp-setup.sh
```

The script will:
1. Enable all required GCP APIs
2. Create service accounts and IAM roles
3. Provision Cloud SQL PostgreSQL 17
4. Generate and store secure secrets
5. Build and deploy the container
6. Configure custom domain and TLS
7. Run database migrations
8. Perform health checks

### Option 2: Manual Deployment

If you prefer manual control, follow these steps:

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
gcloud projects add-iam-policy-binding kotori-prod \
    --member="serviceAccount:kotori-api@kotori-prod.iam.gserviceaccount.com" \
    --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding kotori-prod \
    --member="serviceAccount:kotori-api@kotori-prod.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding kotori-prod \
    --member="serviceAccount:kotori-api@kotori-prod.iam.gserviceaccount.com" \
    --role="roles/speech.client"
```

#### Step 3: Create Cloud SQL Instance
```bash
# Create PostgreSQL 17 instance
gcloud sql instances create kotori-db \
    --database-version=POSTGRES_17 \
    --tier=db-f1-micro \
    --region=northamerica-northeast2 \
    --storage-type=SSD \
    --storage-size=20GB \
    --storage-auto-increase \
    --backup-start-time=03:00 \
    --backup-location=northamerica-northeast2 \
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
echo -n "kotori-prod" | gcloud secrets create google-cloud-project --data-file=-
echo -n "northamerica-northeast2" | gcloud secrets create google-cloud-location --data-file=-
```

#### Step 5: Build and Deploy
```bash
# Create Artifact Registry repository
gcloud artifacts repositories create kotori-images \
    --repository-format=docker \
    --location=northamerica-northeast2

# Build and push image
gcloud builds submit ../backend \
    --tag northamerica-northeast2-docker.pkg.dev/kotori-prod/kotori-images/kotori-api:latest \
    --region=northamerica-northeast2

# Deploy to Cloud Run
gcloud run deploy kotori-api \
    --image=northamerica-northeast2-docker.pkg.dev/kotori-prod/kotori-images/kotori-api:latest \
    --platform=managed \
    --region=northamerica-northeast2 \
    --service-account=kotori-api@kotori-prod.iam.gserviceaccount.com \
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

## 🔧 Configuration

### Environment Variables

The following environment variables are configured via Secret Manager:

| Variable | Description | Source |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Generated |
| `SECRET_KEY` | JWT signing key (64 chars) | Generated |
| `ENCRYPTION_MASTER_SALT` | Per-user encryption salt (64 chars) | Generated |
| `GOOGLE_CLOUD_PROJECT` | Project ID | `kotori-prod` |
| `GOOGLE_CLOUD_LOCATION` | Region | `northamerica-northeast2` |
| `ENVIRONMENT` | Runtime environment | `production` |
| `DEBUG` | Debug mode | `false` |
| `ENABLE_SECRET_TAGS` | Feature flag | `false` |
| `CORS_ORIGINS` | Allowed origins | `https://kotori.io,https://www.kotori.io` |

### Custom Domain Setup

1. **Create domain mapping**:
```bash
gcloud run domain-mappings create \
    --service=kotori-api \
    --domain=api.kotori.io \
    --region=northamerica-northeast2
```

2. **Configure DNS records**:
Get the required DNS configuration:
```bash
gcloud run domain-mappings describe api.kotori.io \
    --region=northamerica-northeast2 \
    --format="table(status.resourceRecords[].name,status.resourceRecords[].rrdata)"
```

3. **Add DNS records** to your domain provider:
   - Add the CNAME record as shown in the output
   - Wait for DNS propagation (can take up to 24 hours)

## 🔍 Verification

### Health Check
```bash
curl https://api.kotori.io/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "environment": "production"
}
```

### Database Connectivity
```bash
# Check Cloud SQL instance
gcloud sql instances describe kotori-db

# Test database connection from Cloud Run
gcloud run services logs read kotori-api --region=northamerica-northeast2
```

### Speech-to-Text API
Test the transcription endpoint with sample audio data.

## 🔐 Security Configuration

### Service Account Permissions

The `kotori-api@kotori-prod.iam.gserviceaccount.com` service account has the following roles:

- `roles/cloudsql.client` - Cloud SQL database access
- `roles/secretmanager.secretAccessor` - Secret Manager read access
- `roles/speech.client` - Speech-to-Text API access
- `roles/storage.objectAdmin` - Cloud Storage access (if needed)
- `roles/logging.logWriter` - Cloud Logging
- `roles/monitoring.metricWriter` - Cloud Monitoring

### Network Security

- Cloud SQL instance uses private IP
- All secrets stored in Secret Manager
- TLS termination at Cloud Run
- CORS configured for specific origins

### Data Protection

- Zero-knowledge architecture: server never sees plaintext content
- OPAQUE authentication: password-less auth protocol
- Client-side encryption with per-user keys
- Encrypted database connections

## 📊 Monitoring & Logging

### Cloud Logging
View application logs:
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=kotori-api" --limit=50 --format=json
```

### Cloud Monitoring
Set up alerts for:
- Service availability (uptime checks)
- Response latency
- Error rates
- Database connection health
- Memory and CPU usage

### Health Monitoring
```bash
# Create uptime check
gcloud alpha monitoring uptime create-http-check \
    --display-name="Kotori API Health Check" \
    --hostname="api.kotori.io" \
    --path="/api/health" \
    --port=443 \
    --use-ssl
```

## 🔄 CI/CD Pipeline

### Cloud Build Setup
1. **Connect repository**:
```bash
gcloud builds triggers create github \
    --repo-name=kotori \
    --repo-owner=your-github-username \
    --branch-pattern="^main$" \
    --build-config=cloudbuild.yaml
```

2. **Manual deployment**:
```bash
gcloud builds submit --config=cloudbuild.yaml
```

### Deployment Process
1. Code push to `main` branch
2. Cloud Build triggers automatically
3. Docker image built and pushed to Artifact Registry
4. Database migrations run (if needed)
5. New version deployed to Cloud Run
6. Health checks performed
7. Traffic switched to new version

## 🔧 Troubleshooting

### Common Issues

#### 1. Health Check Fails
```bash
# Check service logs
gcloud run services logs read kotori-api --region=northamerica-northeast2 --limit=50

# Check service status
gcloud run services describe kotori-api --region=northamerica-northeast2
```

#### 2. Database Connection Issues
```bash
# Check Cloud SQL instance status
gcloud sql instances describe kotori-db

# Verify secret values
gcloud secrets versions access latest --secret=database-url
```

#### 3. Speech-to-Text API Issues
```bash
# Check service account permissions
gcloud projects get-iam-policy kotori-prod \
    --flatten="bindings[].members" \
    --format="table(bindings.role)" \
    --filter="bindings.members:kotori-api@kotori-prod.iam.gserviceaccount.com"
```

#### 4. Domain/SSL Issues
```bash
# Check domain mapping status
gcloud run domain-mappings describe api.kotori.io --region=northamerica-northeast2

# Verify DNS configuration
nslookup api.kotori.io
```

### Debug Commands
```bash
# Get service URL
gcloud run services describe kotori-api --region=northamerica-northeast2 --format="value(status.url)"

# Check recent deployments
gcloud run revisions list --service=kotori-api --region=northamerica-northeast2

# View service configuration
gcloud run services describe kotori-api --region=northamerica-northeast2 --format=export
```

## 🔄 Rollback Procedures

### Quick Rollback
```bash
# List recent revisions
gcloud run revisions list --service=kotori-api --region=northamerica-northeast2

# Rollback to previous revision
gcloud run services update-traffic kotori-api \
    --to-revisions=PREVIOUS_REVISION=100 \
    --region=northamerica-northeast2
```

### Database Rollback
```bash
# List database backups
gcloud sql backups list --instance=kotori-db

# Restore from backup (creates new instance)
gcloud sql backups restore BACKUP_ID \
    --restore-instance=kotori-db-restored \
    --backup-instance=kotori-db
```

## 💾 Backup & Disaster Recovery

### Automated Backups
- **Database**: Daily backups at 3:00 AM UTC, 7-day retention
- **Container Images**: Stored in Artifact Registry with versioning
- **Secrets**: Versioned in Secret Manager

### Manual Backup
```bash
# Export database
gcloud sql export sql kotori-db gs://kotori-backups/manual-backup-$(date +%Y%m%d).sql \
    --database=kotori_prod

# Backup secrets
gcloud secrets versions list secret-key
gcloud secrets versions list encryption-master-salt
gcloud secrets versions list database-url
```

## 📈 Scaling Configuration

### Auto Scaling
- **Min instances**: 1 (always warm)
- **Max instances**: 10
- **CPU threshold**: 80%
- **Memory threshold**: 80%
- **Concurrency**: 100 requests per instance

### Manual Scaling
```bash
# Update scaling configuration
gcloud run services update kotori-api \
    --min-instances=2 \
    --max-instances=20 \
    --region=northamerica-northeast2
```

## 🔗 Related Resources

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud SQL for PostgreSQL](https://cloud.google.com/sql/docs/postgres)
- [Secret Manager](https://cloud.google.com/secret-manager/docs)
- [Speech-to-Text API](https://cloud.google.com/speech-to-text/docs)
- [Certificate Manager](https://cloud.google.com/certificate-manager/docs)

## 📞 Support

For deployment issues:
1. Check the troubleshooting section above
2. Review Cloud Logging for error details
3. Verify all prerequisites are met
4. Contact the development team with specific error messages
