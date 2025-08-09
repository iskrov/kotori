# Tasks for PBI 2: Phase 2 — Secret tags OFF (feature-flag)

This document lists all tasks associated with PBI 2.

**Parent PBI**: [PBI 2: Phase 2 — Secret tags OFF (feature-flag)](./prd.md)

## Task Summary

| Task ID | Name | Status | Description |
| :------ | :--------------------------------------- | :------- | :--------------------------------- |
| 2-1 | [Introduce global secret-tag flags (FE+BE)](./2-1.md) | InProgress | Add `ENABLE_SECRET_TAGS` flags and wire into app. |
| 2-2 | [Guard frontend UI and detection paths](./2-2.md) | Review | Hide/remove secret-tag UI and phrase detection when flag OFF. |
| 2-3 | [Guard backend routers/services/schemas](./2-3.md) | Review | Exclude secret-tag APIs and models when flag OFF. |
| 2-4 | [E2E CoS Test](./2-4.md) | Review | Verify journaling/transcription work with secret tags disabled.
