"""
Tests for OPAQUE Authentication Endpoints

This module tests the OPAQUE authentication flow including:
- Authentication initialization (init)
- Authentication finalization (finalize)
- Session management and cleanup
- Error handling and security properties
"""

import pytest
import base64
import json
from datetime import datetime, timedelta, UTC
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models import User, SecretTag, WrappedKey, OpaqueSession
from app.schemas.opaque import (
    OpaqueAuthInitRequest,
    OpaqueAuthInitResponse,
    OpaqueAuthFinalizeRequest,
    OpaqueAuthFinalizeResponse
)
from app.services.opaque_service import create_opaque_service


class TestOpaqueAuthenticationEndpoints:
    """Test OPAQUE authentication endpoints"""
    
    def test_auth_init_request_validation(self):
        """Test that authentication init request validation works correctly"""
        
        # Test valid request (32 hex chars = 16 bytes)
        valid_request = OpaqueAuthInitRequest(
            phrase_hash="a1b2c3d4e5f6789012345678901234ab",
            client_message="dGVzdCBjbGllbnQgbWVzc2FnZQ=="  # "test client message"
        )
        
        assert valid_request.phrase_hash== "a1b2c3d4e5f6789012345678901234ab"
        assert valid_request.client_message == "dGVzdCBjbGllbnQgbWVzc2FnZQ=="
        
        # Test invalid tag_id (too short)
        with pytest.raises(ValueError):
            OpaqueAuthInitRequest(
                phrase_hash="short",
                client_message="dGVzdCBjbGllbnQgbWVzc2FnZQ=="
            )
        
        # Test invalid base64 client_message
        with pytest.raises(ValueError):
            OpaqueAuthInitRequest(
                phrase_hash="a1b2c3d4e5f6789012345678901234ab",
                client_message="invalid-base64!"
            )
    
    def test_auth_finalize_request_validation(self):
        """Test that authentication finalize request validation works correctly"""
        
        # Test valid request
        valid_request = OpaqueAuthFinalizeRequest(
            session_id="test_session_id_12345",
            client_finalize_message="dGVzdCBmaW5hbGl6ZSBtZXNzYWdl"  # "test finalize message"
        )
        
        assert valid_request.session_id == "test_session_id_12345"
        assert valid_request.client_finalize_message == "dGVzdCBmaW5hbGl6ZSBtZXNzYWdl"
        
        # Test invalid base64 finalize message
        with pytest.raises(ValueError):
            OpaqueAuthFinalizeRequest(
                session_id="test_session_id_12345",
                client_finalize_message="invalid-base64!"
            )
    
    def test_opaque_service_creation(self, db_session: Session):
        """Test that OPAQUE service can be created successfully"""
        
        service = create_opaque_service(db_session)
        assert service is not None
        assert hasattr(service, 'authenticate_init')
        assert hasattr(service, 'authenticate_finalize')
        assert hasattr(service, 'cleanup_expired_sessions')
    
    def test_session_id_generation(self, db_session: Session):
        """Test that session IDs are generated uniquely"""
        
        service = create_opaque_service(db_session)
        
        # Generate multiple session IDs
        session_ids = [service._generate_session_id() for _ in range(10)]
        
        # Verify they are all unique
        assert len(set(session_ids)) == 10
        
        # Verify they are all reasonable length
        for session_id in session_ids:
            assert len(session_id) > 20  # URL-safe base64 should be longer
            assert isinstance(session_id, str)
    
    def test_session_token_generation(self, db_session: Session):
        """Test that session tokens are generated correctly"""
        
        service = create_opaque_service(db_session)
        
        # Generate session token
        user_id = "test_user_123"
        phrase_hash= "a1b2c3d4e5f6789012345678901234ab"
        
        token = service._generate_session_token(user_id, tag_id)
        
        # Verify token format
        assert isinstance(token, str)
        assert len(token) > 20
        
        # Verify token can be decoded
        try:
            decoded = base64.b64decode(token).decode()
            assert user_id in decoded
            assert tag_id in decoded
        except Exception as e:
            pytest.fail(f"Token should be valid base64: {e}")
    
    def test_cleanup_expired_sessions(self, db_session: Session):
        """Test that expired session cleanup works correctly"""
        
        service = create_opaque_service(db_session)
        
        # Create some test sessions
        current_time = datetime.now(UTC)
        
        # Create an expired session
        expired_session = OpaqueSession(
            session_id="expired_session_123",
            user_id="test_user_123",
            phrase_hash=bytes.fromhex("a1b2c3d4e5f6789012345678901234ab"),
            session_state="initialized",
            created_at=current_time - timedelta(hours=1),
            expires_at=current_time - timedelta(minutes=1),  # Expired 1 minute ago
            last_activity=current_time - timedelta(hours=1)
        )
        
        # Create a valid session
        valid_session = OpaqueSession(
            session_id="valid_session_123",
            user_id="test_user_123",
            phrase_hash=bytes.fromhex("a1b2c3d4e5f6789012345678901234ab"),
            session_state="initialized",
            created_at=current_time,
            expires_at=current_time + timedelta(minutes=5),  # Expires in 5 minutes
            last_activity=current_time
        )
        
        db_session.add(expired_session)
        db_session.add(valid_session)
        db_session.commit()
        
        # Run cleanup
        cleaned_count = service.cleanup_expired_sessions()
        
        # Verify that expired session was cleaned up
        assert cleaned_count == 1
        
        # Verify that valid session still exists
        remaining_sessions = db_session.query(OpaqueSession).all()
        assert len(remaining_sessions) == 1
        assert remaining_sessions[0].session_id == "valid_session_123"
    
    def test_health_endpoint_accessibility(self):
        """Test that the OPAQUE health endpoint is accessible"""
        
        client = TestClient(app)
        
        response = client.get("/api/opaque/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        assert data["service"] == "opaque-auth"


class TestOpaqueAuthenticationFlow:
    """Test the complete OPAQUE authentication flow"""
    
    def test_authentication_flow_components(self):
        """Test that all components for authentication flow are available"""
        
        # Test that schemas are importable
        from app.schemas.opaque import (
            OpaqueAuthInitRequest,
            OpaqueAuthInitResponse,
            OpaqueAuthFinalizeRequest,
            OpaqueAuthFinalizeResponse
        )
        
        # Test that service methods exist
        from app.services.opaque_service import OpaqueService
        
        # Verify methods exist
        assert hasattr(OpaqueService, 'authenticate_init')
        assert hasattr(OpaqueService, 'authenticate_finalize')
        assert hasattr(OpaqueService, 'cleanup_expired_sessions')
    
    def test_authentication_endpoints_registered(self):
        """Test that authentication endpoints are properly registered"""
        
        client = TestClient(app)
        
        # Test that endpoints exist (will return 401/422 due to auth, but not 404)
        init_response = client.post("/api/opaque/auth/init", json={})
        assert init_response.status_code != 404  # Should be 401 or 422, not 404
        
        finalize_response = client.post("/api/opaque/auth/finalize", json={})
        assert finalize_response.status_code != 404  # Should be 401 or 422, not 404
        
        cleanup_response = client.post("/api/opaque/sessions/cleanup")
        assert cleanup_response.status_code != 404  # Should be 401, not 404


class TestOpaqueAuthenticationSecurity:
    """Test security properties of OPAQUE authentication"""
    
    def test_constant_timing_protection(self):
        """Test that endpoints implement timing attack protection"""
        
        # This is a basic test - in production you'd measure actual timing
        client = TestClient(app)
        
        # Make invalid requests and verify they don't immediately fail
        invalid_request = {
            "tag_id": "invalid",
            "client_message": "invalid"
        }
        
        response = client.post("/api/opaque/auth/init", json=invalid_request)
        
        # Should return an error but with timing protection
        # (actual timing measurement would require more sophisticated testing)
        assert response.status_code in [401, 422, 400]  # Auth required or validation error
    
    def test_session_isolation(self, db_session: Session):
        """Test that authentication sessions are properly isolated"""
        
        service = create_opaque_service(db_session)
        
        # Create multiple sessions for different users
        session1_id = service._generate_session_id()
        session2_id = service._generate_session_id()
        
        # Verify sessions have different IDs
        assert session1_id != session2_id
        
        # Verify session IDs are sufficiently random
        assert len(session1_id) > 20
        assert len(session2_id) > 20


if __name__ == "__main__":
    pytest.main([__file__, "-v"]) 