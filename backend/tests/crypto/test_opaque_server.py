"""
Tests for OPAQUE Server Implementation

This module contains comprehensive tests for the OPAQUE server cryptographic
implementation, including registration and login flows, error handling,
and security features.
"""

import pytest
import secrets
import base64
from unittest.mock import Mock, patch

from app.crypto.opaque_server import (
    OpaqueServer,
    OpaqueRegistrationRequest,
    OpaqueLoginRequest,
    OpaqueRegistrationRecord,
    OpaqueServerError,
    serialize_opaque_data,
    deserialize_opaque_data,
    OPAQUE_SALT_LENGTH,
    OPAQUE_NONCE_LENGTH
)


class TestOpaqueServer:
    """Test suite for OpaqueServer class"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.server = OpaqueServer()
        self.test_user_id = "test@example.com"
        self.test_blinded_element = secrets.token_bytes(32)
        self.test_client_public_key = secrets.token_bytes(65)  # Uncompressed EC point
        self.test_envelope = secrets.token_bytes(64)
        self.test_client_proof = secrets.token_bytes(32)
    
    def test_opaque_server_initialization(self):
        """Test OPAQUE server initialization"""
        server = OpaqueServer()
        assert isinstance(server.registration_records, dict)
        assert isinstance(server.active_sessions, dict)
        assert len(server.registration_records) == 0
        assert len(server.active_sessions) == 0
    
    def test_generate_keypair(self):
        """Test EC keypair generation"""
        private_key, public_key = self.server._generate_keypair()
        
        # Verify key lengths (PKCS8 DER format is longer than raw)
        assert len(private_key) > 32  # PKCS8 DER encoded private key
        assert len(public_key) == 65   # Uncompressed P-256 public key
        assert public_key[0] == 0x04   # Uncompressed point prefix
        
        # Verify keys are different each time
        private_key2, public_key2 = self.server._generate_keypair()
        assert private_key != private_key2
        assert public_key != public_key2
    
    def test_derive_key(self):
        """Test HKDF key derivation"""
        shared_secret = secrets.token_bytes(32)
        salt = secrets.token_bytes(16)
        info = b"test-info"
        
        # Test key derivation
        key1 = self.server._derive_key(shared_secret, salt, info)
        key2 = self.server._derive_key(shared_secret, salt, info)
        
        # Same inputs should produce same key
        assert key1 == key2
        assert len(key1) == 32
        
        # Different info should produce different key
        key3 = self.server._derive_key(shared_secret, salt, b"different-info")
        assert key1 != key3
        
        # Different salt should produce different key
        salt2 = secrets.token_bytes(16)
        key4 = self.server._derive_key(shared_secret, salt2, info)
        assert key1 != key4
    
    def test_simulate_oprf_evaluation(self):
        """Test OPRF evaluation simulation"""
        server_key = secrets.token_bytes(32)
        blinded_element = secrets.token_bytes(32)
        
        # Test evaluation
        result1 = self.server._simulate_oprf_evaluation(blinded_element, server_key)
        result2 = self.server._simulate_oprf_evaluation(blinded_element, server_key)
        
        # Same inputs should produce same result
        assert result1 == result2
        assert len(result1) == 32  # SHA256 output
        
        # Different inputs should produce different results
        different_element = secrets.token_bytes(32)
        result3 = self.server._simulate_oprf_evaluation(different_element, server_key)
        assert result1 != result3
        
        different_key = secrets.token_bytes(32)
        result4 = self.server._simulate_oprf_evaluation(blinded_element, different_key)
        assert result1 != result4
    
    def test_start_registration_success(self):
        """Test successful registration start"""
        request = OpaqueRegistrationRequest(
            user_id=self.test_user_id,
            blinded_element=self.test_blinded_element,
            client_public_key=self.test_client_public_key
        )
        
        response = self.server.start_registration(request)
        
        # Verify response structure
        assert len(response.evaluated_element) == 32  # HMAC-SHA256 output
        assert len(response.server_public_key) == 65  # Uncompressed EC point
        assert len(response.salt) == OPAQUE_SALT_LENGTH
        
        # Verify temporary record was created
        temp_key = f"temp_{self.test_user_id}"
        assert temp_key in self.server.registration_records
        
        temp_record = self.server.registration_records[temp_key]
        assert temp_record.user_id == self.test_user_id
        assert temp_record.server_public_key == response.server_public_key
        assert temp_record.salt == response.salt
    
    def test_start_registration_error_handling(self):
        """Test registration start error handling"""
        # Test with invalid request
        with patch.object(self.server, '_generate_keypair', side_effect=Exception("Keypair error")):
            request = OpaqueRegistrationRequest(
                user_id=self.test_user_id,
                blinded_element=self.test_blinded_element,
                client_public_key=self.test_client_public_key
            )
            
            with pytest.raises(OpaqueServerError, match="Registration start failed"):
                self.server.start_registration(request)
    
    def test_finish_registration_success(self):
        """Test successful registration finish"""
        # First start registration
        request = OpaqueRegistrationRequest(
            user_id=self.test_user_id,
            blinded_element=self.test_blinded_element,
            client_public_key=self.test_client_public_key
        )
        
        self.server.start_registration(request)
        
        # Then finish registration
        success = self.server.finish_registration(self.test_user_id, self.test_envelope)
        
        assert success is True
        
        # Verify final record was created
        assert self.test_user_id in self.server.registration_records
        
        final_record = self.server.registration_records[self.test_user_id]
        assert final_record.user_id == self.test_user_id
        assert final_record.envelope == self.test_envelope
        assert final_record.created_at > 0
        
        # Verify temporary record was removed
        temp_key = f"temp_{self.test_user_id}"
        assert temp_key not in self.server.registration_records
    
    def test_finish_registration_no_temp_record(self):
        """Test finish registration without start"""
        with pytest.raises(OpaqueServerError, match="No registration in progress"):
            self.server.finish_registration(self.test_user_id, self.test_envelope)
    
    def test_start_login_success(self):
        """Test successful login start"""
        # First complete registration
        self._complete_registration()
        
        # Then start login
        request = OpaqueLoginRequest(
            user_id=self.test_user_id,
            blinded_element=self.test_blinded_element,
            client_public_key=self.test_client_public_key
        )
        
        response = self.server.start_login(request)
        
        assert response.success is True
        assert len(response.evaluated_element) == 32
        assert len(response.server_public_key) == 65
        assert len(response.salt) == OPAQUE_SALT_LENGTH
    
    def test_start_login_user_not_found(self):
        """Test login start for non-existent user"""
        request = OpaqueLoginRequest(
            user_id="nonexistent@example.com",
            blinded_element=self.test_blinded_element,
            client_public_key=self.test_client_public_key
        )
        
        response = self.server.start_login(request)
        
        assert response.success is False
        assert response.evaluated_element == b""
        assert response.server_public_key == b""
        assert response.salt == b""
    
    def test_start_login_error_handling(self):
        """Test login start error handling"""
        # Complete registration first
        self._complete_registration()
        
        # Test with error in OPRF evaluation
        with patch.object(self.server, '_simulate_oprf_evaluation', side_effect=Exception("OPRF error")):
            request = OpaqueLoginRequest(
                user_id=self.test_user_id,
                blinded_element=self.test_blinded_element,
                client_public_key=self.test_client_public_key
            )
            
            with pytest.raises(OpaqueServerError, match="Login start failed"):
                self.server.start_login(request)
    
    def test_finish_login_success(self):
        """Test successful login finish"""
        # Complete registration first
        self._complete_registration()
        
        # Finish login
        success, session_key = self.server.finish_login(self.test_user_id, self.test_client_proof)
        
        assert success is True
        assert session_key is not None
        assert len(session_key) == 32
        
        # Verify session was stored
        assert self.test_user_id in self.server.active_sessions
        assert self.server.active_sessions[self.test_user_id] == session_key
    
    def test_finish_login_user_not_found(self):
        """Test login finish for non-existent user"""
        success, session_key = self.server.finish_login("nonexistent@example.com", self.test_client_proof)
        
        assert success is False
        assert session_key is None
    
    def test_finish_login_no_proof(self):
        """Test login finish without client proof"""
        # Complete registration first
        self._complete_registration()
        
        success, session_key = self.server.finish_login(self.test_user_id, b"")
        
        assert success is False
        assert session_key is None
    
    def test_finish_login_error_handling(self):
        """Test login finish error handling"""
        # Complete registration first
        self._complete_registration()
        
        # Test with error in session key generation
        with patch('secrets.token_bytes', side_effect=Exception("Random error")):
            with pytest.raises(OpaqueServerError, match="Login finish failed"):
                self.server.finish_login(self.test_user_id, self.test_client_proof)
    
    def test_get_user_record(self):
        """Test getting user registration record"""
        # Test non-existent user
        record = self.server.get_user_record("nonexistent@example.com")
        assert record is None
        
        # Complete registration
        self._complete_registration()
        
        # Test existing user
        record = self.server.get_user_record(self.test_user_id)
        assert record is not None
        assert record.user_id == self.test_user_id
        assert record.envelope == self.test_envelope
    
    def test_has_user(self):
        """Test user existence check"""
        # Test non-existent user
        assert self.server.has_user("nonexistent@example.com") is False
        
        # Complete registration
        self._complete_registration()
        
        # Test existing user
        assert self.server.has_user(self.test_user_id) is True
    
    def test_get_session_key(self):
        """Test getting session key"""
        # Test non-existent session
        session_key = self.server.get_session_key("nonexistent@example.com")
        assert session_key is None
        
        # Complete registration and login
        self._complete_registration()
        success, expected_key = self.server.finish_login(self.test_user_id, self.test_client_proof)
        assert success is True
        
        # Test existing session
        session_key = self.server.get_session_key(self.test_user_id)
        assert session_key == expected_key
    
    def test_invalidate_session(self):
        """Test session invalidation"""
        # Test non-existent session
        success = self.server.invalidate_session("nonexistent@example.com")
        assert success is False
        
        # Complete registration and login
        self._complete_registration()
        login_success, session_key = self.server.finish_login(self.test_user_id, self.test_client_proof)
        assert login_success is True
        
        # Test existing session
        success = self.server.invalidate_session(self.test_user_id)
        assert success is True
        
        # Verify session was removed
        assert self.server.get_session_key(self.test_user_id) is None
    
    def test_cleanup_expired_sessions(self):
        """Test session cleanup"""
        # Test with no sessions
        cleaned = self.server.cleanup_expired_sessions()
        assert cleaned == 0
        
        # Add many sessions to trigger cleanup
        for i in range(101):
            user_id = f"user{i}@example.com"
            self.server.active_sessions[user_id] = secrets.token_bytes(32)
        
        # Test cleanup
        cleaned = self.server.cleanup_expired_sessions()
        assert cleaned == 10  # Should remove 10 sessions
        assert len(self.server.active_sessions) == 91
    
    def _complete_registration(self):
        """Helper method to complete a full registration"""
        request = OpaqueRegistrationRequest(
            user_id=self.test_user_id,
            blinded_element=self.test_blinded_element,
            client_public_key=self.test_client_public_key
        )
        
        self.server.start_registration(request)
        self.server.finish_registration(self.test_user_id, self.test_envelope)


class TestOpaqueUtilities:
    """Test suite for OPAQUE utility functions"""
    
    def test_serialize_opaque_data_bytes(self):
        """Test serializing bytes data"""
        test_data = b"test_data_123"
        result = serialize_opaque_data(test_data)
        
        expected = base64.b64encode(test_data).decode('utf-8')
        assert result == expected
    
    def test_serialize_opaque_data_response_objects(self):
        """Test serializing response objects"""
        from app.crypto.opaque_server import OpaqueRegistrationResponse
        
        response = OpaqueRegistrationResponse(
            evaluated_element=b"evaluated",
            server_public_key=b"server_key",
            salt=b"salt_data"
        )
        
        result = serialize_opaque_data(response)
        
        assert isinstance(result, dict)
        assert result["evaluated_element"] == base64.b64encode(b"evaluated").decode('utf-8')
        assert result["server_public_key"] == base64.b64encode(b"server_key").decode('utf-8')
        assert result["salt"] == base64.b64encode(b"salt_data").decode('utf-8')
    
    def test_serialize_opaque_data_other_types(self):
        """Test serializing other data types"""
        test_data = {"key": "value"}
        result = serialize_opaque_data(test_data)
        assert result == test_data
        
        test_string = "test_string"
        result = serialize_opaque_data(test_string)
        assert result == test_string
    
    def test_deserialize_opaque_data_success(self):
        """Test successful data deserialization"""
        test_data = b"test_data_123"
        encoded = base64.b64encode(test_data).decode('utf-8')
        
        result = deserialize_opaque_data(encoded)
        assert result == test_data
    
    def test_deserialize_opaque_data_invalid(self):
        """Test deserialization with invalid data"""
        with pytest.raises(OpaqueServerError, match="Invalid base64 data"):
            deserialize_opaque_data("invalid_base64_data!")


class TestOpaqueDataClasses:
    """Test suite for OPAQUE data classes"""
    
    def test_opaque_registration_record(self):
        """Test OpaqueRegistrationRecord data class"""
        record = OpaqueRegistrationRecord(
            user_id="test@example.com",
            envelope=b"envelope_data",
            server_public_key=b"server_key",
            server_private_key=b"server_private",
            salt=b"salt_data",
            created_at=123456.789
        )
        
        assert record.user_id == "test@example.com"
        assert record.envelope == b"envelope_data"
        assert record.server_public_key == b"server_key"
        assert record.server_private_key == b"server_private"
        assert record.salt == b"salt_data"
        assert record.created_at == 123456.789
    
    def test_opaque_registration_request(self):
        """Test OpaqueRegistrationRequest data class"""
        request = OpaqueRegistrationRequest(
            user_id="test@example.com",
            blinded_element=b"blinded",
            client_public_key=b"client_key"
        )
        
        assert request.user_id == "test@example.com"
        assert request.blinded_element == b"blinded"
        assert request.client_public_key == b"client_key"
    
    def test_opaque_login_request(self):
        """Test OpaqueLoginRequest data class"""
        request = OpaqueLoginRequest(
            user_id="test@example.com",
            blinded_element=b"blinded",
            client_public_key=b"client_key"
        )
        
        assert request.user_id == "test@example.com"
        assert request.blinded_element == b"blinded"
        assert request.client_public_key == b"client_key"


class TestOpaqueServerError:
    """Test suite for OpaqueServerError exception"""
    
    def test_opaque_server_error(self):
        """Test OpaqueServerError exception"""
        error_msg = "Test error message"
        
        with pytest.raises(OpaqueServerError) as exc_info:
            raise OpaqueServerError(error_msg)
        
        assert str(exc_info.value) == error_msg
        assert isinstance(exc_info.value, Exception) 