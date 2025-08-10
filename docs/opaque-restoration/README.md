# OPAQUE User Authentication Restoration

## Critical Issue Summary

**Date**: 2025-08-09  
**Severity**: CRITICAL  
**Impact**: Complete loss of OPAQUE user authentication functionality

## The Original Problem

During PBI-4 Stage 2 implementation (destructive removal of secret-tag schema), we inadvertently disabled ALL OPAQUE authentication functionality, not just the secret-tag encryption features.

### What Should Have Been Removed (Secret-Tag Features Only)
- Secret tags for encrypting journal entries with secret phrases
- Tables: `secret_tags`, `wrapped_keys`, `vault_blobs`, `tag_sessions`
- Ability to create/manage secret tags
- Secret phrase processing for journal entries

### What Was Actually Removed (Unintended)
- **OPAQUE user registration** - Users can no longer register with OPAQUE
- **OPAQUE user login** - Users can no longer authenticate with OPAQUE
- **OpaqueSession model** - Core session management for OPAQUE auth
- **Session management** - All OPAQUE session handling

### Root Cause
The `OpaqueSession` model was incorrectly placed in `app/models/secret_tag_opaque.py` alongside secret-tag models. When we deleted this file to remove secret-tag functionality, we lost the essential OPAQUE authentication infrastructure.

## Architecture Analysis

### Incorrect Architecture (What We Had)
```
app/models/secret_tag_opaque.py
├── SecretTag (should be removed)
├── WrappedKey (should be removed)
├── VaultBlob (should be removed)
├── TagSession (should be removed)
└── OpaqueSession (should NOT be removed - needed for user auth)
```

### Correct Architecture (What We Need)
```
app/models/opaque_auth.py (NEW)
└── OpaqueSession (restored for user auth)

app/models/secret_tag_opaque.py (DELETED - correct)
```

## Recovery Plan

### Phase 1: Restore Core OPAQUE Models
1. Create new `app/models/opaque_auth.py` with OpaqueSession model
2. Add migration to recreate `opaque_sessions` table
3. Update model imports

### Phase 2: Restore OPAQUE Services
1. Re-enable `opaque_user_service.py` with proper implementation
2. Fix `session_service.py` to handle OPAQUE sessions (without secret-tags)
3. Remove the "disabled" placeholders

### Phase 3: Fix API Endpoints
1. Remove the 501 Not Implemented returns from OPAQUE auth endpoints
2. Restore proper OPAQUE registration flow
3. Restore proper OPAQUE login flow

### Phase 4: Verification
1. Test OPAQUE user registration
2. Test OPAQUE user login
3. Verify journal operations work with OPAQUE auth
4. Confirm secret-tag features remain removed

## Files to Restore/Modify

### New Files
- `/backend/app/models/opaque_auth.py` - New file with OpaqueSession model
- `/backend/migrations/versions/XXX_restore_opaque_sessions.py` - Migration to recreate table

### Files to Modify
- `/backend/app/models/__init__.py` - Import OpaqueSession from new location
- `/backend/app/services/opaque_user_service.py` - Restore full implementation
- `/backend/app/services/session_service.py` - Restore session management
- `/backend/app/api/v1/auth.py` - Remove 501 returns, restore functionality
- `/backend/app/dependencies.py` - Restore get_opaque_session dependency

## Expected Outcome

After restoration:
- ✅ Users can register with OPAQUE authentication
- ✅ Users can login with OPAQUE authentication
- ✅ Session management works for OPAQUE users
- ✅ Journal CRUD works with OPAQUE authentication
- ✅ Secret-tag features remain removed (correct)
- ✅ No secret_tags, wrapped_keys, vault_blobs, tag_sessions tables

## Implementation Notes

This restoration is CRITICAL because:
1. Existing users with OPAQUE accounts cannot login
2. New users cannot register with OPAQUE
3. The frontend expects OPAQUE endpoints to work
4. This breaks a core authentication method

The fix maintains the correct removal of secret-tag features while restoring essential OPAQUE user authentication.

