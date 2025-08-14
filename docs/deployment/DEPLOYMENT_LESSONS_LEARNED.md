# Deployment Lessons Learned

This document captures important lessons learned from deployment troubleshooting to prevent future issues.

## 🔧 Critical Configuration Issues

### Environment Variable Naming Convention

**Issue**: Backend container failed to start because environment variables were not properly mapped.

**Root Cause**: Mismatch between:
- **Backend Code Expects**: Uppercase environment variables (`DATABASE_URL`, `SECRET_KEY`)
- **Google Cloud Secrets**: Lowercase with hyphens (`database-url`, `secret-key`)
- **Cloud Run Mapping**: Must map correctly: `DATABASE_URL=database-url:latest`

**Solution**: Use proper mapping in deployment commands:
```bash
--set-secrets "DATABASE_URL=database-url:latest,SECRET_KEY=secret-key:latest,..."
```

### Required Secrets for Backend

**Complete list of required secrets** for backend deployment:

```bash
--set-secrets "DATABASE_URL=database-url:latest,SECRET_KEY=secret-key:latest,GOOGLE_CLOUD_PROJECT=google-cloud-project:latest,GOOGLE_CLOUD_LOCATION=google-cloud-location:latest,ENCRYPTION_MASTER_SALT=encryption-master-salt:latest"
```

**Missing any of these secrets will cause container startup failure.**

## 🚨 Common Deployment Failures

### 1. Container Failed to Start
**Symptoms**: 
- `ERROR: Required environment variable 'DATABASE_URL' is not set in .env file`
- `Container called exit(1)`
- `Default STARTUP TCP probe failed`

**Debugging Steps**:
1. Check logs: `gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=kotori-api"`
2. Verify secret mapping in deployment command
3. Confirm all required secrets exist: `gcloud secrets list`

### 2. Service Account Issues
**Symptoms**:
- Authentication errors in backend logs
- Google Cloud API failures

**Solution**:
- Ensure service account has proper permissions
- Verify service account is attached to Cloud Run service
- Check that all Google Cloud secrets are accessible

## 📋 Pre-Deployment Checklist

### Before Running Deployment Script

- [ ] **Verify Project**: `gcloud config get-value project` shows `kotori-io`
- [ ] **Check Secrets**: All required secrets exist with `gcloud secrets list`
- [ ] **Test Local Build**: Backend starts successfully locally
- [ ] **Environment File**: `deploy/production-env.yaml` is up to date
- [ ] **Git Status**: All changes committed and pushed

### After Deployment

- [ ] **Health Check**: `curl https://kotori-api-412014849981.us-central1.run.app/api/health`
- [ ] **Service Status**: `gcloud run services list --region=us-central1`
- [ ] **Logs Check**: No error logs in Cloud Run logs
- [ ] **Frontend Test**: App loads at production URL
- [ ] **Backend Test**: API endpoints respond correctly

## 🔍 Troubleshooting Commands

### Check Current Deployment Status
```bash
# List services and their revisions
gcloud run services list --region=us-central1

# Check which revision is serving traffic
gcloud run services describe kotori-api --region=us-central1 --format="value(status.traffic[0].revisionName)"

# List recent revisions
gcloud run revisions list --service=kotori-api --region=us-central1 --limit=5
```

### Debug Failed Deployments
```bash
# Check logs for failed revision
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=kotori-api AND resource.labels.revision_name=REVISION_NAME" --limit=20

# Export working configuration for comparison
gcloud run services describe kotori-api --region=us-central1 --format="export" > current-config.yaml
```

### Verify Environment Configuration
```bash
# Check what secrets are available
gcloud secrets list

# Check current service configuration
gcloud run services describe kotori-api --region=us-central1 --format="value(spec.template.spec.containers[0].env[].name)"
```

## 📚 Key Learnings

1. **Environment Variable Mapping is Critical**: Always verify the exact mapping between Cloud Run environment variables and Google Cloud secrets.

2. **Service Account Changes Require Full Secret Review**: When changing service accounts, review all required secrets and their accessibility.

3. **Incremental Deployment Strategy**: Deploy frontend first (simpler), then debug backend issues separately.

4. **Log Analysis is Essential**: Cloud Run logs provide the exact error messages needed to diagnose startup failures.

5. **Working Configuration as Reference**: Always export and save working configurations before making changes.

## 🚀 Successful Deployment Pattern

The deployment script should follow this pattern:

1. **Build Images**: Use Cloud Build to create Docker images
2. **Deploy Frontend**: Simple deployment with minimal configuration
3. **Deploy Backend**: Complex deployment with all secrets and environment variables
4. **Health Checks**: Verify both services are responding
5. **Rollback Plan**: Keep previous working revision available

## 📝 Documentation Updates

This experience highlights the need to:
- Keep deployment documentation current with actual working configurations
- Document all required secrets and their purposes
- Maintain troubleshooting guides with real examples
- Update deployment scripts when service account or secret configurations change

## 🔗 Related Files

- [`scripts/cloud-deploy.sh`](../../scripts/cloud-deploy.sh) - Main deployment script
- [`deploy/production-env.yaml`](../../deploy/production-env.yaml) - Environment variables
- [`docs/deployment/DEPLOYMENT_TROUBLESHOOTING.md`](./DEPLOYMENT_TROUBLESHOOTING.md) - Troubleshooting guide
