# Tasks for PBI 4: Stage 1 — Secret-tag schema deprecation on PG 17

This document lists all tasks associated with PBI 4.

**Parent PBI**: [PBI 4: Stage 1 — Secret-tag schema deprecation on existing Postgres 17](./prd.md)

## Task Summary

| Task ID | Name | Status | Description |
| :------ | :---------------------------------------------- | :------- | :----------------------------------------------- |
| 4-1 | [Schema inventory and impact report](./4-1.md) | Done | Enumerate legacy secret-tag tables/columns and where they're referenced. |
| 4-2 | [Non-destructive Alembic migration (deprecations)](./4-2.md) | Done | Add migration that comments, disables triggers, and ensures no writes to legacy objects. |
| 4-3 | [Service guard rails with feature flag](./4-3.md) | Done | Ensure services never read/write secret-tag objects when `ENABLE_SECRET_TAGS=false`. |
| 4-4 | [Integration check on current dev DB](./4-4.md) | Done | Apply migration on current DB; run smoke (OPAQUE + encrypted CRUD) to confirm normal behavior. Verified OPAQUE restoration after Stage 2. |
| 4-5 | [Technical docs update](./4-5.md) | Done | Document deprecation plan and Stage 2 destructive removal outline. |
