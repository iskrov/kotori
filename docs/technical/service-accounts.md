# Service Account Management - Kotori Project

## 🎯 Overview

This document describes the service account architecture for the Kotori application, including authentication methods, permissions, and usage across different GCP services.

## 📊 Current Service Account Architecture

### Production Service Account

**`kotori-api@kotori-io.iam.gserviceaccount.com`** - Primary application service account

#### Purpose
- Cloud Run service execution
- API authentication for all GCP services
- Application Default Credentials (ADC) provider

#### Current Permissions (Least Privilege)
- `roles/aiplatform.user` - Vertex AI Gemini model access
- `roles/speech.client` - Speech-to-Text API access  
- `roles/cloudsql.client` - Database connectivity
- `roles/secretmanager.secretAccessor` - Configuration secrets access
- `roles/logging.logWriter` - Application logging
- `roles/monitoring.metricWriter` - Metrics collection
- `roles/aiplatform.serviceAgent` - Vertex AI service agent (auto-granted)

#### Usage Across Services
1. **Cloud Run**: Service account for `kotori-api` service
2. **Speech-to-Text**: Authentication via ADC
3. **Vertex AI Gemini**: Authentication via ADC
4. **Cloud SQL**: Database connection authentication
5. **Secret Manager**: Access to application secrets

### System Service Accounts (Auto-managed by GCP)

**`412014849981-compute@developer.gserviceaccount.com`** - Default compute service account
- Auto-created by Google Cloud
- Used for various GCP services
- Not directly managed by our application

## 🔐 Authentication Methods by Function

### 1. 🎤 Speech-to-Text (Recording Screen)
- **Service Account**: `kotori-api@kotori-io.iam.gserviceaccount.com`
- **Authentication Method**: Application Default Credentials (ADC)
- **Required Permission**: `roles/speech.client`
- **Code Location**: `backend/app/services/speech_service.py`

### 2. 🤖 Share Generation (Gemini AI)
- **Service Account**: `kotori-api@kotori-io.iam.gserviceaccount.com`
- **Authentication Method**: Application Default Credentials (ADC)
- **Required Permission**: `roles/aiplatform.user`
- **Code Location**: `backend/app/services/gemini_service.py`

### 3. 🚀 GCP Deployment
- **Authentication Method**: User account (`gcloud auth login`)
- **Service Account**: Uses deployment script with user credentials
- **Required Permissions**: Project owner/editor for deployment operations
- **Code Location**: `scripts/cloud-deploy.sh`

### 4. 🔒 OAuth Authentication
- **Service Account**: `kotori-api@kotori-io.iam.gserviceaccount.com`
- **Authentication Method**: Application Default Credentials (ADC)
- **Required Permission**: No specific GCP permissions (uses OAuth 2.0 flow)
- **Code Location**: `backend/app/services/auth_service.py`

### 5. 🗃️ Database Migrations
- **Service Account**: Cloud Build service account (`412014849981@cloudbuild.gserviceaccount.com`)
- **Authentication Method**: Secret Manager injection via Cloud Build
- **Required Permissions**: `roles/cloudsql.client`, `roles/secretmanager.secretAccessor`
- **Code Location**: `deploy/run-migrations.yaml`

## 🧹 Recent Cleanup (August 2025)

### Removed Service Accounts
- ❌ `kotori-sa@kotori-io.iam.gserviceaccount.com` - Deleted (was unused)
- ❌ `kotori-vertex-sa@kotori-io.iam.gserviceaccount.com` - Deleted (was unused)

### Removed Secrets
- ❌ `google-application-credentials` - Deleted (replaced with ADC)

### Revoked Excessive Permissions
- ❌ `roles/aiplatform.admin` - Revoked (too broad)
- ❌ `roles/ml.admin` - Revoked (too broad)
- ❌ `roles/ml.developer` - Revoked (redundant with aiplatform.user)
- ❌ `roles/storage.objectAdmin` - Revoked (not using Cloud Storage)

## 🔧 Production Deployment Configuration

### Cloud Run Service Configuration
```yaml
# deploy/production-env.yaml
# No GOOGLE_APPLICATION_CREDENTIALS needed - uses ADC
CORS_ORIGINS: "https://app.kotori.io,https://kotori.io,http://localhost:19000,http://localhost:19006"
LOG_LEVEL: "INFO"
NODE_ENV: "production"
SAVE_TRANSCRIBE_UPLOADS: "0"
ENVIRONMENT: "production"
```

### Cloud Run Deployment Command
```bash
gcloud run deploy kotori-api \
  --image us-central1-docker.pkg.dev/kotori-io/kotori-images/kotori-api:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8001 \
  --memory 1Gi \
  --cpu 1 \
  --max-instances 10 \
  --env-vars-file deploy/production-env.yaml \
  --update-secrets "DATABASE_URL=database-url:latest,SECRET_KEY=secret-key:latest,GOOGLE_CLOUD_PROJECT=google-cloud-project:latest,GOOGLE_CLOUD_LOCATION=google-cloud-location:latest,ENCRYPTION_MASTER_SALT=encryption-master-salt:latest" \
  --service-account kotori-api@kotori-io.iam.gserviceaccount.com \
  --project kotori-io
```

## 🔍 Verification Commands

### Check Service Account Status
```bash
# List all service accounts
gcloud iam service-accounts list --project=kotori-io

# Check permissions for kotori-api
gcloud projects get-iam-policy kotori-io \
  --flatten="bindings[].members" \
  --filter="bindings.members:kotori-api@kotori-io.iam.gserviceaccount.com"
```

### Test Authentication
```bash
# Check Cloud Run service account configuration
gcloud run services describe kotori-api \
  --region=us-central1 \
  --project=kotori-io \
  --format="value(spec.template.spec.serviceAccountName)"

# Test API health (should show successful Gemini initialization)
curl -f https://kotori-api-412014849981.us-central1.run.app/api/health
```

## 🚨 Security Best Practices

### Production
1. **Use ADC**: Never use service account key files in production
2. **Least Privilege**: Only grant minimum required permissions
3. **Regular Audits**: Review permissions quarterly
4. **Monitor Usage**: Track service account activity

### Development
1. **Temporary Keys**: Delete service account keys after development
2. **Local Only**: Never commit service account keys
3. **Key Rotation**: Regenerate keys regularly
4. **Scope Limitation**: Use minimal permissions for development

## 📋 Maintenance Checklist

### Monthly Review
- [ ] Verify service account permissions are still minimal
- [ ] Check for unused service accounts
- [ ] Review access logs for anomalies
- [ ] Confirm ADC is working in production

### Before Major Deployments
- [ ] Verify service account has required permissions
- [ ] Test ADC functionality in staging
- [ ] Confirm no hardcoded credentials in code
- [ ] Review Cloud Run service account configuration

---

**Last Updated**: August 17, 2025  
**Maintained By**: Development Team  
**Review Schedule**: Monthly
