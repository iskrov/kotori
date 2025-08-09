# Kotori Backlog

| ID | Actor | User Story | Status | Conditions of Satisfaction (CoS) |
| :-- | :---- | :--------- | :----- | :------------------------------- |
| 1 | Admin | As a maintainer, I want the app rebranded to Kotori with environment-driven URLs so production points to `https://api.kotori.io`. | Agreed | Frontend/app names and bundle IDs updated; backend titles updated; local dev unaffected; example envs reflect Kotori. |
| 2 | Admin | As a maintainer, I want secret-tag features disabled behind a feature flag while preserving OPAQUE auth. | InReview | Global flag disables secret-tag UI and routes; journaling and transcription work without tags. |
| 3 | User | As a user, I want my entries encrypted per-user (client-side) without secret tags. | InProgress | Per-user encryption keys derived from OPAQUE; serializers/validators no longer require secret_tag. |
| 4 | Admin | As a maintainer, I want Postgres 17 posture and a safe migration away from secret-tag schema. | Proposed | Docs/scripts show PG 17; Stage 1 deprecations; Stage 2 drops post-verify with rollback plan. |
| 5 | Admin | As a maintainer, I want GCP infra provisioned for Kotori. | Proposed | Cloud Run deployed; Cloud SQL PG17; Secret Manager wired; Speech-to-Text enabled; domain `api.kotori.io` with TLS. |
| 6 | Admin | As a maintainer, I want permanent removal of secret-tag code after migration. | Proposed | Secret-tag code and tests removed after Stage 2; OPAQUE and per-user encryption intact. |
| 7 | Admin | As a maintainer, I want documentation and hygiene maintained. | Proposed | READMEs and technical docs updated; `todo.md`/`done.md` maintained; Decision Log added. |

## History

| Timestamp | PBI_ID | Event_Type | Details | User |
| :-------- | :----- | :--------- | :------ | :--- |
| 2025-08-08 00:00:00 | 1 | create_pbi | Rebrand and baseline config | ai-agent |
| 2025-08-08 00:00:00 | 1 | propose_for_backlog | Approved Phase 1 PBI | ai-agent |
| 2025-08-08 00:10:00 | 2 | start_implementation | Began implementation for PBI 2 | ai-agent |
| 2025-08-08 00:46:00 | 2 | submit_for_review | PBI 2 tasks completed; submitted for review | ai-agent |
| 2025-08-08 01:10:00 | 3 | start_implementation | Began implementation for PBI 3; task 3-1 InProgress | ai-agent |
| 2025-08-08 01:28:00 | 3 | status_update | Implemented 3-1 client per-user encryption and 3-2/3-3 backend support | ai-agent |
