# OPAQUE Zero-Knowledge Implementation (Dual Authentication System)

## Overview

This document outlines the implementation of a dual authentication system with OPAQUE (Oblivious Pseudorandom Functions) for both **user authentication** and **secret tags**. This system ensures that:

1. **Dual user authentication** - OAuth (Google Sign-in) for convenience, OPAQUE for zero-knowledge security
2. **Universal secret tag protection** - OPAQUE authentication for all secret tags regardless of user auth method
3. **Server never sees passwords or secret phrases** - Only cryptographic envelopes are stored
4. **Client devices have no persistent evidence** - Tag handles are random, not derived from phrases
5. **Perfect forward secrecy** - Keys exist only in RAM during active sessions
6. **Traffic analysis resistance** - OPAQUE protocol obscures success/failure patterns

## 1. Dual Authentication Architecture

### 1.1 User Authentication Methods

| Method | Use Case | Storage | API Endpoints |
|--------|----------|---------|---------------|
| **OAuth (Google)** | Convenience, mainstream adoption | `google_id`, `opaque_envelope=NULL` | `/api/v1/auth/google` |
| **OPAQUE Password** | Zero-knowledge security | `opaque_envelope`, `google_id=NULL` | `/api/v1/auth/register/*`, `/api/v1/auth/login/*` |

### 1.2 Core Data Structures

| Concept | Fields | Purpose |
|---------|--------|---------|
| **User** | `id` (UUID), `google_id` (TEXT NULL), `opaque_envelope` (BYTEA NULL) | Dual authentication support |
| **Secret Tag** | `id` (UUID), `tag_handle` (32 bytes), `opaque_envelope` (BYTEA) | Clean OPAQUE secret tags |
| **Tag Session** | `id` (UUID), `user_id`, `tag_id`, `server_ephemeral` | Ephemeral authentication sessions |
| **Wrapped Key** | `tag_id` (UUID), `vault_id` (UUID), `wrapped_key` (40 bytes) | Maps secret tags to encrypted vaults |
| **Vault Blob** | `vault_id`, `object_id`, `iv`, `ciphertext`, `auth_tag` | Encrypted journal entries |

### 1.3 Database Schema

```sql
-- Users table with dual authentication support
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email CITEXT UNIQUE NOT NULL,
    
    -- OAuth authentication (Google Sign-in)
    google_id TEXT UNIQUE NULL,
    
    -- OPAQUE authentication (zero-knowledge passwords)
    opaque_envelope BYTEA NULL,
    
    -- Secret tag preferences
    show_secret_tag_names BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- ... 30+ other user profile fields preserved ...
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraint: exactly one authentication method
    CONSTRAINT user_auth_method CHECK (
        (google_id IS NOT NULL AND opaque_envelope IS NULL) OR
        (google_id IS NULL AND opaque_envelope IS NOT NULL)
    )
);

-- Secret tags with clean OPAQUE implementation
CREATE TABLE secret_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Clean OPAQUE approach - random handle chosen by client
    tag_handle BYTEA(32) UNIQUE NOT NULL,  -- 32 random bytes, not derived from phrase
    opaque_envelope BYTEA NOT NULL,        -- OPAQUE registration envelope
    
    -- Tag metadata
    tag_name TEXT NOT NULL,
    color TEXT NULL,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_secret_tags_user (user_id),
    INDEX idx_secret_tags_handle (tag_handle),
    CONSTRAINT unique_user_secret_tag UNIQUE (user_id, tag_name)
);

-- Ephemeral tag authentication sessions
CREATE TABLE tag_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    tag_id UUID NOT NULL REFERENCES secret_tags(id),
    server_ephemeral BYTEA NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_tag_sessions_user (user_id),
    INDEX idx_tag_sessions_tag (tag_id),
    INDEX idx_tag_sessions_created (created_at)
);

-- AES-KW wrapped data encryption keys
CREATE TABLE wrapped_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag_id UUID NOT NULL REFERENCES secret_tags(id),
    vault_id UUID NOT NULL,
    wrapped_key BYTEA(40) NOT NULL,  -- AES-256 key wrapped with AES-KW
    key_purpose TEXT NOT NULL DEFAULT 'vault_data',
    key_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_wrapped_keys_tag (tag_id),
    INDEX idx_wrapped_keys_vault (vault_id)
);

-- Encrypted content blobs
CREATE TABLE vault_blobs (
    vault_id UUID NOT NULL,
    object_id UUID NOT NULL,
    wrapped_key_id UUID NOT NULL REFERENCES wrapped_keys(id),
    iv BYTEA(12) NOT NULL,           -- AES-GCM IV
    ciphertext BYTEA NOT NULL,       -- Encrypted content
    auth_tag BYTEA(16) NOT NULL,     -- AES-GCM authentication tag
    content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
    content_size INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (vault_id, object_id),
    INDEX idx_vault_blobs_vault (vault_id),
    INDEX idx_vault_blobs_wrapped_key (wrapped_key_id)
);
```

## 2. Authentication Flows

### 2.1 User Authentication (Dual Methods)

#### OAuth Authentication (Google Sign-in)
```typescript
// Frontend OAuth flow
const googleAuthResponse = await GoogleSignin.signIn();
const response = await fetch('/api/v1/auth/google', {
  method: 'POST',
  body: JSON.stringify({ token: googleAuthResponse.idToken })
});
// Returns: { access_token, refresh_token, user }
```

