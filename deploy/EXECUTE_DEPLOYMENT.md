# 🚀 Kotori GCP Deployment - Execution Guide

## ⚡ Quick Start (Automated Deployment)

**For immediate deployment, run this single command:**

```bash
cd /home/ai/src/kotori/deploy
./gcp-setup.sh
```

This will automatically provision all GCP infrastructure and deploy Kotori to production.

## 📋 Pre-Deployment Checklist

Before running the deployment, ensure:

- [ ] Google Cloud account with billing enabled
- [ ] `gcloud` CLI installed and authenticated (`gcloud auth login`)
- [ ] Project created: `kotori-prod` 
- [ ] Domain `kotori.io` ownership verified in Google Domains/DNS
- [ ] Required permissions: Project Owner or Editor + Security Admin

### Verify Prerequisites

```bash
# Check authentication
gcloud auth list

# Check project
gcloud config get-value project

# Set project if needed
gcloud config set project kotori-prod

# Verify billing
gcloud billing projects describe kotori-prod
```

## 🎯 Deployment Execution Steps

### Step 1: Run Automated Deployment

```bash
cd /home/ai/src/kotori/deploy
chmod +x gcp-setup.sh
./gcp-setup.sh
```

**What this does:**
- Enables all required GCP APIs
- Creates service account with least-privilege permissions
- Provisions Cloud SQL PostgreSQL 17 instance
- Generates and stores secure secrets in Secret Manager
- Builds and pushes container image to Artifact Registry
- Deploys to Cloud Run with auto-scaling
- Configures custom domain mapping
- Runs database migrations
- Performs initial health checks

**Expected Duration:** 15-20 minutes

### Step 2: Configure DNS (Manual Step Required)

After deployment, you'll see DNS configuration instructions. Add these records to your DNS provider:

```
# Example DNS records (actual values will be provided by the script)
api.kotori.io.  CNAME  ghs.googlehosted.com.
```

### Step 3: Verify Deployment

```bash
cd /home/ai/src/kotori/deploy
./verify-deployment.sh
```

This comprehensive test suite verifies:
- Cloud Run service health
- Database connectivity
- Secret Manager configuration
- API endpoint accessibility
- Performance benchmarks

### Step 4: Set Up Monitoring (Optional but Recommended)

```bash
cd /home/ai/src/kotori/deploy
./setup-monitoring.sh
```

**Before running:** Update the notification email in the script!

## 🔐 Generated Secrets

The deployment automatically generates these secure secrets:

| Secret | Purpose | Storage |
|--------|---------|---------|
| SECRET_KEY | JWT signing (64 chars) | Secret Manager |
| ENCRYPTION_MASTER_SALT | Per-user encryption (64 chars) | Secret Manager |
| Database Password | PostgreSQL access (32 chars) | Secret Manager |

**⚠️ IMPORTANT:** These secrets are saved in `deploy/GENERATED_SECRETS.md` - store this file securely and never commit to git!

## 📊 Post-Deployment Validation

### Health Check
```bash
curl https://api.kotori.io/api/health
# Expected: {"status": "healthy", "environment": "production"}
```

### Performance Test
```bash
# Response time test
time curl -s https://api.kotori.io/api/health > /dev/null
```

### Log Verification
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=kotori-api" --limit=10
```

## 🔄 CI/CD Setup (Optional)

To enable automated deployments on code changes:

1. **Connect GitHub Repository:**
```bash
gcloud builds triggers create github \
    --repo-name=kotori \
    --repo-owner=your-github-username \
    --branch-pattern="^main$" \
    --build-config=cloudbuild.yaml
```

2. **Manual Deployment:**
```bash
gcloud builds submit --config=cloudbuild.yaml
```

## 🆘 Emergency Procedures

### Quick Rollback
```bash
cd /home/ai/src/kotori/deploy
./rollback.sh emergency
```

### Service Status
```bash
cd /home/ai/src/kotori/deploy
./rollback.sh status
```

### View Recent Logs
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=kotori-api" --limit=50
```

## 🔧 Common Issues & Solutions

### Issue: DNS Not Resolving
**Solution:** DNS propagation can take up to 24 hours. Verify records are correctly configured.

### Issue: Health Check Fails
**Solutions:**
1. Check service logs: `gcloud run services logs read kotori-api`
2. Verify database connectivity
3. Wait 5-10 minutes for service warmup

### Issue: Database Connection Errors
**Solutions:**
1. Verify Cloud SQL instance is running
2. Check service account permissions
3. Validate DATABASE_URL secret format

### Issue: Speech-to-Text Not Working
**Solutions:**
1. Verify Speech-to-Text API is enabled
2. Check service account has `roles/speech.client`
3. Test with sample audio data

## 📈 Scaling Configuration

### Current Settings
- **Min Instances:** 1 (always warm)
- **Max Instances:** 10
- **Memory:** 1Gi per instance
- **CPU:** 1 vCPU per instance
- **Concurrency:** 100 requests per instance

### Modify Scaling
```bash
gcloud run services update kotori-api \
    --min-instances=2 \
    --max-instances=20 \
    --region=northamerica-northeast2
```

## 🎯 Success Criteria

Deployment is successful when:

- [ ] `./verify-deployment.sh` passes all tests
- [ ] Health endpoint returns 200 OK
- [ ] Custom domain accessible (after DNS setup)
- [ ] Database migrations completed
- [ ] All secrets properly configured
- [ ] Monitoring alerts configured
- [ ] Performance meets benchmarks (<2s response time)

## 📞 Support Information

### Documentation
- **Full Deployment Guide:** `deploy/README.md`
- **Monitoring Setup:** `deploy/setup-monitoring.sh`
- **Rollback Procedures:** `deploy/rollback.sh`
- **Deployment Summary:** `deploy/DEPLOYMENT_SUMMARY.md`

### Useful Commands
```bash
# Service status
gcloud run services describe kotori-api --region=northamerica-northeast2

# Database status
gcloud sql instances describe kotori-db

# View secrets
gcloud secrets list

# Recent deployments
gcloud run revisions list --service=kotori-api --region=northamerica-northeast2
```

### Monitoring URLs
- **Cloud Console:** https://console.cloud.google.com/run/detail/northamerica-northeast2/kotori-api
- **Logs:** https://console.cloud.google.com/logs/query
- **Monitoring:** https://console.cloud.google.com/monitoring

## 🎉 Completion

After successful deployment:

1. **Save Secrets:** Securely store `deploy/GENERATED_SECRETS.md`
2. **Configure DNS:** Add provided DNS records to your domain
3. **Test Thoroughly:** Run comprehensive user acceptance tests
4. **Set Up Monitoring:** Configure alerts and dashboards
5. **Document:** Update team documentation with production details
6. **Train Team:** Ensure team knows operational procedures

---

**🚀 Ready to deploy Kotori to production!**

Run `./gcp-setup.sh` when ready to begin.
