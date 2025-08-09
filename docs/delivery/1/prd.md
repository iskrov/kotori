# PBI-1: Phase 1 — Rebrand and baseline config

[Back to Backlog](../backlog.md#user-content-1)

## Overview
Rebrand the application from Vibes to Kotori and baseline configuration to target `https://api.kotori.io` for production while keeping local dev behavior unchanged.

## Problem Statement
The codebase contains numerous Vibes references and legacy URLs that must be updated to Kotori branding and domains.

## User Stories
- As a maintainer, I want the app rebranded to Kotori.

## Technical Approach
- Rename app name/slug/bundle IDs.
- Update backend titles and identifiers.
- Point production URLs to `https://api.kotori.io` (staging `https://staging.api.kotori.io`).
- Provide refreshed environment configuration documentation.
- Keep configuration env-driven; do not hardcode secrets.

## UX/UI Considerations
- Update icons/splash placeholders (non-destructive). Final artwork to follow.

## Acceptance Criteria
- Frontend and backend display Kotori naming.
- Production/staging URLs updated.
- Local dev remains at localhost ports.
- Example configuration and docs reflect Kotori.

## Dependencies
- None.

## Open Questions
- Final branding assets and colors.

## Related Tasks
- See tasks list in this PBI folder.
