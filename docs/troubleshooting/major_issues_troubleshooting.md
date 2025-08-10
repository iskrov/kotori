## OPAQUE Authentication Lost After Secret-Tag Cleanup (PBI-4 Stage 2)

### Symptoms
- 500 errors on `/api/v1/auth/register/*` and `/api/v1/auth/login/*`
- Backend logs mention missing `app.models.secret_tag_opaque` or disabled OPAQUE service

### Root Cause
`OpaqueSession` model was coupled with secret-tag models in `secret_tag_opaque.py`. Deleting the file removed user auth infrastructure.

### Fix
1. Create `app/models/opaque_auth.py` with `OpaqueSession` only
2. Add migration to create `opaque_sessions` table
3. Update imports from `secret_tag_opaque` to `opaque_auth`
4. Restore `opaque_user_service.py`, `session_service.py`, and OPAQUE endpoints
5. Replace `datetime.UTC` with `timezone.utc` for Python 3.10 compatibility

### Verification
- Run `node frontend/scripts/opaque-smoke.js` → should print OPAQUE OK
- Register/Login via app → should succeed
- `GET /api/v1/secret-tags` → 404 (removed)
# Major Issues and Troubleshooting Guide

This document tracks significant issues we've encountered during development, their root causes, and the solutions implemented. This serves as a reference for future troubleshooting and helps identify patterns in common problems.

## Issue #1: Tag Deletion Functionality Not Working (React Native Web)

**Date**: Based on previous conversation summaries
**Severity**: High - Core functionality broken
**Component**: TagsManager, Tag deletion system

### Problem Description
- Tag deletion buttons were completely non-functional in web environment
- Clicking delete buttons resulted in no action whatsoever
- No visible errors in console initially
- Users could not remove tags from their journal entries

### Root Cause Analysis
After extensive investigation, the issue was traced to **two separate but related problems**:

1. **Primary Issue: React Native Alert.alert() Web Incompatibility**
   - `Alert.alert()` from React Native does not function in web environments
   - The confirmation dialog for tag deletion was silently failing
   - No fallback mechanism was implemented for web users

2. **Secondary Issue: JSX Formatting Problems**
   - Multiple "Unexpected text node" errors in TagsManager component
   - Improper JSX formatting with unwrapped text nodes
   - Extra empty lines causing rendering issues
   - Improper use of template literals in conditional rendering

### Solution Implemented
1. **Web Compatibility Fix**:
   - Implemented fallback mechanism using `window.confirm()` for web environments
   - Added comprehensive logging for debugging purposes
   - Maintained native `Alert.alert()` functionality for mobile platforms

2. **JSX Structure Cleanup**:
   - Removed extra empty lines causing text node errors
   - Ensured all text content was properly wrapped in JSX elements
   - Fixed template literal usage in conditional rendering
   - Standardized JSX formatting across the component

### Prevention Measures
- Always test functionality across all target platforms (web, iOS, Android)
- Implement platform-specific fallbacks for React Native APIs that don't work on web
- Use comprehensive logging to catch silent failures
- Follow strict JSX formatting guidelines to prevent text node errors

---

## Issue #2: Scrolling and Navigation Performance Issues

**Date**: Based on previous conversation summaries
**Severity**: Medium-High - UX degradation
**Component**: Multiple screens, navigation system

### Problem Description
- Inconsistent scrolling behavior across different screens
- Performance issues during navigation
- Cluttered UI design in Journal Entry Form screen
- Non-standardized scroll view implementation

### Root Cause Analysis
The issues stemmed from **inconsistent implementation patterns**:

1. **Inconsistent ScrollView Usage**
   - Different screens using different scrolling components
   - No standardized approach to safe area handling
   - Performance not optimized for scroll-heavy screens

2. **UI Design Issues**
   - Cluttered interface with unnecessary elements
   - Poor visual hierarchy in forms
   - Inconsistent spacing and layout patterns

### Solution Implemented
1. **Standardization**:
   - Implemented standardized `SafeScrollView` usage across all screens
   - Optimized scroll performance with proper configuration
   - Unified scrolling behavior patterns

2. **UI Cleanup**:
   - Removed unnecessary titles and redundant elements
   - Improved visual hierarchy and spacing
   - Streamlined form designs for better user experience

### Prevention Measures
- Establish and document UI/UX standards and patterns
- Create reusable components for common interface elements
- Regular UI/UX audits to identify inconsistencies
- Performance testing on different devices and screen sizes

---

## Issue #3: Speech Transcription and Backend Service Failures

**Date**: Based on previous conversation summaries
**Severity**: Critical - Core functionality completely broken
**Component**: Speech transcription, Google Cloud integration, AudioRecorder

### Problem Description
- Speech transcription functionality completely non-functional after recent changes
- Secret tag functionality also affected
- Users unable to save new journal entries
- Multiple cascading failures across backend and frontend systems

### Root Cause Analysis
After extensive debugging, the issue was traced to **multiple interconnected problems**:

1. **Outdated Google Cloud Client Libraries**
   - Google Cloud client libraries were outdated and incompatible
   - API changes broke existing integration patterns
   - Authentication and service initialization failing