#### OPAQUE User Authentication
```typescript
// Registration
const { clientRegistrationState, registrationRequest } = 
  opaque.client.startRegistration({ password: userPassword });

const startResponse = await fetch('/api/v1/auth/register/start', {
  method: 'POST',
  body: JSON.stringify({ 
    email: userEmail,
    opaque_registration_request: registrationRequest 
  })
});

const { registrationRecord } = opaque.client.finishRegistration({
  clientRegistrationState,
  registrationResponse: startResponse.opaque_registration_response,
  password: userPassword
});

const finishResponse = await fetch('/api/v1/auth/register/finish', {
  method: 'POST',
  body: JSON.stringify({
    email: userEmail,
    opaque_registration_record: registrationRecord
  })
});
// Returns: { access_token, refresh_token, user }

// Login (similar two-round flow via /api/v1/auth/login/start and /api/v1/auth/login/finish)
```

### 2.2 Secret Tag Authentication (Always OPAQUE)

**Key Point**: Secret tags use OPAQUE authentication regardless of how the user authenticated to the application.

#### Secret Tag Registration
```typescript
// 1. Generate random 32-byte tag handle
const tagHandle = crypto.getRandomValues(new Uint8Array(32));

// 2. Start OPAQUE registration for the secret tag
const { clientRegistrationState, registrationRequest } = 
  opaque.client.startRegistration({ password: secretPhrase });

const startResponse = await fetch('/api/v1/secret-tags/register/start', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${userAccessToken}` },
  body: JSON.stringify({
    tag_handle: Array.from(tagHandle),
    tag_name: "My Secret Tag",
    color: "#FF5733",
    opaque_registration_request: registrationRequest
  })
});

// 3. Complete registration
const { registrationRecord } = opaque.client.finishRegistration({
  clientRegistrationState,
  registrationResponse: startResponse.opaque_registration_response,
  password: secretPhrase
});

const finishResponse = await fetch('/api/v1/secret-tags/register/finish', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${userAccessToken}` },
  body: JSON.stringify({
    session_id: startResponse.session_id,
    opaque_registration_record: registrationRecord
  })
});
// Returns: { success: true, tag: { id, tag_handle, tag_name, color } }
```

#### Secret Tag Authentication
```typescript
// 1. Start OPAQUE authentication
const { clientLoginState, startLoginRequest } = 
  opaque.client.startLogin({ password: secretPhrase });

const authStartResponse = await fetch(`/api/v1/secret-tags/${tagId}/auth/start`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${userAccessToken}` },
  body: JSON.stringify({
    client_credential_request: startLoginRequest
  })
});

// 2. Complete authentication
const finishLoginRequest = opaque.client.finishLogin({
  clientLoginState,
  loginResponse: authStartResponse.server_credential_response,
  password: secretPhrase
});

const authFinishResponse = await fetch(`/api/v1/secret-tags/${tagId}/auth/finish`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${userAccessToken}` },
  body: JSON.stringify({
    session_id: authStartResponse.session_id,
    client_credential_response: finishLoginRequest
  })
});
// Returns: { success: true, tag_access_token: "jwt_token_for_vault_access" }
```

## 3. Security Properties

### 3.1 Zero-Knowledge Guarantees
- **User passwords**: Server stores only OPAQUE envelopes, never learns passwords
- **Secret phrases**: Server stores only OPAQUE envelopes, never learns phrases  
- **Tag handles**: Random 32-byte identifiers, not derived from phrases
- **Perfect forward secrecy**: Session keys exist only in RAM

### 3.2 Plausible Deniability
- Server cannot enumerate secret tags (random handles)
- Users can hide tag names (`show_secret_tag_names = false`)
- Traffic analysis resistance through OPAQUE protocol

### 3.3 Timing Attack Prevention
- Constant 100ms minimum response time on all OPAQUE endpoints
- Consistent authentication flows regardless of success/failure

## 4. Token Strategy

| Token Type | Scope | Lifetime | Usage |
|------------|-------|----------|-------|
| `access_token` | User APIs (profile, journals, tag metadata) | 30 minutes | Standard API access |
| `refresh_token` | Token renewal | 30 days | Mint new access tokens |
| `tag_access_token` | Encrypted vault access | 5 minutes | CRUD on encrypted entries |

All tokens are RS256-signed JWTs. The `tag_access_token.sub` contains the `tag_id`.

## 5. Implementation Notes

### 5.1 OPAQUE Library
- **Backend**: `@serenity-kit/opaque` via Node.js subprocess
- **Frontend**: `@serenity-kit/opaque` React Native bindings
- **Protocol**: OPAQUE v1.0 specification compliance

### 5.2 Key Derivation
- **Tag handles**: `crypto.getRandomValues(new Uint8Array(32))`  
- **Vault keys**: AES-256 keys derived from OPAQUE authentication
- **Key wrapping**: AES-KW (RFC 3394) for key storage

### 5.3 Encryption
- **Algorithm**: AES-256-GCM for all encrypted content
- **IV generation**: Cryptographically secure random per operation
- **Authentication**: Built-in AEAD authentication with AES-GCM

## 6. Migration from Legacy System

The previous system used `phrase_hash` derived from secret phrases. The new system uses:
- **Random tag handles**: No derivation from phrases
- **Clean OPAQUE**: No legacy `salt`, `verifier_kv` fields
- **Unified API**: All authentication under `/api/v1/*`

Migration preserves all user data while upgrading to the secure architecture. 