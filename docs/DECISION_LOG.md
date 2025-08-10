# Kotori Project - Decision Log

This document records significant architectural and technical decisions made during the development of the Kotori voice journaling application.

## Decision Records

### DR-001: Transition from Secret-Tag to Per-User Encryption
**Date**: August 2025  
**Status**: Implemented  
**Context**: The original secret-tag architecture allowed multiple encryption keys per user based on secret phrases, but added complexity and potential security risks.

**Decision**: Migrate to a simpler per-user encryption model where each user has a single master key derived from their OPAQUE authentication, which wraps individual entry keys.

**Consequences**:
- **Positive**: Simplified key management, reduced complexity, maintained zero-knowledge architecture
- **Negative**: Loss of multiple-secret-phrase functionality per user
- **Mitigation**: Feature flag system allows for potential future restoration if needed

### DR-002: OPAQUE Protocol for Zero-Knowledge Authentication
**Date**: August 2025  
**Status**: Implemented  
**Context**: Need for truly zero-knowledge authentication where server never sees user passwords.

**Decision**: Implement OPAQUE (Oblivious Pseudorandom Functions) protocol for user authentication alongside traditional OAuth for convenience.

**Consequences**:
- **Positive**: Military-grade security, server compromise protection, no password storage
- **Negative**: Added complexity, less familiar protocol
- **Mitigation**: Dual authentication system with OAuth fallback

### DR-003: Client-Side Encryption Architecture
**Date**: August 2025  
**Status**: Implemented  
**Context**: Ensure server never has access to plaintext journal content.

**Decision**: Implement all encryption/decryption on client devices using Web Crypto API with hardware-backed key storage.

**Consequences**:
- **Positive**: True zero-knowledge privacy, server compromise protection
- **Negative**: Increased client complexity, platform dependencies
- **Mitigation**: Comprehensive error handling and fallback mechanisms

### DR-004: Feature Flag System Implementation
**Date**: August 2025  
**Status**: Implemented  
**Context**: Need to safely disable secret-tag functionality while preserving core application features.

**Decision**: Implement comprehensive feature flag system with both frontend and backend controls.

**Consequences**:
- **Positive**: Safe feature rollout, easy rollback capability, clean code separation
- **Negative**: Additional configuration complexity
- **Mitigation**: Clear documentation and default configurations

### DR-005: Database Migration Strategy
**Date**: August 2025  
**Status**: Implemented  
**Context**: Need to safely remove secret-tag schema from existing PostgreSQL 17 database.

**Decision**: Implement two-stage migration: Stage 1 deprecation (non-destructive), Stage 2 removal (destructive).

**Consequences**:
- **Positive**: Safe migration path, rollback capability, data preservation during transition
- **Negative**: Temporary schema bloat during Stage 1
- **Mitigation**: Comprehensive testing and verification procedures

### DR-006: Google Cloud Platform Deployment
**Date**: August 2025  
**Status**: Implemented  
**Context**: Need production-ready, scalable infrastructure for voice journaling application.

**Decision**: Deploy to Google Cloud Platform using Cloud Run, Cloud SQL, and integrated services.

**Consequences**:
- **Positive**: Auto-scaling, managed services, integrated Speech-to-Text API
- **Negative**: Vendor lock-in, GCP-specific configurations
- **Mitigation**: Containerized application for potential portability

### DR-007: Separation of OPAQUE Authentication from Secret-Tag Features
**Date**: August 2025  
**Status**: Implemented  
**Context**: Accidental removal of OPAQUE user authentication when removing secret-tag features.

**Decision**: Strictly separate OPAQUE user authentication models from secret-tag encryption models.

**Consequences**:
- **Positive**: Clear separation of concerns, prevents future coupling issues
- **Negative**: Required emergency restoration work
- **Mitigation**: Dedicated model files and comprehensive testing

## Decision Criteria

When making architectural decisions for Kotori, we prioritize:

1. **Security First**: Zero-knowledge architecture and user privacy
2. **Simplicity**: Prefer simpler solutions that are easier to maintain
3. **Reliability**: Production-ready, battle-tested technologies
4. **Performance**: Responsive user experience
5. **Maintainability**: Clean, well-documented code

## Review Process

Architectural decisions are:
1. Documented in this log with context and consequences
2. Reviewed by the development team
3. Validated through implementation and testing
4. Monitored for effectiveness post-implementation

## Future Considerations

- Regular review of feature flag usage and cleanup
- Performance optimization based on production metrics
- Potential expansion to additional cloud providers
- Enhanced monitoring and observability features

---
**Maintained by**: Development Team  
**Last Updated**: January 27, 2025
