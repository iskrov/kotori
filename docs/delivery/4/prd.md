# PBI-4: Stage 1 — Secret-tag schema deprecation on existing Postgres 17

[Back to Backlog](../backlog.md#user-content-4)

## Overview
We already run on Postgres 17. This PBI focuses on safely deprecating legacy secret-tag schema while preserving current per-user encryption behavior. No destructive drops in this stage.

## Problem Statement
Legacy secret-tag tables/columns remain in the schema but the app now uses per-user encryption (PBI-3). Keeping unused objects adds complexity and risk.

## User Stories
- As a maintainer, I want the database schema to reflect current architecture (no secret tags), with a safe path to remove legacy objects later.

## Technical Approach
- Do not install/upgrade Postgres; use existing PG 17 instance and dev DB.
- Add a migration that:
  - Marks secret-tag objects deprecated via comments and ensures the app no longer writes to them.
  - Optionally adds views or guards if any residual code reads them (should be none while ENABLE_SECRET_TAGS=false).
  - Ensures idempotency and clean downgrades.
- Update services to avoid referencing secret-tag objects when the feature is disabled.

## UX/UI Considerations
None (backend-only changes).

## Acceptance Criteria
- Stage 1: Migration applies on current dev DB without destructive drops.
- Stage 2: Destructive removal completed and verified on dev DB (per user instruction: no backups required).
- App functions end-to-end with per-user encryption; no writes to legacy secret-tag tables.
- OPAQUE user authentication continues to work (registration/login) after Stage 2.
- Documentation updated with deprecation plan, Stage 2 completion report, and restoration summary.

## Dependencies
- PBI-3 complete and ENABLE_SECRET_TAGS=false.

## Open Questions
- Any BI/reporting that still depends on legacy tables? (Assumed no.)

## Related Tasks
- See tasks list for PBI-4.

# PBI-4: Phase 4 — Database posture (PostgreSQL 17) and schema cleanup

[Back to Backlog](../backlog.md#user-content-4)

## Overview
Adopt PostgreSQL 17 and prepare schema deprecation of secret-tag artifacts in two stages.

## Problem Statement
We must modernize DB version and safely deprecate secret-tag schema.

## Technical Approach
- Stage 1: Deprecate secret-tag FKs/columns/tables; keep compatibility.
- Stage 2: Post-deploy drop after backup; remove indexes/constraints.

## Acceptance Criteria
- Docs/scripts reflect PG17; migrations staged; rollback documented.

## Related Tasks
- Tasks in PBI 4.
