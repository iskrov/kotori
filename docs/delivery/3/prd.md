# PBI-3: Phase 3 — Per-user encryption without secret tags

[Back to Backlog](../backlog.md#user-content-3)

## Overview
Consolidate to per-user encryption (client-side) with keys derived from OPAQUE; remove dependency on secret-tag-derived keys.

## Problem Statement
Secret-tag keying adds complexity. We need a simple per-user encryption model.

## User Stories
- As a user, my entries are encrypted per-user regardless of secret tags.

## Technical Approach
- Derive per-user master key from OPAQUE login client-side.
- Encrypt entries with per-entry keys wrapped by user master key.
- Add boolean/state for encrypted/plaintext; remove secret_tag references from write/read paths.

## UX/UI Considerations
- No changes to visible UI; ensure seamless save/load.

## Acceptance Criteria
- Client performs per-user encryption; server stores ciphertext and wrapped key.
- Backend no longer requires secret_tag identifiers.

## Dependencies
- PBI-2 (secret tags off by default).

## Open Questions
- Migration of existing secret-tag entries (Stage 1 compatibility).

## Related Tasks
- See tasks list for PBI 3.
