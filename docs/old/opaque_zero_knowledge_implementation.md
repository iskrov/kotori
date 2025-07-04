# OPAQUE Zero-Knowledge Secret Tags Implementation

## Overview

This document outlines the implementation of a cryptographically secure secret tags system using OPAQUE (Oblivious Pseudorandom Functions) to achieve true zero-knowledge encryption. This system ensures that:

1. **Server never sees secret phrases or content** - Only cryptographic verifiers and wrapped keys are stored
2. **Client devices have no persistent evidence** - TagIDs are derived deterministically from spoken phrases
3. **Perfect forward secrecy** - Keys exist only in RAM during active sessions
4. **Traffic analysis resistance** - OPAQUE protocol obscures success/failure patterns
5. **Duress protection** - Support for fake vaults and panic modes

## 1. Conceptual Objects

### 1.1 Core Data Structures

| Concept | Fields | Purpose |
|---------|--------|---------|
| **User** | `user_id` (UUID) | Stable user identifier |
| **Secret Tag** | `tag_id` (16 bytes), `salt` (16 bytes), `verifier_kv` (32 bytes) | One per secret phrase, stores OPAQUE verifier |
| **Wrapped Key** | `tag_id`, `vault_id`, `wrapped_key` (40 bytes) | Maps secret tags to encrypted data vaults |
| **Vault Blob** | `vault_id`, `object_id`, `iv`, `ciphertext` | Encrypted journal entries and metadata |

### 1.2 Database Schema

```sql
-- Users table (existing)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    -- other user fields...
);

-- Secret tags with OPAQUE verifiers
CREATE TABLE secret_tags_v3 (
    tag_id BYTEA(16) PRIMARY KEY,           -- Deterministic from Hash(phrase)
    user_id UUID NOT NULL REFERENCES users(id),
    salt BYTEA(16) NOT NULL,                -- Random salt for Argon2id
    verifier_kv BYTEA(32) NOT NULL,         -- OPAQUE verifier (server-side)
    opaque_envelope BYTEA NOT NULL,         -- OPAQUE registration envelope
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_user_tags (user_id),
    INDEX idx_tag_lookup (tag_id)
);

-- Wrapped keys mapping tags to vaults
CREATE TABLE wrapped_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag_id BYTEA(16) NOT NULL REFERENCES secret_tags_v3(tag_id),
    vault_id UUID NOT NULL,
    wrapped_key BYTEA(40) NOT NULL,         -- AES-KW wrapped data key
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_tag_keys (tag_id),
    INDEX idx_vault_keys (vault_id)
);

-- Encrypted vault blobs
CREATE TABLE vault_blobs (
    vault_id UUID NOT NULL,
    object_id UUID NOT NULL,
    iv BYTEA(12) NOT NULL,                  -- AES-GCM IV
    ciphertext BYTEA NOT NULL,              -- Encrypted journal entry
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (vault_id, object_id),
    INDEX idx_vault_objects (vault_id),
    INDEX idx_object_lookup (object_id)
);
```

## 2. Cryptographic Toolkit

### 2.1 Standardized Primitives

| Purpose | Primitive | Specification |
|---------|-----------|---------------|
| **Memory-hard phrase stretch** | Argon2id (32-byte output) | RFC 9106 |
| **Key derivation / context split** | HKDF-SHA-256 | RFC 5869 |
| **Password-verifier PAKE** | OPAQUE (3-message flow) | draft-irtf-cfrg-opaque-18 |
| **Key wrap (encrypt DataKey)** | AES-KW | NIST SP 800-38F §3 |
| **Vault encryption** | AES-GCM-256 | NIST approved AEAD |

### 2.2 Key Derivation Schedule

```typescript
// Deterministic key schedule per secret phrase
function deriveKeys(phrase: string, salt: Uint8Array): KeyMaterial {
  // Step 1: Memory-hard stretching
  const S = argon2id(phrase, salt, {
    memoryCost: 64 * 1024,  // 64 MiB desktop
    timeCost: 3,            // 3 iterations desktop (1 for mobile)
    outputLength: 32
  });
  
  // Step 2: Context-specific key derivation
  const Kv = hkdf(S, "OPAQUE-VERIFY", 32);   // Server verifier key
  const Ke = hkdf(S, "VAULT-ENCRYPT", 32);   // Client encryption key
  
  // Step 3: Deterministic tag identifier
  const tagId = blake2s(phrase, 16);         // 128-bit, salt-free
  
  return { Kv, Ke, tagId, S };
}
```

## 3. API Contract

### 3.1 Secret Tag Registration

