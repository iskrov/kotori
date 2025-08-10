# PBI-5: Phase 5 — GCP provisioning

[Back to Backlog](../backlog.md#user-content-5)

## Overview
Provision complete GCP infrastructure for Kotori voice journaling application including Cloud Run API deployment, Cloud SQL PostgreSQL 17 database, Secret Manager integration, Artifact Registry for containers, Cloud Build CI/CD, comprehensive IAM security, Logging/Monitoring stack, Speech-to-Text API access, Certificate Manager for TLS, and optional Cloud Storage.

## Problem Statement
The Kotori application requires production-grade cloud infrastructure that maintains zero-knowledge security architecture while providing scalable, reliable, and secure hosting for the voice journaling backend API.

## User Stories
- As a DevOps engineer, I need automated deployment scripts to provision all GCP infrastructure consistently
- As a security engineer, I need all secrets managed securely through Secret Manager with least-privilege access
- As a developer, I need the backend API accessible via custom domain with automatic TLS certificates
- As a product owner, I need monitoring and alerting to ensure service reliability and performance

## Technical Approach
- **Infrastructure as Code**: Automated deployment scripts for consistent provisioning
- **Security First**: Zero-knowledge architecture maintained, secrets in Secret Manager, least-privilege IAM
- **Production Ready**: Auto-scaling Cloud Run, high-availability database, comprehensive monitoring
- **Developer Experience**: Complete CI/CD pipeline, easy rollback procedures, comprehensive documentation

## UX/UI Considerations
- API endpoints accessible via clean custom domain (`api.kotori.io`)
- Consistent response times under 2 seconds for optimal user experience
- Graceful error handling and logging for debugging support

## Acceptance Criteria
✅ **Infrastructure Provisioned:**
- Cloud Run service `kotori-api` deployed and accessible
- Cloud SQL PostgreSQL 17 instance `kotori-db` with private IP and daily backups
- All required GCP APIs enabled (Run, SQL, Secrets, Speech-to-Text, etc.)

✅ **Frontend Deployment (Task 5-7):**
- Cloud Run service `kotori-app` deployed at `https://kotori-app-412014849981.us-central1.run.app`
- React Native web frontend built and containerized with nginx
- Static file serving optimized with proper caching and security headers
- **Region Migration**: Successfully migrated to `us-central1` for domain mapping support

✅ **Security Configured:**
- Service account `kotori-api@kotori-prod.iam.gserviceaccount.com` with least-privilege roles
- All secrets stored in Secret Manager and properly injected to Cloud Run
- Zero-knowledge architecture maintained (server never sees plaintext content)

✅ **Domain & TLS Ready:**
- Infrastructure deployed in `us-central1` with full domain mapping support
- Ready for custom domains `api.kotori.io` and `app.kotori.io` with automatic TLS certificates
- Health check endpoint returns 200 OK at `/api/health`
- CORS configured for frontend origins

✅ **Operational Excellence:**
- Database migrations applied successfully via Alembic
- Monitoring and alerting configured with comprehensive dashboards
- Rollback procedures documented and tested
- Complete deployment verification suite

✅ **Documentation & Automation:**
- One-click deployment script (`gcp-setup.sh`) 
- Comprehensive deployment guide and operational procedures
- Emergency rollback scripts and troubleshooting guides
- CI/CD pipeline configured for automated deployments

## Dependencies
- Google Cloud Platform account with billing enabled
- Domain ownership for `kotori.io` verified
- `gcloud` CLI authenticated with appropriate permissions

## Open Questions
- DNS configuration timing (up to 24 hours for propagation)
- Speech-to-Text API testing requires real audio data for full verification

## Related Tasks
- [Tasks for PBI 5](./tasks.md) - All 6 tasks completed successfully
