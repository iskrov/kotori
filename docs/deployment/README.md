# Kotori Deployment Documentation

This directory contains comprehensive documentation for deploying and managing Kotori on Google Cloud Platform.

## 📚 Documentation Index

### 🚀 Core Deployment Docs
- **[Deployment Script](../../scripts/cloud-deploy.sh)** – Automated deployment (frontend/backend) and DB migrations
- **[Database Migration Strategy](./DATABASE_MIGRATION_STRATEGY.md)** – Cloud Build Private Pool migrations, backups, IAM
- **[Deployment Troubleshooting](./DEPLOYMENT_TROUBLESHOOTING.md)** – Common issues and fixes

### 🔎 Config Reference
- **[Production Environment](../../deploy/production-env.yaml)** – Cloud Run env vars

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
# Full deployment (includes migrations)
./scripts/cloud-deploy.sh

# Frontend only
./scripts/cloud-deploy.sh --frontend-only

# Backend only (includes migrations)
./scripts/cloud-deploy.sh --backend-only

# Migrations only (no app deployment)
./scripts/cloud-deploy.sh --migrations-only

# Skip migrations (emergency use only)
./scripts/cloud-deploy.sh --skip-migrations

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

## 🎯 Current Process Snapshot

- Migrations: Cloud Build Private Pool via `deploy/run-migrations.yaml` (triggered by `scripts/cloud-deploy.sh`)
- Backend/Frontend: Deployed to Cloud Run via the same script
- Secrets: Injected from Secret Manager using `--set-secrets` and `availableSecrets` in Cloud Build

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

*Last Updated: August 15, 2025*