2. **Stale Closures in Code**
   - JavaScript closures capturing outdated state/references
   - Functions not reflecting current application state
   - Caused inconsistent behavior and silent failures

3. **Race Conditions**
   - Asynchronous operations completing in unexpected order
   - State updates happening before dependencies were ready
   - Timing-dependent failures that were hard to reproduce

4. **Compilation Errors**
   - Code changes introduced compilation issues
   - Build failures preventing proper deployment
   - Development and production environments out of sync

5. **Component Prop Mismatch**
   - AudioRecorder component receiving incorrect prop names
   - Interface changes not propagated throughout codebase
   - Frontend-backend communication broken

### Solution Implemented
1. **Library Updates**:
   - Updated Google Cloud client libraries to latest compatible versions
   - Verified API compatibility and updated integration code
   - Implemented proper error handling for service failures

2. **Closure and State Management**:
   - Identified and fixed stale closure issues
   - Implemented proper state management patterns
   - Added debugging to track state changes

3. **Race Condition Resolution**:
   - Added proper async/await patterns
   - Implemented dependency checking before operations
   - Added timeout and retry mechanisms

4. **Build System Fixes**:
   - Resolved compilation errors
   - Synchronized development and production environments
   - Implemented proper build validation

5. **Component Interface Fixes**:
   - Corrected prop name mismatches in AudioRecorder
   - Updated component interfaces consistently
   - Added type checking to prevent similar issues

### Prevention Measures
- Implement automated dependency update monitoring
- Add comprehensive integration tests for external services
- Use proper TypeScript interfaces to catch prop mismatches
- Implement proper async operation patterns from the start
- Regular audits of closure usage and state management
- Staged deployment process to catch integration issues early

---

## Issue #4: React Native Web Platform Compatibility Patterns

**Date**: Ongoing pattern identified
**Severity**: Medium - Development efficiency impact
**Component**: Cross-platform compatibility

### Problem Pattern
React Native components and APIs frequently have different behavior or availability between native mobile platforms and web environments.

### Common Manifestations
- `Alert.alert()` not working on web
- Different touch/click event handling
- Platform-specific styling requirements
- Web-specific performance considerations

### General Solution Pattern
1. **Platform Detection**:
   ```javascript
   import { Platform } from 'react-native';
   
   if (Platform.OS === 'web') {
     // Web-specific implementation
   } else {
     // Native implementation
   }
   ```

2. **Graceful Fallbacks**:
   - Implement web-compatible alternatives
   - Maintain native functionality where superior
   - Add comprehensive logging for debugging

3. **Testing Strategy**:
   - Test all functionality on all target platforms
   - Automated testing for platform-specific code paths
   - Regular cross-platform compatibility audits

---

## Troubleshooting Best Practices

Based on the issues encountered, here are key troubleshooting practices:

### 1. Systematic Investigation
- Start with console logs and error messages
- Test functionality in isolation
- Check platform-specific behavior differences
- Verify component structure and JSX formatting

### 2. Cross-Platform Considerations
- Always test on web, iOS, and Android when using React Native
- Be aware of API limitations in web environments
- Implement appropriate fallbacks for platform-specific features

### 3. Code Quality Checks
- Validate JSX structure for proper element wrapping
- Check for extra whitespace or formatting issues
- Use linting tools to catch common errors
- Follow consistent coding patterns across the codebase

### 4. Documentation and Logging
- Add comprehensive logging for debugging
- Document platform-specific workarounds
- Track recurring issues and their solutions
- Maintain troubleshooting guides like this document

---

## Future Issue Prevention

### Development Workflow Improvements
1. **Pre-implementation Planning**:
   - Consider cross-platform compatibility from the start
   - Plan for platform-specific implementations
   - Design with web limitations in mind

2. **Testing Requirements**:
   - Test on all target platforms before marking features complete
   - Include cross-platform testing in CI/CD pipeline
   - Regular compatibility audits

3. **Code Review Focus**:
   - Review for platform compatibility issues
   - Check JSX formatting and structure
   - Verify fallback implementations

### Pattern Recognition
The issues we've encountered often fall into these categories:
- **Platform Compatibility**: React Native features not working on web
- **JSX Structure**: Formatting and text node issues
- **Performance**: Inefficient implementations affecting UX
- **Consistency**: Lack of standardized patterns across components
- **Integration Failures**: External service dependencies breaking after updates
- **State Management**: Stale closures and async operation timing issues
- **Interface Mismatches**: Component prop/interface changes not propagated consistently

### Common Failure Patterns
Based on our troubleshooting history, watch for these warning signs:
1. **Silent Failures**: Functionality stops working without obvious error messages
2. **Timing-Dependent Issues**: Problems that occur intermittently or under load
3. **Cross-Platform Inconsistencies**: Features working on one platform but not others
4. **Cascade Failures**: One broken component causing multiple system failures
5. **Integration Breakage**: External service updates breaking existing functionality

By recognizing these patterns early, we can prevent similar issues in future development. 