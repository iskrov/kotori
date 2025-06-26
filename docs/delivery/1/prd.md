# PBI-1: OPAQUE Cryptographic Foundation

[View in Backlog](../backlog.md#user-content-PBI-1)

## Overview

Implement the cryptographic foundation for OPAQUE-based zero-knowledge authentication, including key derivation, OPAQUE protocol integration, and secure memory management. This PBI establishes the core cryptographic primitives needed for true zero-knowledge secret tag authentication.

## Problem Statement

The current Argon2-based secret tag system has fundamental security limitations:
- Server can observe authentication attempts and patterns
- Client stores secret tag metadata locally, creating forensic evidence
- Network traffic analysis reveals secret tag usage patterns
- No perfect forward secrecy or session isolation

OPAQUE protocol solves these issues by providing password-authenticated key exchange where the server learns nothing about the authentication process or user secrets.

## User Stories

**Primary User Story:**
As a security engineer, I want to implement OPAQUE cryptographic foundation so that the system can provide true zero-knowledge authentication without server-side knowledge of secret phrases.

**Supporting User Stories:**
- As a developer, I want standardized cryptographic utilities so that all encryption operations use secure, consistent implementations
- As a security auditor, I want well-documented key derivation schedules so that I can verify the cryptographic security properties
- As a user, I want deterministic TagID generation so that my secret phrases work consistently without requiring client-side storage

## Technical Approach

### Core Components

1. **OPAQUE Library Integration**
   - Research and select production-ready OPAQUE implementation
   - Verify RFC compliance and security audit status
   - Test performance on mobile devices

2. **Deterministic Key Derivation**
   ```typescript
   function deriveKeys(phrase: string, salt: Uint8Array): KeyMaterial {
     const S = argon2id(phrase, salt, { memoryCost: 64*1024, timeCost: 3 });
     const Kv = hkdf(S, "OPAQUE-VERIFY", 32);   // Server verifier key
     const Ke = hkdf(S, "VAULT-ENCRYPT", 32);   // Client encryption key
     const tagId = blake2s(phrase, 16);         // Deterministic identifier
     return { Kv, Ke, tagId, S };
   }
   ```

3. **Secure Memory Management**
   - Automatic key erasure on timeout
   - Secure random number generation
   - Memory leak prevention for sensitive data

4. **AES-KW Key Wrapping**
   - Wrap vault data keys with phrase-derived keys
   - Secure key unwrapping during authentication
   - Error handling for invalid wraps

### Cryptographic Primitives

| Primitive | Purpose | Specification |
|-----------|---------|---------------|
| Argon2id | Memory-hard phrase stretching | RFC 9106 |
| HKDF-SHA-256 | Key derivation and context split | RFC 5869 |
| OPAQUE | Zero-knowledge authentication | draft-irtf-cfrg-opaque-18 |
| AES-KW | Data key wrapping | NIST SP 800-38F §3 |
| BLAKE2s | TagID generation | RFC 7693 |

## UX/UI Considerations

- No user-visible changes in this PBI (foundation layer)
- Performance requirements: Key derivation must complete in <500ms on mobile
- Error handling must be transparent to user experience
- Memory usage must not impact app performance

## Acceptance Criteria

1. **OPAQUE Integration**
   - [ ] OPAQUE library selected and integrated in both frontend and backend
   - [ ] OPAQUE registration and authentication flows working end-to-end
   - [ ] Performance benchmarks meet mobile device requirements (<500ms auth)

2. **Key Derivation**
   - [ ] Deterministic key schedule implemented and tested
   - [ ] TagID generation produces consistent 128-bit identifiers
   - [ ] Key derivation parameters optimized for mobile (1 iteration) and desktop (3 iterations)

3. **Secure Memory Management**
   - [ ] All sensitive keys automatically cleared after use
   - [ ] Memory leak detection passes for cryptographic operations
   - [ ] Session timeout properly erases all key material

4. **Testing and Validation**
   - [ ] Cryptographic test suite covers all key derivation paths
   - [ ] Cross-platform consistency verified (iOS/Android/Web)
   - [ ] Performance testing on low-end mobile devices passes

## Dependencies

- **External Libraries**: OPAQUE implementation library selection
- **Platform Support**: React Native crypto APIs and Node.js backend crypto
- **Performance Requirements**: Mobile device testing infrastructure

## Open Questions

1. **OPAQUE Library Selection**: Which JavaScript/TypeScript OPAQUE implementation provides the best balance of security, performance, and maintenance?
2. **Mobile Performance**: What Argon2id parameters provide optimal security/performance balance on low-end mobile devices?
3. **Key Storage**: How to best implement secure key erasure across different JavaScript engines and platforms?

## Related Tasks

[View Task List](./tasks.md) 