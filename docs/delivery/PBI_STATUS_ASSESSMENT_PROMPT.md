# PBI Status Assessment Prompt for External LLM

## Context
You are tasked with assessing the completion status of Product Backlog Items (PBIs) for the Kotori voice journaling application. The user believes they may have completed work up to PBI-6 but wants verification of what has been done versus what remains.

## Project Overview
Kotori is a voice journaling application with OPAQUE zero-knowledge authentication, currently transitioning from a secret-tag based architecture to per-user encryption. The application consists of:
- **Backend**: FastAPI (Python) with PostgreSQL 17 database
- **Frontend**: React Native (cross-platform: iOS, Android, Web)
- **Infrastructure**: Google Cloud Platform (Cloud Run, Cloud SQL, etc.)
- **Security**: Zero-knowledge architecture with client-side encryption

## Current Backlog Status (from backlog.md)
```
| ID | Actor | User Story | Status | Conditions of Satisfaction (CoS) |
| 1 | Admin | As a maintainer, I want the app rebranded to Kotori with environment-driven URLs so production points to `https://api.kotori.io`. | Agreed | Frontend/app names and bundle IDs updated; backend titles updated; local dev unaffected; example envs reflect Kotori. |
| 2 | Admin | As a maintainer, I want secret-tag features disabled behind a feature flag while preserving OPAQUE auth. | InReview | Global flag disables secret-tag UI and routes; journaling and transcription work without tags. |
| 3 | User | As a user, I want my entries encrypted per-user (client-side) without secret tags. | Done | Per-user encryption keys derived from OPAQUE; serializers/validators no longer require secret_tag. |
| 4 | Admin | As a maintainer, I want a safe migration away from secret-tag schema on our existing Postgres 17. | InReview | Stage 1: deprecate/disable secret-tag tables/columns without destructive drops; ensure app uses per-user encryption only; Stage 2 removal complete; OPAQUE user authentication restored and verified. |
| 5 | Admin | As a maintainer, I want GCP infra provisioned for Kotori. | Done | Cloud Run deployed in us-central1; Cloud SQL PG17; Secret Manager wired; Speech-to-Text enabled; ready for domains `api.kotori.io` and `app.kotori.io` with TLS. |
| 6 | Admin | As a maintainer, I want permanent removal of secret-tag code after migration. | Proposed | Secret-tag code and tests removed after Stage 2; OPAQUE and per-user encryption intact. |
| 7 | Admin | As a maintainer, I want documentation and hygiene maintained. | Proposed | READMEs and technical docs updated; `todo.md`/`done.md` maintained; Decision Log added. |
```

## Assessment Task
Please analyze the current codebase and documentation to determine:

### 1. PBI-1 (Rebranding) Assessment
**Status in backlog**: Agreed
**Check for**:
- Frontend app names changed from previous name to "Kotori"
- Bundle IDs updated to reflect Kotori branding
- Backend API titles/metadata updated to "Kotori"
- Environment configuration supports `https://api.kotori.io` for production
- Local development environment still works
- Example environment files (.env.example) reflect Kotori branding

**Key files to examine**:
- `frontend/app.config.js` (app name, bundle ID)
- `frontend/package.json` (app name)
- `backend/app/main.py` (API title, description)
- `backend/app/core/config.py` (environment configuration)
- `.env.example` files in both frontend and backend
- Any README files mentioning the app name

### 2. PBI-2 (Feature Flag) Assessment  
**Status in backlog**: InReview
**Check for**:
- Global feature flag system implemented
- Secret-tag UI components disabled/hidden when flag is off
- Secret-tag API routes disabled when flag is off
- Journaling functionality works without secret tags
- Transcription functionality works without secret tags
- OPAQUE authentication preserved and functional

**Key files to examine**:
- Backend configuration for feature flags
- Frontend components that previously used secret tags
- API routes related to secret-tag functionality
- Authentication flows to ensure OPAQUE is intact

### 3. PBI-3 (Per-User Encryption)
**Status in backlog**: Done
**Verification points**:
- Client-side encryption implemented using per-user keys
- Keys derived from OPAQUE authentication
- Backend serializers/validators no longer require secret_tag
- Journal entries encrypted before sending to server
- Server never sees plaintext content

### 4. PBI-4 (Schema Migration)
**Status in backlog**: InReview  
**Check for**:
- Stage 1: Secret-tag tables/columns deprecated but not dropped
- Database migration scripts for schema changes
- Application works with per-user encryption only
- OPAQUE user authentication restored and verified
- No destructive database operations yet (Stage 2 not implemented)

**Key files to examine**:
- Database migration files (likely in `backend/alembic/versions/`)
- Database models (likely in `backend/app/models/`)
- Any schema documentation

### 5. PBI-5 (GCP Infrastructure)
**Status in backlog**: Done
**Verification points**:
- Cloud Run services deployed in us-central1
- Cloud SQL PostgreSQL 17 instance running
- Secret Manager configured and wired
- Speech-to-Text API enabled and accessible
- Infrastructure ready for custom domains

### 6. PBI-6 (Code Removal)
**Status in backlog**: Proposed
**Check for**:
- Secret-tag related code actually removed (not just disabled)
- Secret-tag tests removed
- OPAQUE authentication and per-user encryption still intact
- Codebase cleaned of secret-tag references

**Key areas to examine**:
- Frontend components and screens related to secret tags
- Backend models, serializers, views for secret tags
- Test files mentioning secret tags
- Any remaining imports or references to secret-tag functionality

### 7. PBI-7 (Documentation)
**Status in backlog**: Proposed
**Check for**:
- README files updated with current project state
- Technical documentation reflects current architecture
- `todo.md` and `done.md` files maintained
- Decision log or similar documentation exists

## Assessment Framework
For each PBI, please provide:

1. **Completion Assessment**: 
   - ✅ **Complete**: All CoS met, implementation verified
   - 🔄 **Partial**: Some work done but CoS not fully met
   - ❌ **Not Started**: No evidence of implementation
   - ⚠️ **Unclear**: Cannot determine status from available information

2. **Evidence Summary**: Brief description of what you found that supports your assessment

3. **Gap Analysis**: If partial or not started, what specific work remains

4. **Recommended Status Update**: What the backlog status should be updated to based on actual implementation

## Key Directories to Examine
- `/backend/` - Python FastAPI backend
- `/frontend/` - React Native frontend  
- `/docs/delivery/` - PBI documentation and task files
- `/deploy/` - GCP deployment scripts and configuration
- Root level configuration files (.env.example, package.json, etc.)

## Output Format
Please structure your response as:

```
# Kotori PBI Status Assessment

## Executive Summary
[Brief overview of overall project status]

## Individual PBI Assessment

### PBI-1: Rebranding
- **Assessment**: [✅/🔄/❌/⚠️]
- **Evidence**: [What you found]
- **Gaps**: [What's missing if not complete]
- **Recommended Status**: [Proposed/Agreed/InProgress/InReview/Done]

[Continue for all PBIs...]

## Overall Recommendations
[Summary of what should be tackled next]
```

Please be thorough in examining the codebase and provide specific evidence for your assessments.
