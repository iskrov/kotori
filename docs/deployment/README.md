# Kotori Deployment Documentation

This directory contains comprehensive documentation for deploying and managing Kotori on Google Cloud Platform.

## 📚 Documentation Index

### 🚀 Deployment Guides
- **[Deployment Script](../../scripts/cloud-deploy.sh)** - Automated deployment script for frontend and backend
- **[Production Environment](../../deploy/production-env.yaml)** - Environment variables configuration

### 🔧 Troubleshooting & Issues
- **[Deployment Troubleshooting](./DEPLOYMENT_TROUBLESHOOTING.md)** - Comprehensive troubleshooting guide for all deployment issues
- **[Deployment Lessons Learned](./DEPLOYMENT_LESSONS_LEARNED.md)** - Key lessons and best practices from deployment experiences

### 📊 Deployment History
- **[Sharing Feature Deployment Success](./SHARING_FEATURE_DEPLOYMENT_SUCCESS.md)** - August 14, 2025 - Template-based sharing with AI
- **[Redeployment Success Summary](./REDEPLOYMENT_SUCCESS_SUMMARY.md)** - Previous successful deployment
- **[Deployment Success Summary](./DEPLOYMENT_SUCCESS_SUMMARY.md)** - Initial deployment documentation

### 🎯 Feature-Specific Deployments
- **[Speech Production Readiness](./SPEECH_PRODUCTION_READINESS.md)** - Speech-to-text feature deployment
- **[Mixed Content Fix Summary](./MIXED_CONTENT_FIX_SUMMARY.md)** - HTTPS/security fixes

## 🔍 Quick Reference

### Current Production Status
```bash
# Check service status
gcloud run services list --region=us-central1

# Health check
curl https://kotori-api-412014849981.us-central1.run.app/api/health
```

### Common Deployment Commands
```bash
# Full deployment
./scripts/cloud-deploy.sh

# Frontend only
./scripts/cloud-deploy.sh --frontend-only

# Backend only  
./scripts/cloud-deploy.sh --backend-only

# Custom tag
./scripts/cloud-deploy.sh --tag my-custom-tag
```

### Required Secrets
All deployments require these Google Cloud secrets:
- `database-url` → `DATABASE_URL`
- `secret-key` → `SECRET_KEY`
- `google-cloud-project` → `GOOGLE_CLOUD_PROJECT`
- `google-cloud-location` → `GOOGLE_CLOUD_LOCATION`
- `encryption-master-salt` → `ENCRYPTION_MASTER_SALT`

## 🚨 Emergency Procedures

### Rollback to Previous Version
```bash
# List revisions
gcloud run revisions list --service=kotori-api --region=us-central1

# Rollback to specific revision
gcloud run services update-traffic kotori-api --to-revisions=REVISION_NAME=100 --region=us-central1
```

### Check Deployment Logs
```bash
# Recent deployment logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=kotori-api" --limit=50

# Specific revision logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.revision_name=REVISION_NAME" --limit=20
```

## 🎯 Latest Deployment (August 14, 2025)

**Status**: ✅ **SUCCESSFUL**
- **Frontend**: `kotori-app-00022-ffv` 
- **Backend**: `kotori-api-00033-ngj`
- **Features**: Complete sharing functionality with AI-powered summaries

**Key Fix**: Environment variable mapping corrected
```bash
# Fixed secret mapping
--set-secrets "DATABASE_URL=database-url:latest,SECRET_KEY=secret-key:latest,..."
```

## 🔗 Related Resources

- [Google Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Google Cloud Build Documentation](https://cloud.google.com/build/docs)
- [Google Cloud Secret Manager](https://cloud.google.com/secret-manager/docs)
- [Kotori Main Repository](../../README.md)

## 📞 Support

For deployment issues:
1. Check [Deployment Troubleshooting](./DEPLOYMENT_TROUBLESHOOTING.md)
2. Review [Deployment Lessons Learned](./DEPLOYMENT_LESSONS_LEARNED.md)
3. Examine Cloud Run logs for specific error messages
4. Compare current configuration with working deployment exports

---

*Last Updated: August 14, 2025*  
*Latest Successful Deployment: Sharing Feature with AI-powered summaries*
