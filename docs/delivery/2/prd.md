# PBI-2: Phase 2 — Secret tags OFF (feature-flag)

[Back to Backlog](../backlog.md#user-content-2)

## Overview
Disable secret-tag features across the app by default with a single flag, preserving OPAQUE user auth and keeping journaling/transcription functional.

## Problem Statement
Secret-tag flows add complexity. We need a safe kill-switch to ship baseline Kotori.

## Technical Approach
- Add `ENABLE_SECRET_TAGS` flag in backend settings and conditionally include secret-tag router.
- Add `ENABLE_SECRET_TAGS` in frontend feature flags. Hide/remove UI, disable detector paths when OFF.

## Acceptance Criteria
- No secret-tag UI visible by default.
- Backend secret-tag endpoints not mounted by default.
- Journaling and transcription work end-to-end without secret tags.

## Related Tasks
- Code edits in backend `app/main.py`, `app/core/config.py`.
- Frontend `featureFlags.ts`, `speechToText.ts`, `RecordScreen.tsx`, navigation.
