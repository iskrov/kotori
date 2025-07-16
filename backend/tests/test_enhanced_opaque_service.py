"""
Tests for Enhanced OPAQUE Service Layer

Tests the comprehensive business logic for OPAQUE zero-knowledge authentication operations
including registration, authentication, vault key management, and integration with 
audit logging, session management, and vault storage.
"""

import pytest
import uuid
import base64
from datetime import datetime, timedelta, UTC
from unittest.mock import Mock, patch, MagicMock
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.services.opaque_service import (
    EnhancedOpaqueService,
    create_opaque_service,
    OpaqueServiceError,
    OpaqueRegistrationError,
    OpaqueAuthenticationError,
    OpaqueKeyManagementError,
    OpaqueBusinessLogicError
)
from app.schemas.opaque import (
    OpaqueRegistrationRequest,
    OpaqueRegistrationResponse,
    OpaqueAuthInitRequest,
    OpaqueAuthInitResponse,
    OpaqueAuthFinalizeRequest,
    OpaqueAuthFinalizeResponse,
    SecretTagInfo
)
from app.models import SecretTag, WrappedKey, OpaqueSession


class TestEnhancedOpaqueService:
    """Test suite for Enhanced OPAQUE Service."""
    
    @pytest.fixture
    def mock_db(self):
        """Mock database session."""
        return Mock(spec=Session)
    
    @pytest.fixture
    def mock_audit_service(self):
        """Mock audit service."""
        mock = Mock()
        mock.audit_context.return_value.__enter__ = Mock(return_value="test-correlation-id")
        mock.audit_context.return_value.__exit__ = Mock(return_value=None)
        mock.log_authentication_event = Mock()
        mock.log_vault_event = Mock()
        mock.log_security_event = Mock()
        mock.detect_brute_force_attack = Mock(return_value=False)
        mock.get_service_health = Mock(return_value={"status": "healthy"})
        return mock
    
    @pytest.fixture
    def mock_session_service(self):
        """Mock session service."""
        mock = Mock()
        mock.validate_session_token = Mock(return_value=True)
        mock.create_session_token = Mock(return_value="test-session-token")
        mock.get_service_health = Mock(return_value={"status": "healthy"})
        return mock
    
    @pytest.fixture
    def mock_vault_service(self):
        """Mock vault service."""
        mock = Mock()
        mock.get_vault_stats = Mock(return_value=Mock(total_size=1024, total_blobs=5))
        return mock
    
    @pytest.fixture
    def opaque_service(self, mock_db, mock_audit_service, mock_session_service, mock_vault_service):
        """Create enhanced OPAQUE service with mocked dependencies."""
        with patch('app.services.opaque_service.audit_service', mock_audit_service), \
             patch('app.services.opaque_service.session_service', mock_session_service):
            service = EnhancedOpaqueService(mock_db)
            service._vault_service = mock_vault_service
            return service
    
    @pytest.fixture
    def sample_registration_request(self):
        """Sample OPAQUE registration request."""
        # Create properly sized base64 data that passes validation
        opaque_envelope = base64.b64encode(b"x" * 64).decode('ascii')  # 64 bytes -> valid base64
        verifier_kv = base64.b64encode(b"v" * 32).decode('ascii')      # 32 bytes -> valid base64 (matches schema)
        salt = base64.b64encode(b"s" * 16).decode('ascii')             # 16 bytes -> valid base64 (matches schema)
        
        return OpaqueRegistrationRequest(
            opaque_envelope=opaque_envelope,
            verifier_kv=verifier_kv,
            salt=salt,
            tag_name="Test Tag",
            color_code="#FF0000"
        )
    
    @pytest.fixture
    def sample_auth_init_request(self):
        """Sample OPAQUE authentication init request."""
        return OpaqueAuthInitRequest(
            phrase_hash="1234567890abcdef1234567890abcdef",
            client_message="dGVzdC1jbGllbnQ="  # base64 encoded "test-client"
        )
    
    @pytest.fixture
    def sample_auth_finalize_request(self):
        """Sample OPAQUE authentication finalize request."""
        return OpaqueAuthFinalizeRequest(
            session_id="test-session-id",
            client_finalize_message="dGVzdC1maW5hbGl6ZQ=="  # base64 encoded "test-finalize"
        )

    def test_service_initialization(self, mock_db):
        """Test service initialization with proper dependencies."""
        with patch('app.services.opaque_service.audit_service') as mock_audit, \
             patch('app.services.opaque_service.session_service') as mock_session:
            
            service = EnhancedOpaqueService(mock_db)
            
            assert service.db == mock_db
            assert service._audit_service == mock_audit
            assert service._session_service == mock_session
            assert service._vault_service is not None
            assert service.MAX_TAGS_PER_USER == 50
            assert service.SESSION_TIMEOUT_MINUTES == 5

    def test_validate_tag_name_valid(self, opaque_service):
        """Test tag name validation with valid inputs."""
        assert opaque_service._validate_tag_name("Valid Tag") == "Valid Tag"
        assert opaque_service._validate_tag_name("  Trimmed  ") == "Trimmed"
        assert opaque_service._validate_tag_name("A" * 100) == "A" * 100

    def test_validate_tag_name_invalid(self, opaque_service):
        """Test tag name validation with invalid inputs."""
        with pytest.raises(OpaqueBusinessLogicError, match="non-empty string"):
            opaque_service._validate_tag_name("")
        
        with pytest.raises(OpaqueBusinessLogicError, match="non-empty string"):
            opaque_service._validate_tag_name(None)
        
        with pytest.raises(OpaqueBusinessLogicError, match="at least 1 characters"):
            opaque_service._validate_tag_name("   ")
        
        with pytest.raises(OpaqueBusinessLogicError, match="at most 100 characters"):
            opaque_service._validate_tag_name("A" * 101)

    def test_validate_color_code_valid(self, opaque_service):
        """Test color code validation with valid inputs."""
        assert opaque_service._validate_color_code("#FF0000") == "#FF0000"
        assert opaque_service._validate_color_code("#ff0000") == "#FF0000"
        assert opaque_service._validate_color_code("  #123456  ") == "#123456"

    def test_validate_color_code_invalid(self, opaque_service):
        """Test color code validation with invalid inputs."""
        with pytest.raises(OpaqueBusinessLogicError, match="#RRGGBB format"):
            opaque_service._validate_color_code("FF0000")
        
        with pytest.raises(OpaqueBusinessLogicError, match="#RRGGBB format"):
            opaque_service._validate_color_code("#FF00")
        
        with pytest.raises(OpaqueBusinessLogicError, match="hexadecimal digits"):
            opaque_service._validate_color_code("#GGGGGG")

    def test_validate_color_code_default(self, opaque_service):
        """Test color code validation with default fallback."""
        assert opaque_service._validate_color_code("") == "#007AFF"
        assert opaque_service._validate_color_code(None) == "#007AFF"

    def test_check_user_tag_limit_within_limit(self, opaque_service, mock_db):
        """Test user tag limit check when within limits."""
        mock_db.query.return_value.filter.return_value.count.return_value = 10
        
        # Should not raise exception
        opaque_service._check_user_tag_limit(123)
        
        mock_db.query.assert_called_once()

    def test_check_user_tag_limit_exceeded(self, opaque_service, mock_db):
        """Test user tag limit check when limit exceeded."""
        mock_db.query.return_value.filter.return_value.count.return_value = 50
        
        with pytest.raises(OpaqueBusinessLogicError, match="Maximum number of tags"):
            opaque_service._check_user_tag_limit(123)

    def test_derive_vault_keys(self, opaque_service):
        """Test vault key derivation from export key."""
        export_key = b"A" * 32
        vault_id = "test-vault-id"
        
        data_key, kek = opaque_service._derive_vault_keys(export_key, vault_id)
        
        assert len(data_key) == 32
        assert len(kek) == 32
        assert data_key != kek
        assert data_key != export_key

    def test_generate_tag_id_from_envelope(self, opaque_service):
        """Test deterministic tag ID generation."""
        envelope1 = b"test-envelope-1"
        envelope2 = b"test-envelope-2"
        
        tag_id1 = opaque_service._generate_tag_id_from_envelope(envelope1)
        tag_id2 = opaque_service._generate_tag_id_from_envelope(envelope2)
        tag_id1_repeat = opaque_service._generate_tag_id_from_envelope(envelope1)
        
        assert len(tag_id1) == 16
        assert len(tag_id2) == 16
        assert tag_id1 == tag_id1_repeat  # Deterministic
        assert tag_id1 != tag_id2  # Different inputs produce different outputs

    @patch('app.services.opaque_service.secure_zero')
    def test_register_secret_tag_success(self, mock_secure_zero, opaque_service, mock_db, sample_registration_request):
        """Test successful secret tag registration."""
        # Mock database queries
        mock_db.query.return_value.filter.return_value.count.return_value = 0  # Within tag limit
        mock_db.query.return_value.filter.return_value.first.return_value = None  # No existing tag
        mock_db.commit = Mock()
        mock_db.add = Mock()
        
        # Mock OPAQUE operations
        with patch('app.services.opaque_service.base64.b64decode') as mock_b64decode, \
             patch('app.services.opaque_service.wrap_key') as mock_wrap_key, \
             patch('app.services.opaque_service.secure_random_bytes') as mock_random_bytes:
            
            mock_b64decode.side_effect = [b"envelope", b"verifier", b"salt"]
            mock_wrap_key.return_value = b"wrapped-key"
            mock_random_bytes.return_value = b"A" * 32
            
            response = opaque_service.register_secret_tag(
                user_id=123,
                request=sample_registration_request,
                ip_address="192.168.1.1",
                user_agent="test-agent"
            )
            
            assert isinstance(response, OpaqueRegistrationResponse)
            assert response.success is True
            assert response.tag_name== "Test Tag"
            assert response.color_code == "#FF0000"
            assert response.vault_id is not None
            
            # Verify database operations
            assert mock_db.add.call_count == 2  # SecretTag and WrappedKey
            mock_db.commit.assert_called_once()
            
            # Verify sensitive data cleanup
            assert mock_secure_zero.call_count == 3

    def test_register_secret_tag_duplicate(self, opaque_service, mock_db, sample_registration_request):
        """Test registration failure with duplicate tag."""
        # Mock existing tag
        mock_db.query.return_value.filter.return_value.count.return_value = 0  # Within tag limit
        mock_existing_tag = Mock()
        mock_db.query.return_value.filter.return_value.first.return_value = mock_existing_tag
        
        with pytest.raises(OpaqueRegistrationError, match="already exists"):
            opaque_service.register_secret_tag(
                user_id=123,
                request=sample_registration_request
            )

    def test_register_secret_tag_tag_limit_exceeded(self, opaque_service, mock_db, sample_registration_request):
        """Test registration failure when tag limit exceeded."""
        # Mock tag limit exceeded
        mock_db.query.return_value.filter.return_value.count.return_value = 50
        
        with pytest.raises(OpaqueBusinessLogicError, match="Maximum number of tags"):
            opaque_service.register_secret_tag(
                user_id=123,
                request=sample_registration_request
            )

    def test_get_user_secret_tags(self, opaque_service, mock_db, mock_vault_service):
        """Test retrieving user secret tags with vault stats."""
        # Mock database results
        mock_tag = Mock()
        mock_tag.phrase_hash= b"A" * 16
        mock_tag.tag_name= "Test Tag"
        mock_tag.color_code = "#FF0000"
        mock_tag.created_at = datetime.now(UTC)
        mock_tag.updated_at = datetime.now(UTC)
        
        mock_wrapped_key = Mock()
        mock_wrapped_key.vault_id = "test-vault-id"
        
        mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [mock_tag]
        mock_db.query.return_value.filter.return_value.first.return_value = mock_wrapped_key
        
        # Mock vault stats
        mock_vault_service.get_vault_stats.return_value = Mock(total_size=1024, total_blobs=5)
        
        result = opaque_service.get_user_secret_tags(123)
        
        assert len(result) == 1
        assert isinstance(result[0], SecretTagInfo)
        assert result[0].tag_name== "Test Tag"
        assert result[0].entry_count == 5  # Use entry_count instead of vault_size

    def test_validate_tag_exists_true(self, opaque_service, mock_db):
        """Test tag existence validation when tag exists."""
        mock_tag = Mock()
        mock_db.query.return_value.filter.return_value.first.return_value = mock_tag
        
        result = opaque_service.validate_tag_exists(123, "1234567890abcdef1234567890abcdef")
        
        assert result is True

    def test_validate_tag_exists_false(self, opaque_service, mock_db):
        """Test tag existence validation when tag doesn't exist."""
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        result = opaque_service.validate_tag_exists(123, "1234567890abcdef1234567890abcdef")
        
        assert result is False

    def test_validate_tag_exists_invalid_format(self, opaque_service, mock_db):
        """Test tag existence validation with invalid tag ID format."""
        result = opaque_service.validate_tag_exists(123, "invalid-tag-id")
        
        assert result is False

    def test_update_secret_tag_success(self, opaque_service, mock_db):
        """Test successful secret tag update."""
        mock_tag = Mock()
        mock_tag.tag_name= "Old Name"
        mock_tag.color_code = "#000000"
        mock_db.query.return_value.filter.return_value.first.return_value = mock_tag
        mock_db.commit = Mock()
        
        result = opaque_service.update_secret_tag(
            user_id=123,
            phrase_hash="1234567890abcdef1234567890abcdef",
            tag_name="New Name",
            color_code="#FF0000"
        )
        
        assert result is True
        assert mock_tag.tag_name== "New Name"
        assert mock_tag.color_code == "#FF0000"
        mock_db.commit.assert_called_once()

    def test_delete_secret_tag_success(self, opaque_service, mock_db):
        """Test successful secret tag deletion."""
        mock_tag = Mock()
        mock_tag.tag_name= "Test Tag"
        mock_wrapped_key = Mock()
        mock_wrapped_key.vault_id = "test-vault-id"
        
        mock_db.query.return_value.filter.return_value.first.return_value = mock_tag
        mock_db.query.return_value.filter.return_value.all.return_value = [mock_wrapped_key]
        mock_db.query.return_value.filter.return_value.delete = Mock()
        mock_db.delete = Mock()
        mock_db.commit = Mock()
        
        result = opaque_service.delete_secret_tag(
            user_id=123,
            phrase_hash="1234567890abcdef1234567890abcdef"
        )
        
        assert result is True
        mock_db.delete.assert_called_once_with(mock_tag)
        mock_db.commit.assert_called_once()

    def test_authenticate_init_success(self, opaque_service, mock_db, sample_auth_init_request):
        """Test successful authentication initialization."""
        mock_tag = Mock()
        mock_db.query.return_value.filter.return_value.first.return_value = mock_tag
        mock_db.add = Mock()
        mock_db.commit = Mock()
        
        # Mock OPAQUE server
        with patch.object(opaque_service, 'opaque_server') as mock_opaque_server:
            mock_response = Mock()
            mock_response.success = True
            mock_response.evaluated_element = b"server-response"
            mock_opaque_server.start_login.return_value = mock_response
            
            response = opaque_service.authenticate_init(
                user_id=123,
                request=sample_auth_init_request,
                ip_address="192.168.1.1"
            )
            
            assert isinstance(response, OpaqueAuthInitResponse)
            assert response.session_id is not None
            assert response.server_message is not None
            assert response.expires_at > datetime.now(UTC)

    def test_authenticate_init_brute_force_detected(self, opaque_service, mock_audit_service, sample_auth_init_request):
        """Test authentication init with brute force detection."""
        mock_audit_service.detect_brute_force_attack.return_value = True
        
        with pytest.raises(OpaqueAuthenticationError, match="Too many failed"):
            opaque_service.authenticate_init(
                user_id=123,
                request=sample_auth_init_request,
                ip_address="192.168.1.1"
            )

    def test_authenticate_init_tag_not_found(self, opaque_service, mock_db, sample_auth_init_request):
        """Test authentication init with non-existent tag."""
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        with pytest.raises(OpaqueAuthenticationError, match="not found"):
            opaque_service.authenticate_init(
                user_id=123,
                request=sample_auth_init_request
            )

    def test_authenticate_finalize_success(self, opaque_service, mock_db, sample_auth_finalize_request):
        """Test successful authentication finalization."""
        # Mock session
        mock_session = Mock()
        mock_session.user_id = "123"
        mock_session.phrase_hash= b"A" * 16
        mock_session.session_state = "initialized"
        mock_session.expires_at = datetime.now(UTC) + timedelta(minutes=5)
        mock_session.session_data = b'{"correlation_id": "test-id"}'
        
        # Mock wrapped keys
        mock_wrapped_key = Mock()
        mock_wrapped_key.vault_id = "test-vault-id"
        mock_wrapped_key.wrapped_key = b"wrapped-key"
        mock_wrapped_key.key_purpose = "vault_data"
        
        mock_db.query.return_value.filter.return_value.first.side_effect = [mock_session, None]  # session, then wrapped keys query
        mock_db.query.return_value.filter.return_value.all.return_value = [mock_wrapped_key]
        mock_db.delete = Mock()
        mock_db.commit = Mock()
        
        # Mock OPAQUE server
        with patch.object(opaque_service, 'opaque_server') as mock_opaque_server:
            mock_opaque_server.finish_login.return_value = (True, b"session-key")
            
            response = opaque_service.authenticate_finalize(
                request=sample_auth_finalize_request,
                ip_address="192.168.1.1"
            )
            
            assert isinstance(response, OpaqueAuthFinalizeResponse)
            assert response.success is True
            assert response.phrase_hash is not None
            assert response.vault_id == "test-vault-id"
            assert response.session_token is not None

    def test_authenticate_finalize_invalid_session(self, opaque_service, mock_db, sample_auth_finalize_request):
        """Test authentication finalize with invalid session."""
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        with pytest.raises(OpaqueAuthenticationError, match="Invalid session"):
            opaque_service.authenticate_finalize(
                request=sample_auth_finalize_request
            )

    def test_authenticate_finalize_expired_session(self, opaque_service, mock_db, sample_auth_finalize_request):
        """Test authentication finalize with expired session."""
        mock_session = Mock()
        mock_session.expires_at = datetime.now(UTC) - timedelta(minutes=1)  # Expired
        mock_db.query.return_value.filter.return_value.first.return_value = mock_session
        mock_db.delete = Mock()
        mock_db.commit = Mock()
        
        with pytest.raises(OpaqueAuthenticationError, match="Session expired"):
            opaque_service.authenticate_finalize(
                request=sample_auth_finalize_request
            )

    def test_get_vault_access_info_success(self, opaque_service, mock_session_service, mock_db, mock_vault_service):
        """Test successful vault access info retrieval."""
        mock_session_service.validate_session_token.return_value = True
        
        mock_wrapped_key = Mock()
        mock_wrapped_key.vault_id = "test-vault-id"
        mock_db.query.return_value.filter.return_value.all.return_value = [mock_wrapped_key]
        
        mock_vault_service.get_vault_stats.return_value = Mock(total_size=1024, total_blobs=5)
        
        result = opaque_service.get_vault_access_info(
            user_id=123,
            phrase_hash="1234567890abcdef1234567890abcdef",
            session_token="valid-token"
        )
        
        assert result["access_granted"] is True
        assert result["vault_id"] == "test-vault-id"
        assert result["key_count"] == 1

    def test_get_vault_access_info_invalid_token(self, opaque_service, mock_session_service):
        """Test vault access info with invalid session token."""
        mock_session_service.validate_session_token.return_value = False
        
        with pytest.raises(OpaqueAuthenticationError, match="Invalid session token"):
            opaque_service.get_vault_access_info(
                user_id=123,
                phrase_hash="1234567890abcdef1234567890abcdef",
                session_token="invalid-token"
            )

    def test_cleanup_expired_sessions(self, opaque_service, mock_db):
        """Test cleanup of expired sessions."""
        # Mock expired sessions
        mock_session1 = Mock()
        mock_session2 = Mock()
        
        # First call returns sessions, second call returns empty (end of batches)
        mock_db.query.return_value.filter.return_value.limit.return_value.all.side_effect = [
            [mock_session1, mock_session2],
            []
        ]
        mock_db.delete = Mock()
        mock_db.commit = Mock()
        
        result = opaque_service.cleanup_expired_sessions()
        
        assert result == 2
        assert mock_db.delete.call_count == 2
        mock_db.commit.assert_called()

    def test_get_service_health_healthy(self, opaque_service, mock_db, mock_audit_service, mock_session_service):
        """Test service health check when all dependencies are healthy."""
        mock_db.execute = Mock()
        mock_db.query.return_value.filter.return_value.count.return_value = 5
        mock_db.query.return_value.count.return_value = 10
        
        health = opaque_service.get_service_health()
        
        assert health["service"] == "opaque_enhanced"
        assert health["status"] == "healthy"
        assert health["dependencies"]["database"]["status"] == "healthy"
        assert health["dependencies"]["audit_service"]["status"] == "healthy"
        assert health["dependencies"]["session_service"]["status"] == "healthy"
        assert health["statistics"]["active_sessions"] == 5
        assert health["statistics"]["total_secret_tags"] == 10

    def test_get_service_health_degraded(self, opaque_service, mock_db, mock_audit_service):
        """Test service health check when some dependencies are unhealthy."""
        mock_db.execute = Mock()
        mock_audit_service.get_service_health.side_effect = Exception("Audit service down")
        
        health = opaque_service.get_service_health()
        
        assert health["service"] == "opaque_enhanced"
        assert health["status"] == "degraded"
        assert health["dependencies"]["audit_service"]["status"] == "unhealthy"

    def test_generate_session_id(self, opaque_service):
        """Test session ID generation."""
        session_id1 = opaque_service._generate_session_id()
        session_id2 = opaque_service._generate_session_id()
        
        assert len(session_id1) > 0
        assert len(session_id2) > 0
        assert session_id1 != session_id2  # Should be unique

    def test_generate_session_token(self, opaque_service):
        """Test session token generation."""
        token = opaque_service._generate_session_token("123", "test-tag-id")
        
        assert len(token) > 0
        assert isinstance(token, str)


