# PBI-8: Database Schema Optimization and Best Practices Implementation

[View in Backlog](../backlog.md#user-content-PBI-8)

## Overview

This PBI focuses on auditing, standardizing, and optimizing the database schema to follow Postgres best practices, ensuring consistency, performance, security, and compatibility with cloud providers like GCP Cloud SQL and AWS RDS.

## Problem Statement

The current schema has inconsistencies in ID types (mix of Integer, String(36), native UUID), missing indexes, and no formal migration system, which could lead to performance issues, schema mismatches, and difficulties in cloud migration.

## User Stories

- As a developer, I want consistent ID types across all models to prevent foreign key mismatches.
- As a DevOps engineer, I want proper indexes and constraints for optimal query performance.
- As a system architect, I want Alembic migrations set up for safe schema changes.
- As a cloud engineer, I want the schema to be compatible with managed Postgres services.

## Technical Approach

- Use SQLAlchemy's UUID type with as_uuid=True for all primary keys where global uniqueness is needed.
- Add indexes on foreign keys and frequently queried fields.
- Set up Alembic for migrations.
- Ensure schema portability to cloud Postgres.

## UX/UI Considerations

No direct UX changes; this is backend-focused.

## Acceptance Criteria

- All ID fields are consistent (native UUID for users and related).
- Indexes added to all foreign keys.
- Alembic configured and initial migration created.
- Documentation for cloud migration.
- All tests pass with new schema.

## Dependencies

None.

## Open Questions

- Should all tables use UUID, or keep Integer for some sequential IDs?

## Related Tasks

See [tasks.md](./tasks.md) 