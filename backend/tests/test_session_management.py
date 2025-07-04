"""
Tests for Session Management System

Comprehensive test suite for OPAQUE session management including
token generation, validation, lifecycle management, and security features.
"""

import pytest
import secrets
import time
from datetime import datetime, timedelta, UTC
from unittest.mock import Mock, patch, MagicMock
from sqlalchemy.orm import Session

from app.services.session_service import (
    SessionService, 
    session_service,
    SessionTokenError,
    SessionValidationError,
    SessionSecurityError
)
from app.models.secret_tag_opaque import OpaqueSession
from app.schemas.session import (
    SessionCreateRequest,
    SessionValidateRequest,
    SessionRefreshRequest,
    SessionInvalidateRequest
)


class TestSessionTokenGeneration:
    """Test session token generation and validation"""
    
    def test_generate_session_token_entropy(self):
        """Test that session tokens have sufficient entropy"""
        service = SessionService()
        
        # Generate multiple tokens
        tokens = [service.generate_session_token() for _ in range(100)]
        
        # All tokens should be unique
        assert len(set(tokens)) == 100
        
        # All tokens should be base64 encoded strings
        for token in tokens:
            assert isinstance(token, str)
            assert len(token) > 50  # Should be reasonably long
    
    def test_hash_session_token_consistency(self):
        """Test that token hashing is consistent"""
        service = SessionService()
        token = "test_token_123"
        
        hash1 = service.hash_session_token(token)
        hash2 = service.hash_session_token(token)
        
        assert hash1 == hash2
        assert len(hash1) == 64  # SHA-256 hex length
    
    def test_session_fingerprint_generation(self):
        """Test session fingerprint generation"""
        service = SessionService()
        
        fingerprint1 = service.create_session_fingerprint("Mozilla/5.0", "192.168.1.1")
        fingerprint2 = service.create_session_fingerprint("Mozilla/5.0", "192.168.1.1")
        
        # Should be different due to random component
        assert fingerprint1 != fingerprint2
        assert len(fingerprint1) == 64  # SHA-256 hex length


class TestSessionCreation:
    """Test session creation functionality"""
    
    @patch('app.services.session_service.SessionService._enforce_session_limits')
    def test_create_session_success(self, mock_enforce_limits):
        """Test successful session creation"""
        # Mock database session
        mock_db = Mock(spec=Session)
        mock_db.add = Mock()
        mock_db.commit = Mock()
        mock_db.refresh = Mock()
        
        service = SessionService()
        user_id = "test_user@example.com"
        tag_id = b"test_tag_id"
        
        # Mock the session object that would be created
        mock_session = Mock(spec=OpaqueSession)
        mock_session.expires_at = datetime.now(UTC) + timedelta(days=7)
        mock_db.refresh.side_effect = lambda obj: setattr(obj, 'expires_at', mock_session.expires_at)
        
        token, session = service.create_session(
            db=mock_db,
            user_id=user_id,
            tag_id=tag_id,
            user_agent="Mozilla/5.0",
            ip_address="192.168.1.1"
        )
        
        # Verify token was generated
        assert isinstance(token, str)
        assert len(token) > 50
        
        # Verify database operations
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
        mock_db.refresh.assert_called_once()
        mock_enforce_limits.assert_called_once_with(mock_db, user_id)
    
    def test_create_session_with_metadata(self):
        """Test session creation with custom metadata"""
        mock_db = Mock(spec=Session)
        mock_db.add = Mock()
        mock_db.commit = Mock()
        mock_db.refresh = Mock()
        
        service = SessionService()
        session_data = {"custom_field": "test_value", "client_type": "mobile"}
        
        with patch.object(service, '_enforce_session_limits'):
            token, session = service.create_session(
                db=mock_db,
                user_id="test_user",
                session_data=session_data
            )
        
        # Verify session was created
        assert token is not None
        mock_db.add.assert_called_once()


