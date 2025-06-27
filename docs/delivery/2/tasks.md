# Tasks for PBI 2: Clean OPAQUE Server Infrastructure

This document lists all tasks associated with PBI 2.

**Parent PBI**: [PBI 2: Clean OPAQUE Server Infrastructure](./prd.md)

## Task Summary

| Task ID | Name | Status | Description |
| :------ | :--- | :----- | :---------- |
| 2-1 | [Design Clean OPAQUE Database Schema](./2-1.md) | Done | Create clean database tables replacing legacy authentication with OPAQUE |
| 2-2 | [Remove Legacy Authentication Code](./2-2.md) | Done | Remove all V1/V2 authentication code and legacy database tables |
| 2-3 | [Create OPAQUE Registration Endpoint](./2-3.md) | Done | Implement API endpoint for OPAQUE secret tag registration |
| 2-4 | [Create OPAQUE Authentication Endpoints](./2-4.md) | Done | Implement init and finalize endpoints for OPAQUE authentication flow |
| 2-5 | [Implement Vault Blob Storage](./2-5.md) | Done | Create endpoints for encrypted vault blob upload and retrieval |
| 2-6 | [Implement Session Management](./2-6.md) | Done | Create secure session handling for OPAQUE authentication state |
| 2-7 | [Create OPAQUE Service Layer](./2-7.md) | Done | Implement business logic for OPAQUE operations and key management |
| 2-8 | [Implement Security Audit Logging](./2-8.md) | Done | Create audit logs for authentication events without information leakage |
| 2-10 | [Implement Cleanup and Maintenance](./2-10.md) | Done | Create automated cleanup for expired sessions and orphaned vault data | 