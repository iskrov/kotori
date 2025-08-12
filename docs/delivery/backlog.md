# Kotori Backlog

| ID | Actor | User Story | Status | Conditions of Satisfaction (CoS) |
| :-- | :---- | :--------- | :----- | :------------------------------- |
| 1 | Admin | As a maintainer, I want the app rebranded to Kotori with environment-driven URLs so production points to `https://api.kotori.io`. | Done | Frontend/app names and bundle IDs updated; backend titles updated; local dev unaffected; example envs reflect Kotori. |
| 2 | Admin | As a maintainer, I want secret-tag features disabled behind a feature flag while preserving OPAQUE auth. | Done | Global flag disables secret-tag UI and routes; journaling and transcription work without tags. |
| 3 | User | As a user, I want my entries encrypted per-user (client-side) without secret tags. | Done | Per-user encryption keys derived from OPAQUE; serializers/validators no longer require secret_tag. |
| 4 | Admin | As a maintainer, I want a safe migration away from secret-tag schema on our existing Postgres 17. | Done | Stage 1: deprecate/disable secret-tag tables/columns without destructive drops; ensure app uses per-user encryption only; Stage 2 removal complete; OPAQUE user authentication restored and verified. |
| 2025-08-09 11:10:00 | 4 | propose_for_backlog | PG17 already in use; scope PBI-4 to secret-tag schema cleanup (Stage 1 non-destructive) | ai-agent |
| 5 | Admin | As a maintainer, I want GCP infra provisioned for Kotori. | Done | Cloud Run deployed in us-central1; Cloud SQL PG17; Secret Manager wired; Speech-to-Text enabled; ready for domains `api.kotori.io` and `app.kotori.io` with TLS. |
| 6 | Admin | As a maintainer, I want permanent removal of secret-tag code after migration. | Done | Secret-tag code and tests removed after Stage 2; OPAQUE and per-user encryption intact. |
| 7 | Admin | As a maintainer, I want documentation and hygiene maintained. | Done | READMEs and technical docs updated; `todo.md`/`done.md` maintained; Decision Log added. |
| 8 | User | As a user, I want the entire Kotori app to have a calm, low-stimulation visual design matching the website aesthetic. | Proposed | All screens use consistent teal color system; soft shadows and proper spacing throughout; accessible calendar selection states; proper touch targets (48px minimum); WCAG AA contrast compliance; no functionality regressions. |

| 10 | Admin | As a maintainer, I want the temporary GCS import bucket locked down or removed after schema bootstrap. | Proposed | Import bucket access removed (or bucket deleted); no SQL files exposed; documentation updated to reflect cleanup. |
| 11 | Admin | As a maintainer, I want a least-privilege IAM audit for the `kotori-api` service account. | Proposed | Only required roles (Cloud SQL Client, Secret Manager access, Logging, Monitoring) retained; any excess roles removed; changes documented. |
| 12 | Admin | As a maintainer, I want production monitoring and alerting configured for API, frontend, and Cloud SQL. | Proposed | Dashboards created; uptime checks and error/latency alerts in place; Cloud SQL CPU/storage alerts configured; docs include runbooks. |
| 13 | Admin | As a maintainer, I want Cloud SQL backups and retention verified with a test restore plan. | Proposed | Backup schedule confirmed; retention window set; PITR considered (if supported); test restore documented. |
| 14 | Admin | As a maintainer, I want CI/CD to run Alembic migrations via a Cloud Run Job during deploys. | Proposed | Pipeline step triggers a migrations job with proper IAM; safe rollout ordering documented; failure handling defined. |
| 15 | Admin | As a maintainer, I want the backend to use the Cloud SQL socket and a socket-DSN migration job so the database remains private-only. | Proposed | Cloud Run service bound to the Cloud SQL instance via `--set-cloudsql-instances`; secrets include a socket-form DSN for Alembic; migration job succeeds without public IP or TCP host; docs updated. |
| 16 | Admin | As a maintainer, I want API network posture reviewed (public vs. internal behind HTTPS LB) and hardened. | Proposed | Decision documented; if internal, set up HTTPS LB + serverless NEG (and access for frontend); if public, ensure WAF/CSP/HSTS/CORS; verification documented. |

## History

| Timestamp | PBI_ID | Event_Type | Details | User |
| :-------- | :----- | :--------- | :------ | :--- |
| 2025-08-08 00:00:00 | 1 | create_pbi | Rebrand and baseline config | ai-agent |
| 2025-08-08 00:00:00 | 1 | propose_for_backlog | Approved Phase 1 PBI | ai-agent |
| 2025-08-08 00:10:00 | 2 | start_implementation | Began implementation for PBI 2 | ai-agent |
| 2025-08-08 00:46:00 | 2 | submit_for_review | PBI 2 tasks completed; submitted for review | ai-agent |
| 2025-08-08 01:10:00 | 3 | start_implementation | Began implementation for PBI 3; task 3-1 InProgress | ai-agent |
| 2025-08-08 01:28:00 | 3 | status_update | Implemented 3-1 client per-user encryption and 3-2/3-3 backend support | ai-agent |
| 2025-08-09 10:55:00 | 3 | submit_for_review | Completed tasks 3-1..3-4; added OPAQUE smoke test; ready for review | ai-agent |
| 2025-08-09 11:05:00 | 3 | approve | PBI-3 accepted; marking as Done | user |
| 2025-08-10 01:25:00 | 5 | start_implementation | Began GCP infrastructure deployment | ai-agent |
| 2025-08-10 01:25:00 | 5 | submit_for_review | All infrastructure deployed successfully in us-central1; ready for domain mapping | ai-agent |
| 2025-08-11 10:00:00 | 8 | create_pbi | App-wide visual refresh for calm, low-stimulation design | ai-agent |
| 2025-08-11 10:45:00 | 8 | propose_for_backlog | PBI-8 fully documented with 7 implementation tasks | ai-agent |
| 2025-08-10 22:50:00 | 9 | create_pbi | Backend uses Cloud SQL socket and socket-DSN migration job to keep DB private | ai-agent |
| 2025-08-10 22:50:00 | 10 | create_pbi | Lock down or remove temporary GCS import bucket used for schema bootstrap | ai-agent |
| 2025-08-10 22:50:00 | 11 | create_pbi | Least-privilege IAM audit for `kotori-api` service account | ai-agent |
| 2025-08-10 22:50:00 | 12 | create_pbi | Production monitoring and alerting for API, frontend, and Cloud SQL | ai-agent |
| 2025-08-10 22:50:00 | 13 | create_pbi | Cloud SQL backups/retention verified with test restore plan | ai-agent |
| 2025-08-10 22:50:00 | 14 | create_pbi | CI/CD step to run Alembic migrations via Cloud Run Job | ai-agent |
| 2025-08-10 22:50:00 | 15 | create_pbi | API network posture review and hardening (LB/internal or public+WAF) | ai-agent |
