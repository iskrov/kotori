# Tasks for PBI 3: Phase 3 — Per-user encryption without secret tags

This document lists all tasks associated with PBI 3.

**Parent PBI**: [PBI 3: Phase 3 — Per-user encryption without secret tags](./prd.md)

## Task Summary

| Task ID | Name | Status | Description |
| :------ | :--------------------------------------- | :------- | :--------------------------------- |
| 3-1 | [Client per-user key derivation](./3-1.md) | Done | Derive user master key from OPAQUE client-side. |
| 3-2 | [Update API serializers/validators](./3-2.md) | Done | Remove secret_tag from payloads; add encrypted flag. |
| 3-3 | [Backend read/write path updates](./3-3.md) | Done | Journal endpoints handle per-user encryption metadata. |
| 3-4 | [E2E CoS Test](./3-4.md) | Done | End-to-end verification of per-user encryption.
