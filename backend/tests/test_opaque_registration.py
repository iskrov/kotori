"""
Tests for OPAQUE Registration Endpoint

Basic tests to verify that the OPAQUE registration endpoint
accepts requests and handles validation correctly.
"""

import base64
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
import uuid

from app.main import app
from app.dependencies import get_db, get_current_user
from app.models import User


# Test data
VALID_OPAQUE_DATA = {
    "opaque_envelope": base64.b64encode(b"dummy_envelope_32_bytes_long_data").decode(),
    "verifier_kv": base64.b64encode(b"dummy_verifier_32_bytes_long_dat").decode(),
    "salt": base64.b64encode(b"dummy_salt_16_by").decode(),
    "tag_name": "Test Secret Tag",
    "color_code": "#FF5733"
}

INVALID_OPAQUE_DATA = {
    "opaque_envelope": "invalid_base64!",
    "verifier_kv": base64.b64encode(b"too_short").decode(),
    "salt": base64.b64encode(b"wrong_length_salt").decode(),
    "tag_name": "",
    "color_code": "invalid_color"
}


class TestOpaqueRegistration:
    """Test class for OPAQUE registration endpoint."""
    
    def test_registration_endpoint_exists(self):
        """Test that the registration endpoint is accessible."""
        client = TestClient(app)
        
        # Override dependencies for testing
        def mock_get_db():
            pass
        
        def mock_get_current_user():
            return User(id=str(uuid.uuid4()), email="test@example.com", is_active=True)
        
        app.dependency_overrides[get_db] = mock_get_db
        app.dependency_overrides[get_current_user] = mock_get_current_user
        
        try:
            # Test that endpoint exists (should return validation error, not 404)
            response = client.post("/api/opaque/secret-tags/register", json={})
            assert response.status_code != 404, "Endpoint should exist"
            
        finally:
            # Clean up overrides
            app.dependency_overrides.clear()
    
    def test_registration_validation_success(self):
        """Test that valid OPAQUE data passes validation."""
        from app.schemas.opaque import OpaqueRegistrationRequest
        
        # This should not raise any validation errors
        request = OpaqueRegistrationRequest(**VALID_OPAQUE_DATA)
        
        # Verify the data was parsed correctly
        assert request.tag_name == "Test Secret Tag"
        assert request.color_code == "#FF5733"
        assert len(base64.b64decode(request.verifier_kv)) == 32
        assert len(base64.b64decode(request.salt)) == 16
    
    def test_registration_validation_failure(self):
        """Test that invalid OPAQUE data fails validation."""
        from app.schemas.opaque import OpaqueRegistrationRequest
        from pydantic import ValidationError
        
        # This should raise validation errors
        with pytest.raises(ValidationError) as exc_info:
            OpaqueRegistrationRequest(**INVALID_OPAQUE_DATA)
        
        errors = exc_info.value.errors()
        error_fields = [error['loc'][0] for error in errors]
        
        # Verify that expected fields have validation errors
        assert 'opaque_envelope' in error_fields
        assert 'verifier_kv' in error_fields
        assert 'salt' in error_fields
        assert 'tag_name' in error_fields
        assert 'color_code' in error_fields
    
    def test_base64_validation(self):
        """Test base64 validation for OPAQUE fields."""
        from app.schemas.opaque import OpaqueRegistrationRequest
        from pydantic import ValidationError
        
        # Test invalid base64
        invalid_data = VALID_OPAQUE_DATA.copy()
        invalid_data["opaque_envelope"] = "not_base64!"
        
        with pytest.raises(ValidationError) as exc_info:
            OpaqueRegistrationRequest(**invalid_data)
        
        errors = exc_info.value.errors()
        assert any(error['loc'][0] == 'opaque_envelope' for error in errors)
    
    def test_verifier_length_validation(self):
        """Test that verifier must be exactly 32 bytes when decoded."""
        from app.schemas.opaque import OpaqueRegistrationRequest
        from pydantic import ValidationError
        
        # Test wrong length verifier
        invalid_data = VALID_OPAQUE_DATA.copy()
        invalid_data["verifier_kv"] = base64.b64encode(b"wrong_length").decode()
        
        with pytest.raises(ValidationError) as exc_info:
            OpaqueRegistrationRequest(**invalid_data)
        
        errors = exc_info.value.errors()
        assert any(error['loc'][0] == 'verifier_kv' for error in errors)
    
    def test_salt_length_validation(self):
        """Test that salt must be exactly 16 bytes when decoded."""
        from app.schemas.opaque import OpaqueRegistrationRequest
        from pydantic import ValidationError
        
        # Test wrong length salt
        invalid_data = VALID_OPAQUE_DATA.copy()
        invalid_data["salt"] = base64.b64encode(b"wrong").decode()
        
        with pytest.raises(ValidationError) as exc_info:
            OpaqueRegistrationRequest(**invalid_data)
        
        errors = exc_info.value.errors()
        assert any(error['loc'][0] == 'salt' for error in errors)
    
    def test_color_code_validation(self):
        """Test color code hex validation."""
        from app.schemas.opaque import OpaqueRegistrationRequest
        from pydantic import ValidationError
        
        # Test invalid color codes
        invalid_colors = ["invalid", "#GGG", "#12345", "#1234567", "123456"]
        
        for invalid_color in invalid_colors:
            invalid_data = VALID_OPAQUE_DATA.copy()
            invalid_data["color_code"] = invalid_color
            
            with pytest.raises(ValidationError):
                OpaqueRegistrationRequest(**invalid_data)
        
        # Test valid color codes
        valid_colors = ["#000000", "#FFFFFF", "#FF5733", "#007AFF", "#abc123"]
        
        for valid_color in valid_colors:
            valid_data = VALID_OPAQUE_DATA.copy()
            valid_data["color_code"] = valid_color
            
            # Should not raise an exception
            request = OpaqueRegistrationRequest(**valid_data)
            assert request.color_code == valid_color
    
    def test_service_creation(self):
        """Test that OPAQUE service can be created."""
        from app.services.opaque_service import create_opaque_service
        
        # Mock database session
        class MockDB:
            pass
        
        mock_db = MockDB()
        service = create_opaque_service(mock_db)
        
        assert service is not None
        assert hasattr(service, 'register_secret_tag')
        assert hasattr(service, 'get_user_secret_tags')
    
    def test_health_endpoint(self):
        """Test the OPAQUE health check endpoint."""
        client = TestClient(app)
        
        response = client.get("/api/opaque/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "opaque-auth"
        assert "features" in data
        assert "registration" in data["features"]


if __name__ == "__main__":
    # Run basic tests
    test_instance = TestOpaqueRegistration()
    
    try:
        test_instance.test_registration_validation_success()
        print("✅ Registration validation test passed")
        
        test_instance.test_base64_validation()
        print("✅ Base64 validation test passed")
        
        test_instance.test_service_creation()
        print("✅ Service creation test passed")
        
        test_instance.test_health_endpoint()
        print("✅ Health endpoint test passed")
        
        print("✅ All basic OPAQUE tests passed!")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc() 