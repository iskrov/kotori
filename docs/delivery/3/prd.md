# PBI-3: OPAQUE Client Integration

[View in Backlog](../backlog.md#user-content-PBI-3)

## Overview

Integrate OPAQUE authentication with the voice journaling workflow, enabling seamless voice-activated secret tag authentication while maintaining the existing user experience. This PBI connects the cryptographic foundation to the user-facing voice recording functionality.

## Problem Statement

The current voice-activated secret tag system requires fetching metadata from the server and performing multiple verification calls, creating security vulnerabilities and poor user experience:
- Multiple network requests reveal secret tag existence patterns
- Client-side metadata storage creates forensic evidence
- Authentication failures are distinguishable from successes
- No support for multiple concurrent secret sessions

The new OPAQUE integration must provide seamless voice activation while maintaining perfect deniability and zero-knowledge properties.

## User Stories

**Primary User Story:**
As a frontend developer, I want to integrate OPAQUE authentication with the voice journaling workflow so that users can seamlessly authenticate secret tags through voice commands.

**Supporting User Stories:**
- As a user, I want to speak my secret phrase during recording so that my private entries are automatically encrypted
- As a user, I want the same voice experience as before so that OPAQUE upgrade is transparent to my workflow
- As a security-conscious user, I want no evidence of secret functionality so that device inspection reveals nothing
- As a user, I want multiple secret tags active simultaneously so that I can organize different types of private content

## Technical Approach

### Voice Integration Flow

1. **Voice Phrase Detection**
   ```typescript
   async function checkForSecretPhrase(transcribedText: string): Promise<AuthResult> {
     const tagId = blake2s(transcribedText.trim().toLowerCase(), 16);
     
     try {
       const authResult = await opaqueAuthenticate(transcribedText, tagId);
       if (authResult.authenticated) {
         return { found: true, tagId, vaultIds: authResult.vaultIds };
       }
     } catch (error) {
       // Any error means treat as regular text
     }
     
     return { found: false, content: transcribedText };
   }
   ```

2. **Session Management**
   ```typescript
   interface SecretSession {
     tagId: Uint8Array;
     dataKeys: Map<string, Uint8Array>;  // vaultId -> dataKey
     expiresAt: number;
     autoExtend: boolean;
   }
   ```

3. **Encrypted Entry Creation**
   - Automatic vault selection for active secret sessions
   - AES-GCM encryption with session data keys
   - Seamless fallback to regular entries on authentication failure

### User Interface Integration

1. **Secret Tag Management**
   - OPAQUE-based tag creation wizard
   - Active session indicators
   - Manual session management controls
   - Migration tools for existing V2 tags

2. **Recording Interface**
   - No visible changes to recording flow
   - Background OPAQUE authentication during transcription
   - Visual indicators for active secret sessions
   - Timeout warnings and extension options

### Security Integration

1. **Memory Management**
   - Automatic key erasure on session timeout
   - Secure cleanup on app backgrounding
   - Memory leak prevention for sensitive data

2. **Error Handling**
   - No distinguishable errors between authentication failure and network issues
   - Graceful degradation to regular entry creation
   - User-friendly error messages without information leakage

## UX/UI Considerations

- **Seamless Experience**: Users should not notice the OPAQUE upgrade
- **Performance**: Authentication must complete within existing transcription time
- **Visual Feedback**: Subtle indicators for active secret sessions
- **Error Handling**: Clear feedback without revealing security information
- **Accessibility**: Maintain current accessibility features and standards

## Acceptance Criteria

1. **Voice Integration**
   - [ ] Voice phrase detection triggers OPAQUE authentication automatically
   - [ ] Authentication completes within transcription processing time (<2 seconds)
   - [ ] Failed authentication seamlessly creates regular journal entries
   - [ ] Multiple secret sessions can be active simultaneously

2. **User Interface**
   - [ ] Secret tag creation uses OPAQUE registration flow
   - [ ] Active session indicators show current secret tag status
   - [ ] Manual session management allows timeout extension and deactivation
   - [ ] Migration wizard helps users upgrade from V2 to V3 tags

3. **Security Properties**
   - [ ] No client-side storage of secret tag metadata
   - [ ] Memory automatically cleared on session timeout
   - [ ] Device inspection reveals no evidence of secret functionality
   - [ ] Network traffic patterns indistinguishable from regular usage

4. **Performance and Reliability**
   - [ ] OPAQUE authentication adds <500ms to voice processing time
   - [ ] Battery impact remains within 5% of current system
   - [ ] Offline graceful degradation prevents app crashes
   - [ ] Error recovery maintains app stability

## Dependencies

- **PBI-1**: OPAQUE cryptographic foundation
- **PBI-2**: Zero-knowledge server infrastructure
- **Voice Processing**: Integration with existing speech-to-text service
- **Entry Management**: Integration with journal entry creation/retrieval

## Open Questions

1. **Session Timeout**: What is the optimal timeout duration for secret sessions (5 minutes vs 10 minutes)?
2. **Multiple Sessions**: How many concurrent secret sessions should be supported?
3. **Migration UX**: What is the best user experience for migrating from V2 to V3 secret tags?
4. **Error Recovery**: How should the app handle OPAQUE authentication failures during poor network conditions?

## Related Tasks

[View Task List](./tasks.md) 