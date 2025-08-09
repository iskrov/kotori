# Tasks for PBI 5: Phase 5 — GCP provisioning

This document lists all tasks associated with PBI 5.

**Parent PBI**: [PBI 5: Phase 5 — GCP provisioning](./prd.md)

## Task Summary

| Task ID | Name | Status | Description |
| :------ | :--------------------------------------- | :------- | :--------------------------------- |
| 5-1 | [Enable required GCP services/APIs](./5-1.md) | Proposed | Enable Run, SQL, Secrets, Storage, etc. |
| 5-2 | [Service account and IAM roles](./5-2.md) | Proposed | Create API service account with least-privilege. |
| 5-3 | [Provision Cloud SQL Postgres 17](./5-3.md) | Proposed | Create instance, database, user. |
| 5-4 | [Secret Manager wiring](./5-4.md) | Proposed | Store DATABASE_URL/SECRET_KEY; wire to Run. |
| 5-5 | [Cloud Run deploy + domain/TLS](./5-5.md) | Proposed | Deploy backend; map `api.kotori.io` with TLS. |
| 5-6 | [Speech-to-Text verification](./5-6.md) | Proposed | Ensure ADC and access from backend.
