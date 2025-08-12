# PBI-9: Fix Encryption/Decryption for Journal Entries

## Overview

Currently, journal entries are being saved with client-side per-user encryption, but the decryption is not happening when entries are displayed. This results in users seeing only titles with "No content" for all their entries. This PBI addresses the complete encryption/decryption flow to ensure users can see their journal content while maintaining security through OPAQUE-derived encryption keys.

## Problem Statement

After the migration from Vibes to Kotori and removal of secret tags, the app uses per-user encryption but:
1. Encrypted content is stored correctly on the backend
2. The backend returns empty content fields (by design for encrypted entries)
3. The frontend is not decrypting entries when displaying them
4. Users see "No content" for all entries even though the encrypted data exists

## User Stories

**As a user:**
- I want to see my journal entry content after saving, not just the title
- I want my entries to remain encrypted on the server for privacy
- I want seamless encryption/decryption without manual key management
- I want my existing encrypted entries to remain accessible

**As a developer:**
- I want a clear, maintainable encryption/decryption architecture
- I want OPAQUE-derived keys to be properly managed
- I want the system to handle both new and existing encrypted entries

## Technical Approach

### Current State Analysis

The system currently:
- Uses OPAQUE authentication with export key capability
- Derives per-user master keys from OPAQUE export keys
- Encrypts each entry with a random AES-GCM key
- Wraps per-entry keys with the user's master key
- Stores encrypted_content, IV, wrapped_key, and wrap_iv on backend
- Backend returns empty content for encrypted entries (security by design)

### Proposed Solution: Phased Implementation

We'll implement the solution in phases to ensure stability and backward compatibility:

#### Phase 1: Fix Immediate Decryption (Option A)
- Implement client-side decryption in the UI layer
- Decrypt entries when fetching from API
- Minimal changes to existing architecture
- Quick fix for the immediate problem

#### Phase 2: Optimize Architecture (Option B)
- Move decryption to a service layer
- Implement caching for decrypted content
- Add proper error handling and recovery
- Performance optimizations

#### Phase 3: Enhanced Key Management (Option C)
- Implement key rotation capabilities
- Add backup key recovery mechanisms
- Support for multiple devices per user
- Key versioning for backward compatibility

#### Phase 4: Advanced Features (Options D & E)
- Consider server-side encryption options for specific use cases
- Implement sharing capabilities (if needed)
- Add search over encrypted content
- Performance optimizations for large datasets

## UX/UI Considerations

- Loading states while decrypting entries
- Error states if decryption fails
- Graceful degradation for corrupted entries
- Clear indicators for encryption status
- No user-visible key management complexity

## Acceptance Criteria

1. **Content Visibility**: Users can see their journal entry content, not just titles
2. **Encryption Maintained**: All entries remain encrypted on the server
3. **Backward Compatibility**: Existing encrypted entries can be decrypted
4. **Performance**: Decryption doesn't significantly impact app performance
5. **Error Handling**: Graceful handling of decryption failures
6. **Security**: No regression in security posture
7. **OPAQUE Integration**: Properly uses OPAQUE-derived keys

## Dependencies

- OPAQUE authentication system (existing)
- Client-side encryption service (existing, needs fixes)
- AsyncStorage for key persistence (existing)
- Web Crypto API (existing)

## Open Questions

1. Should we implement content caching for decrypted entries?
2. How should we handle entries that fail to decrypt?
3. Should we add a migration for existing entries?
4. Do we need key rotation immediately or can it wait?

## Related Tasks

See [Task List](./tasks.md) for detailed implementation tasks.

## Implementation Options Analysis

### Option A: Client-Side Decryption in UI (Phase 1)
**Approach**: Decrypt entries in components that display them
**Pros**: 
- Quick fix for immediate problem
- Minimal backend changes
- Maintains current security model
**Cons**: 
- Decryption happens multiple times
- No caching of decrypted content
- Performance impact on lists

### Option B: Service Layer Decryption (Phase 2)
**Approach**: Centralized decryption service with caching
**Pros**: 
- Better performance with caching
- Single point for decryption logic
- Easier to maintain
**Cons**: 
- More complex implementation
- Memory usage for cache
- Cache invalidation complexity

### Option C: Enhanced Key Management (Phase 3)
**Approach**: Add key rotation, versioning, and recovery
**Pros**: 
- Better security posture
- Support for key compromise scenarios
- Multi-device support
**Cons**: 
- Complex key versioning
- Migration complexity
- More storage requirements

### Option D: Hybrid Encryption (Future)
**Approach**: Server-side encryption for some features
**Pros**: 
- Enables server-side search
- Sharing capabilities
- Better performance for some operations
**Cons**: 
- Reduced privacy
- Trust in server required
- Complex permission model

### Option E: Searchable Encryption (Future)
**Approach**: Implement searchable encryption schemes
**Pros**: 
- Search without decryption
- Maintains privacy
- Better user experience
**Cons**: 
- Very complex implementation
- Performance overhead
- Limited search capabilities
