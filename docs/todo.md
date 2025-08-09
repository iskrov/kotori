# TODO

- [PBI-1] Phase 1 — Rebrand and baseline config
  - Rename app to Kotori (app name, slug, bundle IDs, package names)
  - Point production URLs to https://api.kotori.io; staging to https://staging.api.kotori.io
  - Update README and technical docs references
  - Provide refreshed backend and frontend .env.example files
  - Update icons/splash placeholders (non-destructive)

- [PBI-2] Phase 2 — Secret tags OFF (feature flag)
  - Introduce top-level feature flag to disable secret-tag features (default OFF)
  - Hide secret-tag UI and routes when flag is OFF
  - Ensure journaling and transcription work without secret tags

- [PBI-3] Phase 3 — Per-user encryption
  - Keep OPAQUE; derive per-user encryption keys on client
  - Remove dependency on secret-tag-derived keys in serializers/validators
  - Mark entries encrypted/plaintext with a boolean

- [PBI-4] Phase 4 — Database posture & migration
  - Update docs/scripts to PostgreSQL 17
  - Stage 1: deprecate secret-tag FKs/columns/tables
  - Stage 2: post-deploy drop after backup, document rollback

- [PBI-5] Phase 5 — GCP provisioning
  - Enable required services/APIs
  - Create service account, Cloud SQL PG17, Secret Manager
  - Cloud Run deploy, domain mapping for api.kotori.io with TLS
  - Speech-to-Text access via ADC

- [PBI-6] Phase 6 — Permanent removal of secret tags
  - Delete secret-tag code and tests post-migration verification

- [PBI-7] Phase 7 — Documentation and hygiene
  - Update root and technical docs, add Decision Log
