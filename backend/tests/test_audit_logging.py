"""
Tests for Security Audit Logging System

Comprehensive test suite for audit service, models, and API endpoints.
"""

import pytest
import json
import hashlib
from datetime import datetime, timedelta, UTC
from unittest.mock import Mock, patch
from sqlalchemy.orm import Session

from app.services.audit_service import (
    SecurityAuditService,
    AuditServiceError,
    AuditIntegrityError,
    audit_service
)
from app.models.secret_tag_opaque import SecurityAuditLog, SecurityMetrics, SecurityAlert
from app.schemas.audit import (
    AuditLogRequest,
    EventCategory,
    EventSeverity,
    AuditIntegrityRequest
)


class TestSecurityAuditService:
    """Test cases for SecurityAuditService"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.service = SecurityAuditService()
        self.mock_db = Mock(spec=Session)
    
    def test_hash_identifier(self):
        """Test identifier hashing for privacy"""
        # Test basic hashing
        user_id = "test@example.com"
        hash1 = self.service._hash_identifier(user_id)
        hash2 = self.service._hash_identifier(user_id)
        
        # Should be consistent
        assert hash1 == hash2
        assert len(hash1) == 64  # SHA-256 hex length
        assert hash1 != user_id  # Should be different from original
        
        # Test empty identifier
        empty_phrase_hash= self.service._hash_identifier("")
        assert empty_phrase_hash== ""
        
        # Test None identifier
        none_phrase_hash= self.service._hash_identifier(None)
        assert none_phrase_hash== ""
    
    def test_sanitize_event_data(self):
        """Test event data sanitization"""
        # Test data with sensitive fields
        sensitive_data = {
            "username": "test_user",
            "password": "secret123",
            "secret_phrase": "my secret",
            "token": "abc123",
            "nested": {
                "field": "safe_value",
                "secret": "hidden"
            },
            "list_data": [
                {"safe": "value"},
                {"password": "hidden"}
            ]
        }
        
        sanitized = self.service._sanitize_event_data(sensitive_data)
        
        # Check sensitive fields are redacted
        assert sanitized["password"] == "[REDACTED]"
        assert sanitized["secret_phrase"] == "[REDACTED]"
        assert sanitized["token"] == "[REDACTED]"
        assert sanitized["nested"]["secret"] == "[REDACTED]"
        assert sanitized["list_data"][1]["password"] == "[REDACTED]"
        
        # Check safe fields are preserved
        assert sanitized["username"] == "test_user"
        assert sanitized["nested"]["field"] == "safe_value"
        assert sanitized["list_data"][0]["safe"] == "value"
    
    def test_generate_log_signature(self):
        """Test log signature generation"""
        # Create mock log entry
        log_entry = Mock()
        log_entry.id = "test-id"
        log_entry.event_type = "test_event"
        log_entry.event_category = "test"
        log_entry.severity = "info"
        log_entry.user_id_phrase_hash= "user_hash"
        log_entry.timestamp = datetime.now(UTC)
        log_entry.event_message = "test message"
        log_entry.success = True
        
        signature = self.service._generate_log_signature(log_entry)
        
        # Should generate a valid signature
        assert signature
        assert len(signature) == 64  # SHA-256 hex length
        
        # Should be consistent
        signature2 = self.service._generate_log_signature(log_entry)
        assert signature == signature2
    
    def test_log_event_basic(self):
        """Test basic event logging"""
        # Mock database operations
        self.mock_db.add = Mock()
        self.mock_db.commit = Mock()
        self.mock_db.refresh = Mock()
        
        # Create mock log entry that will be returned
        mock_log = Mock()
        mock_log.id = "test-log-id"
        mock_log.correlation_id = "test-correlation"
        
        # Mock the log entry creation
        with patch('app.models.secret_tag_opaque.SecurityAuditLog') as mock_log_class:
            mock_log_class.return_value = mock_log
            
            result = self.service.log_event(
                db=self.mock_db,
                event_type="test_event",
                event_category="test",
                severity="info",
                message="Test message",
                user_id="test@example.com",
                success=True
            )
            
            # Verify database operations
            self.mock_db.add.assert_called_once()
            self.mock_db.commit.assert_called_once()
            self.mock_db.refresh.assert_called_once()
            
            # Verify result
            assert result == mock_log
    
    def test_log_authentication_event(self):
        """Test authentication event logging"""
        self.mock_db.add = Mock()
        self.mock_db.commit = Mock()
        self.mock_db.refresh = Mock()
        
        mock_log = Mock()
        mock_log.id = "auth-log-id"
        
        with patch('app.models.secret_tag_opaque.SecurityAuditLog') as mock_log_class:
            mock_log_class.return_value = mock_log
            
            result = self.service.log_authentication_event(
                db=self.mock_db,
                event_type="opaque_login_finish",
                user_id="test@example.com",
                success=True,
                ip_address="192.168.1.1",
                additional_data={"method": "opaque"}
            )
            
            assert result == mock_log
            self.mock_db.commit.assert_called_once()
    
    def test_log_session_event(self):
        """Test session event logging"""
        self.mock_db.add = Mock()
        self.mock_db.commit = Mock()
        self.mock_db.refresh = Mock()
        
        mock_log = Mock()
        
        with patch('app.models.secret_tag_opaque.SecurityAuditLog') as mock_log_class:
            mock_log_class.return_value = mock_log
            
            result = self.service.log_session_event(
                db=self.mock_db,
                event_type="session_created",
                user_id="test@example.com",
                session_id="session123",
                success=True
            )
            
            assert result == mock_log
    
    def test_log_vault_event(self):
        """Test vault event logging"""
        self.mock_db.add = Mock()
        self.mock_db.commit = Mock()
        self.mock_db.refresh = Mock()
        
        mock_log = Mock()
        
        with patch('app.models.secret_tag_opaque.SecurityAuditLog') as mock_log_class:
            mock_log_class.return_value = mock_log
            
            result = self.service.log_vault_event(
                db=self.mock_db,
                event_type="vault_upload",
                user_id="test@example.com",
                vault_id="vault123",
                success=True,
                content_size=1024
            )
            
            assert result == mock_log
    
    def test_log_security_event(self):
        """Test security event logging"""
        self.mock_db.add = Mock()
        self.mock_db.commit = Mock()
        self.mock_db.refresh = Mock()
        
        mock_log = Mock()
        
        with patch('app.models.secret_tag_opaque.SecurityAuditLog') as mock_log_class:
            mock_log_class.return_value = mock_log
            
            result = self.service.log_security_event(
                db=self.mock_db,
                event_type="brute_force_detected",
                severity="critical",
                message="Brute force attack detected",
                user_id="test@example.com",
                threat_data={"attempts": 5}
            )
            
            assert result == mock_log
    
    def test_detect_brute_force_attack(self):
        """Test brute force attack detection"""
        # Mock query chain
        mock_query = Mock()
        mock_filter_result = Mock()
        mock_query.filter.return_value = mock_filter_result
        mock_filter_result.filter.return_value = mock_filter_result
        mock_filter_result.count.return_value = 6  # Above threshold
        
        self.mock_db.query.return_value = mock_query
        self.mock_db.add = Mock()
        self.mock_db.commit = Mock()
        self.mock_db.refresh = Mock()
        
        with patch('app.models.secret_tag_opaque.SecurityAuditLog') as mock_log_class:
            mock_log_class.return_value = Mock()
            
            result = self.service.detect_brute_force_attack(
                db=self.mock_db,
                user_id="test@example.com",
                ip_address="192.168.1.1",
                failure_threshold=5
            )
            
            assert result is True
            self.mock_db.commit.assert_called()  # Should log the detection
    
    def test_get_audit_logs(self):
        """Test audit log retrieval with filtering"""
        # Mock logs
        mock_logs = [Mock(), Mock(), Mock()]
        
        # Mock query chain
        mock_query = Mock()
        mock_query.filter.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.offset.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.all.return_value = mock_logs
        
        self.mock_db.query.return_value = mock_query
        
        result = self.service.get_audit_logs(
            db=self.mock_db,
            user_id="test@example.com",
            event_category="auth",
            limit=10
        )
        
        assert result == mock_logs
        assert mock_query.filter.call_count >= 2  # User and category filters
    
    def test_verify_log_integrity(self):
        """Test log integrity verification"""
        # Mock log entry
        mock_log = Mock()
        mock_log.log_signature = "valid_signature"
        
        mock_query = Mock()
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = mock_log
        
        self.mock_db.query.return_value = mock_query
        
        with patch.object(self.service, '_verify_log_signature', return_value=True):
            result = self.service.verify_log_integrity(self.mock_db, "test-log-id")
            assert result is True
        
        with patch.object(self.service, '_verify_log_signature', return_value=False):
            result = self.service.verify_log_integrity(self.mock_db, "test-log-id")
            assert result is False
    
    def test_cleanup_old_logs(self):
        """Test old log cleanup"""
        # Mock logs to delete
        mock_logs = [Mock(), Mock()]
        
        # Mock query for count
        mock_count_query = Mock()
        mock_count_query.filter.return_value = mock_count_query
        mock_count_query.count.return_value = 2
        
        # Mock query for batch deletion
        mock_batch_query = Mock()
        mock_batch_query.filter.return_value = mock_batch_query
        mock_batch_query.limit.return_value = mock_batch_query
        mock_batch_query.all.side_effect = [mock_logs, []]  # First batch, then empty
        
        self.mock_db.query.side_effect = [mock_count_query, mock_batch_query, mock_batch_query]
        self.mock_db.delete = Mock()
        self.mock_db.commit = Mock()
        
        result = self.service.cleanup_old_logs(
            db=self.mock_db,
            retention_days=30,
            batch_size=10
        )
        
        assert result == 2
        assert self.mock_db.delete.call_count == 2
        self.mock_db.commit.assert_called()


class TestAuditSchemas:
    """Test cases for audit schemas"""
    
    def test_audit_log_request_validation(self):
        """Test audit log request validation"""
        # Valid request
        valid_data = {
            "event_type": "test_event",
            "event_category": "auth",
            "severity": "info",
            "message": "Test message",
            "success": True
        }
        
        request = AuditLogRequest(**valid_data)
        assert request.event_type == "test_event"
        assert request.event_category == EventCategory.AUTH
        assert request.severity == EventSeverity.INFO
        assert request.success is True
        
        # Test validation errors
        with pytest.raises(ValueError):
            AuditLogRequest(
                event_type="",  # Empty event type
                event_category="auth",
                severity="info",
                message="Test"
            )
        
        with pytest.raises(ValueError):
            AuditLogRequest(
                event_type="test",
                event_category="auth",
                severity="info",
                message=""  # Empty message
            )
    
    def test_event_category_enum(self):
        """Test event category enumeration"""
        assert EventCategory.AUTH == "auth"
        assert EventCategory.SESSION == "session"
        assert EventCategory.VAULT == "vault"
        assert EventCategory.SYSTEM == "system"
        assert EventCategory.SECURITY == "security"
    
    def test_event_severity_enum(self):
        """Test event severity enumeration"""
        assert EventSeverity.INFO == "info"
        assert EventSeverity.WARNING == "warning"
        assert EventSeverity.ERROR == "error"
        assert EventSeverity.CRITICAL == "critical"
    
    def test_audit_integrity_request(self):
        """Test audit integrity request validation"""
        # Valid request
        valid_data = {
            "log_ids": ["id1", "id2", "id3"]
        }
        
        request = AuditIntegrityRequest(**valid_data)
        assert len(request.log_ids) == 3
        
        # Test validation errors
        with pytest.raises(ValueError):
            AuditIntegrityRequest(log_ids=[])  # Empty list
        
        with pytest.raises(ValueError):
            AuditIntegrityRequest(log_ids=["id"] * 101)  # Too many IDs


class TestAuditModels:
    """Test cases for audit database models"""
    
    def test_security_audit_log_model(self):
        """Test SecurityAuditLog model creation"""
        log_entry = SecurityAuditLog(
            id="test-id",
            event_type="test_event",
            event_category="auth",
            severity="info",
            event_message="Test message",
            user_id_phrase_hash="user_hash",
            timestamp=datetime.now(UTC),
            success=True
        )
        
        assert log_entry.id == "test-id"
        assert log_entry.event_type == "test_event"
        assert log_entry.event_category == "auth"
        assert log_entry.severity == "info"
        assert log_entry.success is True
    
    def test_security_metrics_model(self):
        """Test SecurityMetrics model creation"""
        metric = SecurityMetrics(
            id="metric-id",
            metric_tag_display_tag_display_name="auth_attempts",
            metric_type="counter",
            time_window="1h",
            window_start=datetime.now(UTC),
            window_end=datetime.now(UTC),
            value=100
        )
        
        assert metric.metric_tag_display_tag_display_name== "auth_attempts"
        assert metric.metric_type == "counter"
        assert metric.value == 100
    
    def test_security_alert_model(self):
        """Test SecurityAlert model creation"""
        alert = SecurityAlert(
            id="alert-id",
            alert_type="brute_force",
            severity="critical",
            title="Brute Force Attack",
            description="Attack detected",
            detection_rule="failure_threshold",
            first_seen=datetime.now(UTC),
            last_seen=datetime.now(UTC)
        )
        
        assert alert.alert_type == "brute_force"
        assert alert.severity == "critical"
        assert alert.title == "Brute Force Attack"


class TestAuditIntegration:
    """Integration tests for audit logging system"""
    
    def test_audit_service_singleton(self):
        """Test that audit_service is a singleton instance"""
        from app.services.audit_service import audit_service
        
        assert isinstance(audit_service, SecurityAuditService)
        assert audit_service.CATEGORY_AUTH == "auth"
        assert audit_service.EVENT_OPAQUE_LOGIN_START == "opaque_login_start"
    
    def test_privacy_compliance(self):
        """Test that audit logging maintains privacy compliance"""
        service = SecurityAuditService()
        
        # Test that user IDs are hashed when privacy is enabled
        assert service.HASH_USER_IDS is True
        assert service.HASH_IP_ADDRESSES is True
        assert service.HASH_USER_AGENTS is True
        
        # Test that sensitive fields are identified correctly
        sensitive_fields = service.sensitive_fields
        assert 'password' in sensitive_fields
        assert 'secret' in sensitive_fields
        assert 'key' in sensitive_fields
        assert 'token' in sensitive_fields
    
    def test_zero_knowledge_compliance(self):
        """Test that audit logging maintains zero-knowledge properties"""
        service = SecurityAuditService()
        
        # Test that sensitive data is sanitized
        sensitive_data = {
            "secret_phrase": "my secret phrase",
            "opaque_envelope": "encrypted_data",
            "verifier": "crypto_verifier"
        }
        
        sanitized = service._sanitize_event_data(sensitive_data)
        
        # All sensitive fields should be redacted
        for key in sensitive_data:
            assert sanitized[key] == "[REDACTED]"
    
    def test_tamper_evidence(self):
        """Test that audit logs provide tamper evidence"""
        service = SecurityAuditService()
        
        # Create mock log entry
        log_entry = Mock()
        log_entry.id = "test-id"
        log_entry.event_type = "test_event"
        log_entry.event_category = "auth"
        log_entry.severity = "info"
        log_entry.user_id_phrase_hash= "user_hash"
        log_entry.timestamp = datetime.now(UTC)
        log_entry.event_message = "test message"
        log_entry.success = True
        
        # Generate signature
        signature = service._generate_log_signature(log_entry)
        log_entry.log_signature = signature
        
        # Verify signature
        is_valid = service._verify_log_signature(log_entry)
        assert is_valid is True
        
        # Test tamper detection
        log_entry.event_message = "tampered message"
        is_valid_after_tamper = service._verify_log_signature(log_entry)
        assert is_valid_after_tamper is False


# Performance tests
class TestAuditPerformance:
    """Performance tests for audit logging"""
    
    def test_signature_generation_performance(self):
        """Test that signature generation is performant"""
        import time
        
        service = SecurityAuditService()
        
        # Create mock log entry
        log_entry = Mock()
        log_entry.id = "test-id"
        log_entry.event_type = "test_event"
        log_entry.event_category = "auth"
        log_entry.severity = "info"
        log_entry.user_id_phrase_hash= "user_hash"
        log_entry.timestamp = datetime.now(UTC)
        log_entry.event_message = "test message"
        log_entry.success = True
        
        # Measure signature generation time
        start_time = time.time()
        for _ in range(100):
            service._generate_log_signature(log_entry)
        end_time = time.time()
        
        avg_time = (end_time - start_time) / 100
        assert avg_time < 0.01  # Should be less than 10ms per signature
    
    def test_data_sanitization_performance(self):
        """Test that data sanitization is performant"""
        import time
        
        service = SecurityAuditService()
        
        # Create large test data
        large_data = {
            f"field_{i}": f"value_{i}" for i in range(100)
        }
        large_data.update({
            "password": "secret",
            "nested": {f"nested_{i}": f"value_{i}" for i in range(50)}
        })
        
        # Measure sanitization time
        start_time = time.time()
        for _ in range(10):
            service._sanitize_event_data(large_data)
        end_time = time.time()
        
        avg_time = (end_time - start_time) / 10
        assert avg_time < 0.1  # Should be less than 100ms per sanitization


if __name__ == "__main__":
    pytest.main([__file__]) 