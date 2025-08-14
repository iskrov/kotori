# Database Migration Quick Reference Guide

## 🚀 Deployment Commands

### Standard Deployment (with migrations)
```bash
./scripts/cloud-deploy.sh
```

### Migration-Only Deployment
```bash
./scripts/cloud-deploy.sh --migrations-only
```

### Skip Migrations (Emergency)
```bash
./scripts/cloud-deploy.sh --skip-migrations
```

### Backend with Migrations
```bash
./scripts/cloud-deploy.sh --backend-only
```

## 🔧 Manual Migration Commands

### Check Current Status
```bash
cd backend
alembic current
alembic history --verbose
```

### Run Migrations Manually
```bash
cd backend
export DATABASE_URL=$(gcloud secrets versions access latest --secret="database-url")
alembic upgrade head
```

### Rollback Migrations
```bash
cd backend
# Rollback to specific revision
alembic downgrade REVISION_ID

# Rollback one step
alembic downgrade -1
```

## 🚨 Emergency Procedures

### 1. Application Rollback (No Schema Changes)
```bash
# Rollback to previous Cloud Run revision
gcloud run services update-traffic kotori-api \
    --to-revisions=PREVIOUS_REVISION=100 \
    --region=us-central1
```

### 2. Schema Rollback (Safe)
```bash
cd backend
export DATABASE_URL=$(gcloud secrets versions access latest --secret="database-url")

# Check what will be rolled back
alembic downgrade REVISION_ID --sql

# Execute rollback
alembic downgrade REVISION_ID
```

### 3. Database Restore (Last Resort)
```bash
# List available backups
gcloud sql backups list --instance=kotori-db-instance

# Restore from backup
gcloud sql backups restore BACKUP_ID \
    --restore-instance=kotori-db-instance \
    --backup-instance=kotori-db-instance
```

## 📋 Pre-Deployment Checklist

- [ ] **Local Testing**: Migrations tested locally
- [ ] **Backup Verified**: Recent backup exists
- [ ] **Migration Review**: SQL changes reviewed
- [ ] **Rollback Plan**: Downgrade path confirmed
- [ ] **Team Notification**: Stakeholders informed

## 🔍 Troubleshooting

### Migration Fails During Deployment
```bash
# Check logs
gcloud logging read "resource.type=cloud_run_revision" --limit=50

# Check migration status
cd backend && alembic current

# Manual fix if needed
export DATABASE_URL=$(gcloud secrets versions access latest --secret="database-url")
alembic upgrade head
```

### Database Connection Issues
```bash
# Test connection
cd backend
python -c "
import asyncio
from app.core.database import get_db
async def test(): 
    async for db in get_db(): 
        print('Connected!'); break
asyncio.run(test())
"
```

### Schema Mismatch
```bash
# Compare expected vs actual schema
cd backend
alembic current
alembic heads
alembic upgrade head --sql > expected_changes.sql
```

## 📊 Migration Status Monitoring

### Health Check After Migration
```bash
# Backend health
curl https://kotori-api-412014849981.us-central1.run.app/api/health

# Database connectivity test
curl -X POST https://kotori-api-412014849981.us-central1.run.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'
```

### Performance Monitoring
```bash
# Check active connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Check for locks
psql $DATABASE_URL -c "SELECT * FROM pg_locks WHERE NOT granted;"
```

## 🎯 Success Indicators

✅ **Migration Successful When:**
- `alembic current` shows expected revision
- Backend health check returns 200
- No error logs in Cloud Run
- Application features work correctly
- Database queries respond normally

❌ **Migration Failed When:**
- Alembic reports errors
- Backend containers fail to start
- Health checks return 500 errors
- Database connection timeouts
- Schema inconsistencies

## 📞 Emergency Contacts

**For Production Issues:**
1. Check [Deployment Troubleshooting](./DEPLOYMENT_TROUBLESHOOTING.md)
2. Review [Migration Strategy](./DATABASE_MIGRATION_STRATEGY.md)
3. Escalate if data integrity at risk

---

*Quick Reference - Keep this handy during deployments*