class TestSessionValidation:
    """Test session validation functionality"""
    
    def test_validate_session_token_success(self):
        """Test successful session validation"""
        mock_db = Mock(spec=Session)
        service = SessionService()
        
        # Mock valid session
        mock_session = Mock(spec=OpaqueSession)
        mock_session.user_id = "test_user"
        mock_session.session_state = "active"
        mock_session.expires_at = datetime.now(UTC) + timedelta(hours=1)
        mock_session.last_activity = datetime.now(UTC) - timedelta(minutes=5)
        
        # Mock database query
        mock_query = Mock()
        mock_query.filter.return_value.first.return_value = mock_session
        mock_db.query.return_value = mock_query
        mock_db.commit = Mock()
        
        # Test validation
        token = "valid_token"
        result = service.validate_session_token(
            db=mock_db,
            token=token,
            user_agent="Mozilla/5.0",
            ip_address="192.168.1.1"
        )
        
        assert result == mock_session
        mock_db.commit.assert_called_once()  # Should update last_activity
    
    def test_validate_session_token_expired(self):
        """Test validation of expired session"""
        mock_db = Mock(spec=Session)
        service = SessionService()
        
        # Mock expired session
        mock_session = Mock(spec=OpaqueSession)
        mock_session.user_id = "test_user"
        mock_session.session_state = "active"
        mock_session.expires_at = datetime.now(UTC) - timedelta(hours=1)  # Expired
        
        # Mock database query
        mock_query = Mock()
        mock_query.filter.return_value.first.return_value = mock_session
        mock_db.query.return_value = mock_query
        
        with patch.object(service, '_invalidate_session') as mock_invalidate:
            result = service.validate_session_token(
                db=mock_db,
                token="expired_token"
            )
        
        assert result is None
        mock_invalidate.assert_called_once_with(mock_db, mock_session)
    
    def test_validate_session_token_not_found(self):
        """Test validation when session not found"""
        mock_db = Mock(spec=Session)
        service = SessionService()
        
        # Mock no session found
        mock_query = Mock()
        mock_query.filter.return_value.first.return_value = None
        mock_db.query.return_value = mock_query
        
        result = service.validate_session_token(
            db=mock_db,
            token="nonexistent_token"
        )
        
        assert result is None


class TestSessionLifecycle:
    """Test session lifecycle management"""
    
    def test_refresh_session(self):
        """Test session refresh functionality"""
        mock_db = Mock(spec=Session)
        service = SessionService()
        
        # Mock session
        mock_session = Mock(spec=OpaqueSession)
        mock_session.user_id = "test_user"
        original_expires = datetime.now(UTC) + timedelta(hours=1)
        mock_session.expires_at = original_expires
        
        mock_db.commit = Mock()
        mock_db.refresh = Mock()
        
        # Test refresh
        result = service.refresh_session(mock_db, mock_session)
        
        # Verify session was refreshed
        assert mock_session.expires_at > original_expires
        mock_db.commit.assert_called_once()
        mock_db.refresh.assert_called_once()
    
    def test_invalidate_session_success(self):
        """Test session invalidation"""
        mock_db = Mock(spec=Session)
        service = SessionService()
        
        # Mock session
        mock_session = Mock(spec=OpaqueSession)
        mock_query = Mock()
        mock_query.filter.return_value.first.return_value = mock_session
        mock_db.query.return_value = mock_query
        
        with patch.object(service, '_invalidate_session', return_value=True) as mock_invalidate:
            result = service.invalidate_session(mock_db, "test_token")
        
        assert result is True
        mock_invalidate.assert_called_once_with(mock_db, mock_session)
    
    def test_invalidate_user_sessions(self):
        """Test invalidating all sessions for a user"""
        mock_db = Mock(spec=Session)
        service = SessionService()
        
        # Mock multiple sessions
        mock_sessions = [Mock(spec=OpaqueSession) for _ in range(3)]
        mock_query = Mock()
        mock_query.filter.return_value.all.return_value = mock_sessions
        mock_db.query.return_value = mock_query
        mock_db.commit = Mock()
        
        with patch.object(service, '_invalidate_session', return_value=True) as mock_invalidate:
            result = service.invalidate_user_sessions(mock_db, "test_user")
        
        assert result == 3
        assert mock_invalidate.call_count == 3
        mock_db.commit.assert_called_once()


