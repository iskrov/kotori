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
