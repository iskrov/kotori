"""
Security Audit Service for OPAQUE Authentication

This module provides comprehensive security audit logging for OPAQUE zero-knowledge authentication,
maintaining audit trails while preserving privacy and implementing tamper-evident logging.
"""

import hashlib
import hmac
import json
import secrets
import time
import uuid
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Union
import logging
from contextlib import contextmanager

from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import func, desc

from app.models.secret_tag_opaque import SecurityAuditLog, SecurityMetrics, SecurityAlert
from app.core.config import settings

logger = logging.getLogger(__name__)


class AuditServiceError(Exception):
    """Base exception for audit service operations"""
    pass


class AuditIntegrityError(AuditServiceError):
    """Exception raised when audit log integrity is compromised"""
    pass


class AuditPrivacyError(AuditServiceError):
    """Exception raised when audit logging would violate privacy requirements"""
    pass


class SecurityAuditService:
    """Service for comprehensive security audit logging with zero-knowledge compliance"""
    
    # Event categories
    CATEGORY_AUTH = "auth"
    CATEGORY_SESSION = "session"
    CATEGORY_VAULT = "vault"
    CATEGORY_SYSTEM = "system"
    CATEGORY_SECURITY = "security"
    
    # Event types
    EVENT_OPAQUE_REGISTRATION_START = "opaque_registration_start"
    EVENT_OPAQUE_REGISTRATION_FINISH = "opaque_registration_finish"
    EVENT_OPAQUE_LOGIN_START = "opaque_login_start"
    EVENT_OPAQUE_LOGIN_FINISH = "opaque_login_finish"
    EVENT_SESSION_CREATED = "session_created"
    EVENT_SESSION_VALIDATED = "session_validated"
    EVENT_SESSION_REFRESHED = "session_refreshed"
    EVENT_SESSION_INVALIDATED = "session_invalidated"
    EVENT_VAULT_ACCESS = "vault_access"
    EVENT_VAULT_UPLOAD = "vault_upload"
    EVENT_VAULT_DOWNLOAD = "vault_download"
    EVENT_VAULT_DELETE = "vault_delete"
    EVENT_SECURITY_VIOLATION = "security_violation"
    EVENT_BRUTE_FORCE_DETECTED = "brute_force_detected"
    EVENT_TIMING_ATTACK_DETECTED = "timing_attack_detected"
    EVENT_SUSPICIOUS_ACTIVITY = "suspicious_activity"
    
    # Severity levels
    SEVERITY_INFO = "info"
    SEVERITY_WARNING = "warning"
    SEVERITY_ERROR = "error"
    SEVERITY_CRITICAL = "critical"
    
    # Privacy settings
    HASH_USER_IDS = True
    HASH_IP_ADDRESSES = True
    HASH_USER_AGENTS = True
    
    def __init__(self):
        """Initialize audit service with configuration"""
        self.signing_key = self._get_signing_key()
        self.max_event_data_size = 4000  # Max size for event_data JSON
        self.sensitive_fields = {
            'password', 'secret', 'key', 'token', 'phrase', 'envelope', 
            'salt', 'verifier', 'proof', 'element', 'signature'
        }
    
    def _get_signing_key(self) -> bytes:
        """Get or generate HMAC signing key for log integrity"""
        try:
            # In production, this should come from secure configuration
            key = getattr(settings, 'AUDIT_SIGNING_KEY', None)
            if key:
                return key.encode('utf-8') if isinstance(key, str) else key
            
            # Generate a key for development (should be persistent in production)
            logger.warning("Using generated audit signing key - not suitable for production")
            return secrets.token_bytes(32)
        except Exception as e:
            logger.error(f"Error getting audit signing key: {str(e)}")
            return b"development_key_not_secure"
    
    def _hash_identifier(self, identifier: str) -> str:
        """Hash an identifier for privacy-preserving logging"""
        if not identifier:
            return ""
        
        # Use SHA-256 with salt for consistent but private hashing
        salt = b"audit_log_salt_2025"  # Should be configurable in production
        hash_input = salt + identifier.encode('utf-8')
        return hashlib.sha256(hash_input).hexdigest()
    
    def _sanitize_event_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Sanitize event data to remove sensitive information"""
        if not data:
            return {}
        
        sanitized = {}
        for key, value in data.items():
            key_lower = key.lower()
            
            # Check if field name suggests sensitive data (more precise matching)
            is_sensitive = False
            for sensitive_term in self.sensitive_fields:
                # Check if the key starts with or exactly matches the sensitive term
                if (key_lower == sensitive_term or 
                    key_lower.startswith(sensitive_term + '_') or
                    key_lower.endswith('_' + sensitive_term) or
                    ('_' + sensitive_term + '_' in key_lower)):
                    is_sensitive = True
                    break
            
            if is_sensitive:
                sanitized[key] = "[REDACTED]"
            elif isinstance(value, dict):
                sanitized[key] = self._sanitize_event_data(value)
            elif isinstance(value, list):
                sanitized[key] = [self._sanitize_event_data(item) if isinstance(item, dict) else item for item in value]
            else:
                sanitized[key] = value
        
        return sanitized
    
    def _generate_log_signature(self, log_entry: SecurityAuditLog) -> str:
        """Generate HMAC signature for log entry integrity"""
        try:
            # Create signature payload from critical fields
            signature_data = {
                'id': log_entry.id,
                'event_type': log_entry.event_type,
                'event_category': log_entry.event_category,
                'severity': log_entry.severity,
                'user_id_hash': log_entry.user_id_hash,
                'timestamp': log_entry.timestamp.isoformat(),
                'event_message': log_entry.event_message,
                'success': log_entry.success
            }
            
            payload = json.dumps(signature_data, sort_keys=True)
            signature = hmac.new(
                self.signing_key,
                payload.encode('utf-8'),
                hashlib.sha256
            ).hexdigest()
            
            return signature
        except Exception as e:
            logger.error(f"Error generating log signature: {str(e)}")
            return ""
    
    def _verify_log_signature(self, log_entry: SecurityAuditLog) -> bool:
        """Verify HMAC signature of log entry"""
        try:
            if not log_entry.log_signature:
                return False
            
            expected_signature = self._generate_log_signature(log_entry)
            return hmac.compare_digest(log_entry.log_signature, expected_signature)
        except Exception as e:
            logger.error(f"Error verifying log signature: {str(e)}")
            return False
    
    def log_event(
        self,
        db: Session,
        event_type: str,
        event_category: str,
        severity: str,
        message: str,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        correlation_id: Optional[str] = None,
        request_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        event_data: Optional[Dict[str, Any]] = None,
        success: Optional[bool] = None,
        error_code: Optional[str] = None,
        processing_time_ms: Optional[int] = None,
        is_sensitive: bool = False
    ) -> Optional[SecurityAuditLog]:
        """
        Log a security audit event with privacy protection and integrity verification
        
        Args:
            db: Database session
            event_type: Type of event (use EVENT_* constants)
            event_category: Category of event (use CATEGORY_* constants)
            severity: Event severity (use SEVERITY_* constants)
            message: Human-readable event message
            user_id: User identifier (will be hashed for privacy)
            session_id: Session identifier (will be hashed for privacy)
            correlation_id: Correlation ID for tracking related events
            request_id: Request identifier
            ip_address: Client IP address (will be hashed for privacy)
            user_agent: Client user agent (will be hashed for privacy)
            event_data: Additional event data (will be sanitized)
            success: Whether the event represents a successful operation
            error_code: Error code if applicable
            processing_time_ms: Request processing time in milliseconds
            is_sensitive: Whether this event contains sensitive information
            
        Returns:
            SecurityAuditLog: Created audit log entry, or None if logging failed
        """
        try:
            # Generate correlation ID if not provided
            if not correlation_id:
                correlation_id = str(uuid.uuid4())
            
            # Hash sensitive identifiers for privacy
            user_id_hash = self._hash_identifier(user_id) if user_id and self.HASH_USER_IDS else user_id
            session_id_hash = self._hash_identifier(session_id) if session_id and self.HASH_USER_IDS else session_id
            ip_address_hash = self._hash_identifier(ip_address) if ip_address and self.HASH_IP_ADDRESSES else None
            user_agent_hash = self._hash_identifier(user_agent) if user_agent and self.HASH_USER_AGENTS else None
            
            # Sanitize event data to remove sensitive information
            sanitized_event_data = self._sanitize_event_data(event_data or {})
            
            # Limit event data size
            event_data_json = json.dumps(sanitized_event_data)
            if len(event_data_json) > self.max_event_data_size:
                sanitized_event_data = {"error": "Event data too large", "size": len(event_data_json)}
                event_data_json = json.dumps(sanitized_event_data)
            
            # Create audit log entry
            log_entry = SecurityAuditLog(
                id=str(uuid.uuid4()),
                event_type=event_type,
                event_category=event_category,
                severity=severity,
                user_id_hash=user_id_hash,
                session_id_hash=session_id_hash,
                correlation_id=correlation_id,
                request_id=request_id,
                ip_address_hash=ip_address_hash,
                user_agent_hash=user_agent_hash,
                event_data=event_data_json,
                event_message=message[:500],  # Limit message length
                is_sensitive=is_sensitive,
                timestamp=datetime.utcnow(),
                processing_time_ms=processing_time_ms,
                success=success,
                error_code=error_code
            )
            
            # Generate integrity signature
            log_entry.log_signature = self._generate_log_signature(log_entry)
            
            # Save to database
            db.add(log_entry)
            db.commit()
            db.refresh(log_entry)
            
            logger.debug(f"Logged audit event: {event_type} for user {user_id_hash[:8] if user_id_hash else 'N/A'}")
            return log_entry
            
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error logging audit event: {str(e)}")
            return None
        except Exception as e:
            db.rollback()
            logger.error(f"Error logging audit event: {str(e)}")
            return None
    
    def log_authentication_event(
        self,
        db: Session,
        event_type: str,
        user_id: str,
        success: bool,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        correlation_id: Optional[str] = None,
        error_code: Optional[str] = None,
        additional_data: Optional[Dict[str, Any]] = None
    ) -> Optional[SecurityAuditLog]:
        """Log OPAQUE authentication events"""
        severity = self.SEVERITY_INFO if success else self.SEVERITY_WARNING
        message = f"OPAQUE {event_type} {'succeeded' if success else 'failed'} for user"
        
        return self.log_event(
            db=db,
            event_type=event_type,
            event_category=self.CATEGORY_AUTH,
            severity=severity,
            message=message,
            user_id=user_id,
            correlation_id=correlation_id,
            ip_address=ip_address,
            user_agent=user_agent,
            event_data=additional_data,
            success=success,
            error_code=error_code
        )
    
    def log_session_event(
        self,
        db: Session,
        event_type: str,
        user_id: str,
        session_id: str,
        success: bool,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        correlation_id: Optional[str] = None,
        additional_data: Optional[Dict[str, Any]] = None
    ) -> Optional[SecurityAuditLog]:
        """Log session management events"""
        severity = self.SEVERITY_INFO if success else self.SEVERITY_WARNING
        message = f"Session {event_type} {'succeeded' if success else 'failed'}"
        
        return self.log_event(
            db=db,
            event_type=event_type,
            event_category=self.CATEGORY_SESSION,
            severity=severity,
            message=message,
            user_id=user_id,
            session_id=session_id,
            correlation_id=correlation_id,
            ip_address=ip_address,
            user_agent=user_agent,
            event_data=additional_data,
            success=success
        )
    
    def log_vault_event(
        self,
        db: Session,
        event_type: str,
        user_id: str,
        vault_id: str,
        success: bool,
        object_id: Optional[str] = None,
        content_size: Optional[int] = None,
        correlation_id: Optional[str] = None,
        additional_data: Optional[Dict[str, Any]] = None
    ) -> Optional[SecurityAuditLog]:
        """Log vault storage events"""
        severity = self.SEVERITY_INFO if success else self.SEVERITY_WARNING
        message = f"Vault {event_type} {'succeeded' if success else 'failed'}"
        
        vault_data = {
            "vault_id": vault_id,
            "object_id": object_id,
            "content_size": content_size,
            **(additional_data or {})
        }
        
        return self.log_event(
            db=db,
            event_type=event_type,
            event_category=self.CATEGORY_VAULT,
            severity=severity,
            message=message,
            user_id=user_id,
            correlation_id=correlation_id,
            event_data=vault_data,
            success=success
        )
    
    def log_security_event(
        self,
        db: Session,
        event_type: str,
        severity: str,
        message: str,
        user_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        correlation_id: Optional[str] = None,
        threat_data: Optional[Dict[str, Any]] = None
    ) -> Optional[SecurityAuditLog]:
        """Log security violation and threat detection events"""
        return self.log_event(
            db=db,
            event_type=event_type,
            event_category=self.CATEGORY_SECURITY,
            severity=severity,
            message=message,
            user_id=user_id,
            correlation_id=correlation_id,
            ip_address=ip_address,
            event_data=threat_data,
            success=False,  # Security events are typically violations
            is_sensitive=True
        )
    
    def detect_brute_force_attack(
        self,
        db: Session,
        user_id: str,
        ip_address: Optional[str] = None,
        time_window_minutes: int = 15,
        failure_threshold: int = 5
    ) -> bool:
        """
        Detect potential brute force attacks based on authentication failures
        
        Args:
            db: Database session
            user_id: User identifier to check
            ip_address: IP address to check
            time_window_minutes: Time window for checking failures
            failure_threshold: Number of failures that trigger detection
            
        Returns:
            bool: True if brute force attack is detected
        """
        try:
            cutoff_time = datetime.utcnow() - timedelta(minutes=time_window_minutes)
            user_id_hash = self._hash_identifier(user_id) if self.HASH_USER_IDS else user_id
            
            # Count authentication failures in time window
            query = db.query(SecurityAuditLog).filter(
                SecurityAuditLog.event_category == self.CATEGORY_AUTH,
                SecurityAuditLog.user_id_hash == user_id_hash,
                SecurityAuditLog.success == False,
                SecurityAuditLog.timestamp >= cutoff_time
            )
            
            # Add IP address filter if provided
            if ip_address and self.HASH_IP_ADDRESSES:
                ip_hash = self._hash_identifier(ip_address)
                query = query.filter(SecurityAuditLog.ip_address_hash == ip_hash)
            
            failure_count = query.count()
            
            if failure_count >= failure_threshold:
                # Log brute force detection
                self.log_security_event(
                    db=db,
                    event_type=self.EVENT_BRUTE_FORCE_DETECTED,
                    severity=self.SEVERITY_CRITICAL,
                    message=f"Brute force attack detected: {failure_count} failures in {time_window_minutes} minutes",
                    user_id=user_id,
                    ip_address=ip_address,
                    threat_data={
                        "failure_count": failure_count,
                        "time_window_minutes": time_window_minutes,
                        "threshold": failure_threshold
                    }
                )
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error detecting brute force attack: {str(e)}")
            return False
    
    def get_audit_logs(
        self,
        db: Session,
        user_id: Optional[str] = None,
        event_category: Optional[str] = None,
        event_type: Optional[str] = None,
        severity: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[SecurityAuditLog]:
        """
        Retrieve audit logs with filtering and pagination
        
        Args:
            db: Database session
            user_id: Filter by user ID (will be hashed)
            event_category: Filter by event category
            event_type: Filter by event type
            severity: Filter by severity level
            start_time: Filter by start time
            end_time: Filter by end time
            limit: Maximum number of results
            offset: Number of results to skip
            
        Returns:
            List[SecurityAuditLog]: Filtered audit log entries
        """
        try:
            query = db.query(SecurityAuditLog)
            
            # Apply filters
            if user_id:
                user_id_hash = self._hash_identifier(user_id) if self.HASH_USER_IDS else user_id
                query = query.filter(SecurityAuditLog.user_id_hash == user_id_hash)
            
            if event_category:
                query = query.filter(SecurityAuditLog.event_category == event_category)
            
            if event_type:
                query = query.filter(SecurityAuditLog.event_type == event_type)
            
            if severity:
                query = query.filter(SecurityAuditLog.severity == severity)
            
            if start_time:
                query = query.filter(SecurityAuditLog.timestamp >= start_time)
            
            if end_time:
                query = query.filter(SecurityAuditLog.timestamp <= end_time)
            
            # Order by timestamp (newest first) and apply pagination
            logs = query.order_by(desc(SecurityAuditLog.timestamp)).offset(offset).limit(limit).all()
            
            return logs
            
        except Exception as e:
            logger.error(f"Error retrieving audit logs: {str(e)}")
            return []
    
    def verify_log_integrity(self, db: Session, log_id: str) -> bool:
        """Verify the integrity of a specific audit log entry"""
        try:
            log_entry = db.query(SecurityAuditLog).filter(SecurityAuditLog.id == log_id).first()
            if not log_entry:
                return False
            
            return self._verify_log_signature(log_entry)
            
        except Exception as e:
            logger.error(f"Error verifying log integrity: {str(e)}")
            return False
    
    def cleanup_old_logs(
        self,
        db: Session,
        retention_days: int = 90,
        batch_size: int = 1000
    ) -> int:
        """
        Clean up old audit logs based on retention policy
        
        Args:
            db: Database session
            retention_days: Number of days to retain logs
            batch_size: Number of logs to delete in each batch
            
        Returns:
            int: Number of logs deleted
        """
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
            
            # Count logs to be deleted
            total_count = db.query(SecurityAuditLog).filter(
                SecurityAuditLog.timestamp < cutoff_date,
                SecurityAuditLog.is_sensitive == False  # Keep sensitive logs longer
            ).count()
            
            deleted_count = 0
            while deleted_count < total_count:
                # Delete in batches to avoid long-running transactions
                batch = db.query(SecurityAuditLog).filter(
                    SecurityAuditLog.timestamp < cutoff_date,
                    SecurityAuditLog.is_sensitive == False
                ).limit(batch_size).all()
                
                if not batch:
                    break
                
                for log in batch:
                    db.delete(log)
                
                db.commit()
                deleted_count += len(batch)
                
                logger.info(f"Deleted {len(batch)} audit logs (total: {deleted_count})")
            
            return deleted_count
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error cleaning up audit logs: {str(e)}")
            return 0
    
    @contextmanager
    def audit_context(
        self,
        correlation_id: Optional[str] = None,
        request_id: Optional[str] = None
    ):
        """Context manager for audit logging with correlation tracking"""
        if not correlation_id:
            correlation_id = str(uuid.uuid4())
        
        # Store context in thread-local storage or similar
        # This is a simplified implementation
        original_correlation_id = getattr(self, '_current_correlation_id', None)
        original_request_id = getattr(self, '_current_request_id', None)
        
        self._current_correlation_id = correlation_id
        self._current_request_id = request_id
        
        try:
            yield correlation_id
        finally:
            self._current_correlation_id = original_correlation_id
            self._current_request_id = original_request_id


# Global audit service instance
audit_service = SecurityAuditService() 