```typescript
// POST /api/v3/secret-tags/register
interface RegisterSecretTagRequest {
  user_id: string;
  tag_id: Uint8Array;           // 16 bytes from Hash(phrase)
  salt: Uint8Array;             // 16 bytes random
  opaque_envelope: Uint8Array;  // OPAQUE registration data
}

interface RegisterSecretTagResponse {
  success: boolean;
  tag_id: string;               // Hex-encoded for client reference
}
```

### 3.2 OPAQUE Authentication Flow

```typescript
// POST /api/v3/secret-tags/auth/init
interface OpaqueAuthInitRequest {
  user_id: string;
  tag_id: Uint8Array;           // 16 bytes
  client_msg1: Uint8Array;      // OPAQUE CredentialRequest
}

interface OpaqueAuthInitResponse {
  server_msg1: Uint8Array;      // OPAQUE CredentialResponse
  session_id: string;           // For subsequent calls
}

// POST /api/v3/secret-tags/auth/finalize
interface OpaqueAuthFinalizeRequest {
  session_id: string;
  client_msg2: Uint8Array;      // OPAQUE AuthRequest
}

interface OpaqueAuthFinalizeResponse {
  success: boolean;
  wrapped_keys: WrappedKey[];   // All keys for this tag
  server_msg2: Uint8Array;      // OPAQUE AuthResponse
}
```

### 3.3 Vault Blob Operations

```typescript
// POST /api/v3/vaults/upload
interface VaultUploadRequest {
  vault_id: string;
  object_id: string;
  iv: Uint8Array;               // 12 bytes for AES-GCM
  ciphertext: Uint8Array;       // Encrypted journal entry
}

// GET /api/v3/vaults/{vault_id}/objects
interface VaultDownloadResponse {
  objects: VaultObject[];
}

interface VaultObject {
  object_id: string;
  iv: Uint8Array;
  ciphertext: Uint8Array;
  created_at: string;
}
```

## 4. Implementation Flows

### 4.1 Creating a New Secret Tag

```typescript
async function createSecretTag(phrase: string, tagName: string): Promise<string> {
  // 1. Generate cryptographic material
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const { Kv, Ke, tagId } = deriveKeys(phrase, salt);
  
  // 2. OPAQUE registration
  const opaque = new OpaqueClient();
  const registrationRequest = opaque.createRegistrationRequest(phrase);
  const registrationResponse = await api.post('/opaque/register', {
    request: registrationRequest
  });
  const envelope = opaque.finalizeRegistration(registrationResponse);
  
  // 3. Register tag on server
  await api.post('/api/v3/secret-tags/register', {
    user_id: getCurrentUserId(),
    tag_id: tagId,
    salt: salt,
    opaque_envelope: envelope
  });
  
  // 4. Create first vault and wrapped key
  const dataKey = crypto.getRandomValues(new Uint8Array(32));
  const vaultId = crypto.randomUUID();
  const wrappedKey = aesKeyWrap(Ke, dataKey);
  
  await api.post('/api/v3/wrapped-keys', {
    tag_id: tagId,
    vault_id: vaultId,
    wrapped_key: wrappedKey
  });
  
  // 5. Clear sensitive material
  Ke.fill(0);
  dataKey.fill(0);
  
  return vaultId;
}
```

### 4.2 Voice-Triggered Authentication

```typescript
async function authenticateSecretPhrase(phrase: string): Promise<AuthResult> {
  try {
    // 1. Derive tag ID deterministically
    const tagId = blake2s(phrase, 16);
    
    // 2. Start OPAQUE authentication
    const opaque = new OpaqueClient();
    const credentialRequest = opaque.createCredentialRequest(phrase);
    
    const initResponse = await api.post('/api/v3/secret-tags/auth/init', {
      user_id: getCurrentUserId(),
      tag_id: tagId,
      client_msg1: credentialRequest
    });
    
    // 3. Complete OPAQUE flow
    const authRequest = opaque.createAuthRequest(initResponse.server_msg1);
    
    const finalResponse = await api.post('/api/v3/secret-tags/auth/finalize', {
      session_id: initResponse.session_id,
      client_msg2: authRequest
    });
    
    if (!finalResponse.success) {
      // Authentication failed - treat as regular text
      return { authenticated: false, phrase };
    }
    
    // 4. Derive encryption key and unwrap data keys
    const salt = await getTagSalt(tagId); // From server
    const { Ke } = deriveKeys(phrase, salt);
    
    const dataKeys = finalResponse.wrapped_keys.map(wk => ({
      vaultId: wk.vault_id,
      dataKey: aesKeyUnwrap(Ke, wk.wrapped_key)
    }));
    
    // 5. Store in secure memory for session
    setActiveSecretSession({
      tagId,
      dataKeys,
      expiresAt: Date.now() + (5 * 60 * 1000) // 5 minutes
    });
    
    // 6. Clear key material
    Ke.fill(0);
    
    return { 
      authenticated: true, 
      tagId: tagId.toString('hex'),
      vaultIds: dataKeys.map(dk => dk.vaultId)
    };
    
  } catch (error) {
    // Any error means treat as regular text
    logger.debug('OPAQUE authentication failed:', error);
    return { authenticated: false, phrase };
  }
}
```