class TestOpaqueServiceIntegration:
    """Integration tests for OPAQUE service with real dependencies."""
    
    def test_create_opaque_service(self):
        """Test factory function for creating OPAQUE service."""
        from app.services.opaque_service import create_opaque_service
        
        mock_db = Mock(spec=Session)
        service = create_opaque_service(mock_db)
        
        assert isinstance(service, EnhancedOpaqueService)
        assert service.db == mock_db


class TestOpaqueServiceErrorHandling:
    """Test error handling and edge cases."""
    
    @pytest.fixture
    def opaque_service(self):
        """Create OPAQUE service with minimal mocking."""
        mock_db = Mock(spec=Session)
        with patch('app.services.opaque_service.audit_service'), \
             patch('app.services.opaque_service.session_service'):
            return EnhancedOpaqueService(mock_db)
    
    def test_derive_vault_keys_error(self, opaque_service):
        """Test vault key derivation error handling."""
        with patch('app.services.opaque_service.blake2s_hash', side_effect=Exception("Hash error")):
            with pytest.raises(OpaqueKeyManagementError, match="Failed to derive vault keys"):
                opaque_service._derive_vault_keys(b"key", "vault-id")
    
    def test_get_user_secret_tags_database_error(self, opaque_service):
        """Test secret tags retrieval with database error."""
        opaque_service.db.query.side_effect = Exception("Database error")
        
        with pytest.raises(OpaqueServiceError, match="Failed to retrieve secret tags"):
            opaque_service.get_user_secret_tags(123)
    
    def test_cleanup_expired_sessions_error(self, opaque_service):
        """Test session cleanup with database error."""
        opaque_service.db.query.side_effect = Exception("Database error")
        
        result = opaque_service.cleanup_expired_sessions()
        
        assert result == 0  # Should handle error gracefully


if __name__ == "__main__":
    pytest.main([__file__]) 