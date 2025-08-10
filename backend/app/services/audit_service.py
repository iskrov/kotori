"""
Audit Service - DISABLED in PBI-4 Stage 2

This service was disabled when secret-tag schema was removed.
The SecurityAuditLog, SecurityMetrics, and SecurityAlert models no longer exist after Stage 2 cleanup.
"""

import logging

logger = logging.getLogger(__name__)

class AuditServiceError(Exception):
    """Exception raised by audit service operations."""
    pass

class AuditIntegrityError(AuditServiceError):
    """Exception raised during audit integrity operations."""
    pass

class SecurityAuditService:
    """Disabled audit service - security audit functionality removed."""
    
    def __init__(self, *args, **kwargs):
        logger.warning("Audit service is disabled - SecurityAuditLog models removed in PBI-4 Stage 2")
    
    def log_security_event(self, *args, **kwargs):
        """Log security events - disabled, returns None."""
        return None
    
    def get_audit_logs(self, *args, **kwargs):
        """Get audit logs - disabled, returns empty list."""
        return []
    
    def generate_security_report(self, *args, **kwargs):
        """Generate security report - disabled, returns empty report."""
        return {"status": "disabled", "message": "Audit service disabled in PBI-4 Stage 2"}

# Create disabled service instance
audit_service = SecurityAuditService()