### 4.3 Encrypted Journal Entry Storage

```typescript
async function saveSecretJournalEntry(content: string, vaultId: string): Promise<void> {
  const session = getActiveSecretSession();
  if (!session || session.expiresAt < Date.now()) {
    throw new Error('No active secret session');
  }
  
  const dataKey = session.dataKeys.find(dk => dk.vaultId === vaultId)?.dataKey;
  if (!dataKey) {
    throw new Error('No data key for vault');
  }
  
  // Encrypt content
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(content);
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await crypto.subtle.importKey('raw', dataKey, 'AES-GCM', false, ['encrypt']),
    plaintext
  );
  
  // Upload to server
  await api.post('/api/v3/vaults/upload', {
    vault_id: vaultId,
    object_id: crypto.randomUUID(),
    iv: Array.from(iv),
    ciphertext: Array.from(new Uint8Array(ciphertext))
  });
}
```

## 5. Security Properties

### 5.1 Zero-Knowledge Server
- Server stores only OPAQUE verifiers and wrapped keys
- No access to secret phrases, encryption keys, or plaintext content
- Database compromise reveals no secrets without client cooperation

### 5.2 Device Deniability  
- No persistent storage of secret material on client
- TagIDs derived deterministically from spoken phrases only
- Device inspection reveals no evidence of secret functionality

### 5.3 Perfect Forward Secrecy
- Encryption keys exist only in RAM during active sessions
- Automatic timeout and key erasure
- Past sessions remain secure even if current session is compromised

### 5.4 Traffic Analysis Resistance
- OPAQUE protocol obscures authentication success/failure
- Cover traffic through periodic dummy authentications
- Uniform blob sizes and timing patterns

## 6. Migration Strategy

### 6.1 Phase 1: Parallel Implementation
- Implement OPAQUE system alongside current Argon2 system
- New secret tags use OPAQUE, existing tags remain functional
- Gradual user migration with clear security benefits

### 6.2 Phase 2: Data Migration
- Provide migration tool for existing secret tags
- Require re-entry of secret phrases (security necessity)
- Backup and restore encrypted vault data

### 6.3 Phase 3: Legacy Cleanup
- Remove Argon2-based secret tag system
- Clean up database schema and API endpoints
- Update documentation and user guides

## 7. Implementation Timeline

### Week 1-2: Cryptographic Foundation
- Implement OPAQUE client library integration
- Set up key derivation and wrapping functions
- Create secure memory management utilities

### Week 3-4: Server Infrastructure  
- Database schema migration
- OPAQUE authentication endpoints
- Vault blob storage and retrieval

### Week 5-6: Client Integration
- Voice phrase detection and authentication
- Encrypted journal entry creation/retrieval
- Session management and timeout handling

### Week 7-8: Security Hardening
- Cover traffic implementation
- Duress/panic mode support
- Security audit and penetration testing

### Week 9-10: Migration and Deployment
- User migration tools and documentation
- Gradual rollout with feature flags
- Performance monitoring and optimization

## 8. Testing Strategy

### 8.1 Cryptographic Testing
- OPAQUE protocol compliance verification
- Key derivation determinism testing
- Encryption/decryption round-trip validation

### 8.2 Security Testing
- Memory leak detection for sensitive data
- Timing attack resistance verification
- Traffic analysis simulation

### 8.3 Integration Testing
- End-to-end voice-to-encryption flows
- Multi-device session management
- Database corruption recovery

## 9. Operational Considerations

### 9.1 Performance Optimization
- Argon2id parameter tuning for mobile devices
- OPAQUE computation caching strategies
- Vault blob compression and deduplication

### 9.2 Monitoring and Alerting
- Authentication failure rate monitoring
- Unusual access pattern detection
- Performance metric tracking

### 9.3 Backup and Recovery
- Encrypted vault backup procedures
- Secret tag recovery mechanisms
- Disaster recovery protocols

## 10. Future Enhancements

### 10.1 Advanced Features
- Multi-party secret sharing for recovery
- Hardware security module integration
- Quantum-resistant cryptography preparation

### 10.2 User Experience
- Biometric phrase confirmation
- Voice pattern analysis for additional security
- Seamless cross-device synchronization

This implementation provides a cryptographically sound foundation for zero-knowledge secret tags while maintaining usability and performance for the voice journaling application. 