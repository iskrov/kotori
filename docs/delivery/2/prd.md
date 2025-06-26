# PBI-2: Zero-Knowledge Server Infrastructure

[View in Backlog](../backlog.md#user-content-PBI-2)

## Overview

Implement the server-side infrastructure for OPAQUE-based zero-knowledge authentication, including database schema for OPAQUE verifiers, authentication endpoints, and encrypted vault blob storage. This PBI ensures the server can authenticate users without storing any secret information.

## Problem Statement

The current server infrastructure stores Argon2 hashes and allows the server to observe authentication attempts, creating security vulnerabilities:
- Server can track authentication success/failure patterns
- Database compromise reveals secret tag structure and metadata
- No support for perfect forward secrecy or session isolation
- Vulnerable to traffic analysis attacks

The new OPAQUE-based infrastructure must store only cryptographic verifiers that reveal nothing about user secrets, even under database compromise.

## User Stories

**Primary User Story:**
As a backend developer, I want to implement zero-knowledge server infrastructure so that the server can authenticate users without storing any secret information.

**Supporting User Stories:**
- As a security engineer, I want OPAQUE verifier storage so that database compromise reveals no user secrets
- As a DBA, I want efficient vault blob storage so that encrypted content can be stored and retrieved performantly
- As a developer, I want clean API endpoints so that OPAQUE authentication integrates seamlessly with existing code
- As a compliance officer, I want audit logs so that authentication events can be monitored without revealing sensitive data

## Technical Approach

### Database Schema Design

1. **OPAQUE Secret Tags Table**
   ```sql
   CREATE TABLE secret_tags_v3 (
       tag_id BYTEA(16) PRIMARY KEY,          -- Deterministic from Hash(phrase)
       user_id UUID NOT NULL,
       salt BYTEA(16) NOT NULL,               -- Random salt for Argon2id
       verifier_kv BYTEA(32) NOT NULL,        -- OPAQUE verifier only
       opaque_envelope BYTEA NOT NULL,        -- OPAQUE registration data
       created_at TIMESTAMP DEFAULT NOW(),
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
       created_at TIMESTAMP DEFAULT NOW(),
       PRIMARY KEY (vault_id, object_id)
   );
   ```

### API Endpoints

1. **OPAQUE Registration**
   - `POST /api/v3/secret-tags/register`
   - Stores OPAQUE envelope and verifier
   - Creates initial wrapped keys for vault access

2. **OPAQUE Authentication Flow**
   - `POST /api/v3/secret-tags/auth/init` - Start authentication
   - `POST /api/v3/secret-tags/auth/finalize` - Complete authentication
   - Returns wrapped keys on successful authentication

3. **Vault Operations**
   - `POST /api/v3/vaults/upload` - Store encrypted blobs
   - `GET /api/v3/vaults/{vault_id}/objects` - Retrieve encrypted blobs

### Security Properties

- **Zero-Knowledge**: Server never sees plaintext phrases or authentication results
- **Verifier-Only Storage**: Only OPAQUE verifiers stored, no recoverable secrets
- **Session Isolation**: Each authentication creates isolated session state
- **Forward Secrecy**: Past sessions remain secure even if current session compromised

## UX/UI Considerations

- No user-visible changes (backend infrastructure)
- API response times must remain <200ms for authentication endpoints
- Error responses must not leak information about authentication success/failure
- Graceful degradation if OPAQUE authentication fails

## Acceptance Criteria

1. **Database Schema**
   - [ ] OPAQUE verifier tables created with proper constraints and indexes
   - [ ] Migration path from existing secret_tags table implemented
   - [ ] Vault blob storage supports efficient upload/download operations
   - [ ] Database performance meets current system requirements

2. **OPAQUE Authentication Endpoints**
   - [ ] Registration endpoint stores OPAQUE envelopes securely
   - [ ] Authentication flow implements full OPAQUE protocol correctly
   - [ ] Session management prevents replay attacks and ensures isolation
   - [ ] Error handling provides no information leakage

3. **Vault Operations**
   - [ ] Encrypted blob upload/download working efficiently
   - [ ] Access control ensures only authenticated sessions can access vaults
   - [ ] Storage optimization minimizes database size impact
   - [ ] Cleanup procedures remove orphaned vault data

4. **Security Validation**
   - [ ] Database compromise simulation reveals no recoverable secrets
   - [ ] Traffic analysis resistance verified through network monitoring
   - [ ] Authentication timing is constant regardless of success/failure
   - [ ] Session state properly isolated between users and authentication attempts

## Dependencies

- **PBI-1**: OPAQUE cryptographic foundation must be completed first
- **Database Migration**: Requires coordination with existing secret tags system
- **API Versioning**: Must maintain backward compatibility during transition
- **Performance Requirements**: Must not degrade current system performance

## Open Questions

1. **Migration Strategy**: How to handle existing users during transition from V2 to V3 system?
2. **Performance Impact**: What is the storage and performance impact of OPAQUE verifiers vs Argon2 hashes?
3. **Session Management**: How long should OPAQUE authentication sessions remain valid?
4. **Cleanup Procedures**: What automated cleanup is needed for orphaned vault blobs and expired sessions?

## Related Tasks

[View Task List](./tasks.md) 