class TestSessionSecurity:
    """Test session security features"""
    
    def test_session_limits_enforcement(self):
        """Test concurrent session limits"""
        mock_db = Mock(spec=Session)
        service = SessionService()
        
        # Mock many active sessions
        mock_sessions = [Mock(spec=OpaqueSession) for _ in range(6)]  # Over limit
        for i, session in enumerate(mock_sessions):
            session.last_activity = datetime.now(UTC) - timedelta(minutes=i)
        
        with patch.object(service, 'get_user_sessions', return_value=mock_sessions):
            with patch.object(service, '_invalidate_session') as mock_invalidate:
                service._enforce_session_limits(mock_db, "test_user")
        
        # Should invalidate oldest session
        mock_invalidate.assert_called_once()
    
    def test_session_fingerprint_validation(self):
        """Test session fingerprint validation"""
        service = SessionService()
        
        # Mock session with fingerprint data
        mock_session = Mock(spec=OpaqueSession)
        session_metadata = {
            "fingerprint": "test_fingerprint",
            "user_agent": "Mozilla/5.0 Chrome",
            "ip_address": "192.168.1.1"
        }
        import json
        mock_session.session_data = json.dumps(session_metadata).encode('utf-8')
        
        # Test matching fingerprint
        result = service._validate_session_fingerprint(
            mock_session,
            "Mozilla/5.0 Chrome",
            "192.168.1.1"
        )
        assert result is True
        
        # Test mismatched fingerprint
        result = service._validate_session_fingerprint(
            mock_session,
            "Different Browser",
            "10.0.0.1"
        )
        # Should still pass due to flexible validation
        assert result is True
    
    def test_cleanup_expired_sessions(self):
        """Test cleanup of expired sessions"""
        mock_db = Mock(spec=Session)
        service = SessionService()
        
        # Mock expired sessions
        expired_sessions = [Mock(spec=OpaqueSession) for _ in range(5)]
        mock_query = Mock()
        mock_query.filter.return_value.all.return_value = expired_sessions
        mock_db.query.return_value = mock_query
        mock_db.commit = Mock()
        
        result = service.cleanup_expired_sessions(mock_db)
        
        assert result == 5
        assert mock_db.delete.call_count == 5
        mock_db.commit.assert_called_once()


class TestSessionServiceIntegration:
    """Integration tests for session service"""
    
    def test_session_service_singleton(self):
        """Test that session_service is properly initialized"""
        from app.services.session_service import session_service
        
        assert isinstance(session_service, SessionService)
        assert session_service.SESSION_TOKEN_LENGTH == 64
        assert session_service.MAX_CONCURRENT_SESSIONS_PER_USER == 5
    
    def test_session_constants(self):
        """Test session service constants"""
        service = SessionService()
        
        assert service.SESSION_TOKEN_LENGTH == 64
        assert service.SESSION_TOKEN_ENCODING == 'base64'
        assert service.MAX_CONCURRENT_SESSIONS_PER_USER == 5
        assert service.MIN_RESPONSE_TIME_MS == 50


class TestSessionSchemas:
    """Test session Pydantic schemas"""
    
    def test_session_create_request_validation(self):
        """Test SessionCreateRequest validation"""
        # Valid request
        request = SessionCreateRequest(
            user_id="test@example.com",
            tag_id="tag123",
            session_data={"key": "value"}
        )
        assert request.user_id == "test@example.com"
        assert request.tag_id == "tag123"
        assert request.session_data == {"key": "value"}
        
        # Minimal valid request
        minimal_request = SessionCreateRequest(user_id="test@example.com")
        assert minimal_request.user_id == "test@example.com"
        assert minimal_request.tag_id is None
        assert minimal_request.session_data is None
    
    def test_session_validate_request_validation(self):
        """Test SessionValidateRequest validation"""
        # Valid request
        request = SessionValidateRequest(session_token="valid_token")
        assert request.session_token == "valid_token"
        
        # Test validation of empty token
        with pytest.raises(ValueError, match="Session token cannot be empty"):
            SessionValidateRequest(session_token="")
        
        with pytest.raises(ValueError, match="Session token cannot be empty"):
            SessionValidateRequest(session_token="   ")


class TestSessionErrorHandling:
    """Test session error handling"""
    
    def test_session_token_error_inheritance(self):
        """Test session exception hierarchy"""
        base_error = SessionTokenError("base error")
        validation_error = SessionValidationError("validation error")
        security_error = SessionSecurityError("security error")
        
        assert isinstance(validation_error, SessionTokenError)
        assert isinstance(security_error, SessionTokenError)
        
        assert str(base_error) == "base error"
        assert str(validation_error) == "validation error"
        assert str(security_error) == "security error"
    
    def test_session_service_error_handling(self):
        """Test session service error handling"""
        service = SessionService()
        
        # Test token generation error handling
        with patch('secrets.token_bytes', side_effect=Exception("Random generation failed")):
            with pytest.raises(SessionTokenError, match="Failed to generate session token"):
                service.generate_session_token()
        
        # Test token hashing error handling
        with patch('hashlib.sha256', side_effect=Exception("Hash failed")):
            with pytest.raises(SessionTokenError, match="Failed to hash session token"):
                service.hash_session_token("test_token")


class TestTimingAttackProtection:
    """Test timing attack protection"""
    
    def test_minimum_response_time_constant(self):
        """Test that minimum response time is properly defined"""
        service = SessionService()
        assert service.MIN_RESPONSE_TIME_MS == 50
        assert isinstance(service.MIN_RESPONSE_TIME_MS, int)
        assert service.MIN_RESPONSE_TIME_MS > 0


if __name__ == "__main__":
    pytest.main([__file__]) 