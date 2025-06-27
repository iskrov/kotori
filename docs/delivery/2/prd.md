# PBI-2: Clean OPAQUE Server Infrastructure

[View in Backlog](../backlog.md#user-content-PBI-2)

## Overview

Implement clean server-side infrastructure for OPAQUE-based zero-knowledge authentication, replacing the existing V2 system entirely. This includes database schema for OPAQUE verifiers, authentication endpoints, and encrypted vault blob storage. The implementation will completely replace legacy authentication code.

## Problem Statement

The current server infrastructure uses outdated security approaches that need complete replacement:
- V2 system stores Argon2 hashes allowing server to observe authentication attempts
- Legacy code creates maintenance burden and security vulnerabilities
- Database compromise can reveal secret tag structure and metadata
- No support for perfect forward secrecy or session isolation
- Vulnerable to traffic analysis attacks

The new clean OPAQUE-based infrastructure will store only cryptographic verifiers that reveal nothing about user secrets, with all legacy code removed.

## User Stories

**Primary User Story:**
As a backend developer, I want to implement clean OPAQUE server infrastructure so that the system uses only zero-knowledge authentication without legacy code.

**Supporting User Stories:**
- As a security engineer, I want OPAQUE-only authentication so that no legacy vulnerabilities remain
- As a developer, I want clean codebase so that maintenance is simplified and security is improved
- As a DBA, I want efficient vault blob storage so that encrypted content can be stored and retrieved performantly
- As a compliance officer, I want audit logs so that authentication events can be monitored without revealing sensitive data

## Technical Approach

### Clean Database Schema (V3 Only)

1. **OPAQUE Secret Tags Table** (replaces secret_tags)
   ```sql
   CREATE TABLE secret_tags (
       tag_id BYTEA(16) PRIMARY KEY,          -- Deterministic from Hash(phrase)
       user_id UUID NOT NULL,
       salt BYTEA(16) NOT NULL,               -- Random salt for OPAQUE
       verifier_kv BYTEA(32) NOT NULL,        -- OPAQUE verifier only
       opaque_envelope BYTEA NOT NULL,        -- OPAQUE registration data
       tag_name VARCHAR(100) NOT NULL,        -- User-friendly name
       color_code VARCHAR(7) DEFAULT '#007AFF',
       created_at TIMESTAMP DEFAULT NOW(),
       updated_at TIMESTAMP DEFAULT NOW(),
       INDEX idx_user_tags (user_id),
       INDEX idx_tag_lookup (tag_id)
   );
   ```

2. **Wrapped Keys Table**
   ```sql
   CREATE TABLE wrapped_keys (
       id UUID PRIMARY KEY,
       tag_id BYTEA(16) NOT NULL,
       vault_id UUID NOT NULL,
       wrapped_key BYTEA(40) NOT NULL,        -- AES-KW wrapped data key
       key_purpose VARCHAR(50) DEFAULT 'vault_data',
       created_at TIMESTAMP DEFAULT NOW()
   );
   ```

3. **Vault Blobs Table**
   ```sql
   CREATE TABLE vault_blobs (
       vault_id UUID NOT NULL,
       object_id UUID NOT NULL,
       iv BYTEA(12) NOT NULL,                 -- AES-GCM IV
       ciphertext BYTEA NOT NULL,             -- Encrypted content only
       auth_tag BYTEA(16) NOT NULL,           -- AES-GCM authentication tag
       created_at TIMESTAMP DEFAULT NOW(),
       PRIMARY KEY (vault_id, object_id)
   );
   ```

### Clean API Design (V3 Only)

1. **OPAQUE Registration**
   - `POST /api/secret-tags/register`
   - Stores OPAQUE envelope and verifier
   - Creates initial wrapped keys for vault access

2. **OPAQUE Authentication Flow**
   - `POST /api/secret-tags/auth/init` - Start authentication
   - `POST /api/secret-tags/auth/finalize` - Complete authentication
   - Returns wrapped keys on successful authentication

3. **Vault Operations**
   - `POST /api/vaults/upload` - Store encrypted blobs
   - `GET /api/vaults/{vault_id}/objects` - Retrieve encrypted blobs

### Legacy Code Removal

- Remove all V1/V2 authentication endpoints
- Remove Argon2 hash-based authentication
- Remove legacy secret_tags table and models
- Update all references to use OPAQUE-only authentication
- Clean up unused cryptographic utilities

## UX/UI Considerations

- No user-visible changes (backend infrastructure)
- API response times must remain <200ms for authentication endpoints
- Error responses must not leak information about authentication success/failure
- Clean API design without version complexity

## Acceptance Criteria

1. **Clean Database Schema**
   - [ ] OPAQUE tables created with proper constraints and indexes
   - [ ] Legacy tables completely removed
   - [ ] Vault blob storage supports efficient upload/download operations
   - [ ] Database performance meets or exceeds current system requirements

2. **OPAQUE Authentication Endpoints**
   - [ ] Registration endpoint stores OPAQUE envelopes securely
   - [ ] Authentication flow implements full OPAQUE protocol correctly
   - [ ] Session management prevents replay attacks and ensures isolation
   - [ ] Error handling provides no information leakage
   - [ ] All legacy authentication endpoints removed

3. **Vault Operations**
   - [ ] Encrypted blob upload/download working efficiently
   - [ ] Access control ensures only authenticated sessions can access vaults
   - [ ] Storage optimization minimizes database size impact
   - [ ] Cleanup procedures remove orphaned vault data

4. **Legacy Code Cleanup**
   - [ ] All V1/V2 authentication code removed
   - [ ] Legacy database tables dropped
   - [ ] Codebase contains only OPAQUE-based authentication
   - [ ] No unused cryptographic utilities remain

5. **Security Validation**
   - [ ] Database compromise simulation reveals no recoverable secrets
   - [ ] Traffic analysis resistance verified through network monitoring
   - [ ] Authentication timing is constant regardless of success/failure
   - [ ] Session state properly isolated between users and authentication attempts

## Dependencies

- **PBI-1**: OPAQUE cryptographic foundation must be completed first
- **Data Cleanup**: Test data can be safely removed and recreated
- **Voice Workflow**: Voice recording and entry editing must work with new authentication
- **API Consistency**: Frontend must be updated to use new authentication flow

## Open Questions

1. **Test Data**: How to handle existing test data during clean implementation?
2. **Session Management**: How long should OPAQUE authentication sessions remain valid?
3. **Cleanup Procedures**: What automated cleanup is needed for orphaned vault blobs and expired sessions?
4. **Voice Integration**: How to ensure voice workflows work seamlessly with OPAQUE authentication?

## Related Tasks

[View Task List](./tasks.md) 