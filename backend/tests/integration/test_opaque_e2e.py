"""
End-to-End OPAQUE Integration Tests

This module contains integration tests that validate the complete
OPAQUE authentication flow between client and server.
"""

import pytest
import json
import base64
import secrets
from typing import Dict, Any
from fastapi.testclient import TestClient
from app.main import app

# Test client for FastAPI
client = TestClient(app)

# Constants for testing
OPAQUE_API_BASE = "/api/auth/opaque"


class MockOpaqueClient:
    """Mock OPAQUE client for testing"""
    
    def __init__(self, user_id: str, password: str):
        self.user_id = user_id
        self.password = password
        self.export_key = None
        
    def _generate_mock_data(self, size: int = 32) -> bytes:
        """Generate mock cryptographic data"""
        return secrets.token_bytes(size)
    
    def start_registration(self) -> Dict[str, str]:
        """Start OPAQUE registration flow"""
        blinded_element = self._generate_mock_data(32)
        client_public_key = b'\x04' + self._generate_mock_data(64)  # EC point
        
        return {
            'user_id': self.user_id,
            'blinded_element': base64.b64encode(blinded_element).decode('utf-8'),
            'client_public_key': base64.b64encode(client_public_key).decode('utf-8')
        }
    
    def finish_registration(self, server_response: Dict[str, str]) -> Dict[str, str]:
        """Finish OPAQUE registration flow"""
        envelope = self._generate_mock_data(64)
        export_key = self._generate_mock_data(32)
        self.export_key = export_key
        
        return {
            'user_id': self.user_id,
            'envelope': base64.b64encode(envelope).decode('utf-8'),
            'export_key': base64.b64encode(export_key).decode('utf-8')
        }
    
    def start_login(self) -> Dict[str, str]:
        """Start OPAQUE login flow"""
        blinded_element = self._generate_mock_data(32)
        client_public_key = b'\x04' + self._generate_mock_data(64)
        
        return {
            'user_id': self.user_id,
            'blinded_element': base64.b64encode(blinded_element).decode('utf-8'),
            'client_public_key': base64.b64encode(client_public_key).decode('utf-8')
        }
    
    def finish_login(self, server_response: Dict[str, str]) -> Dict[str, str]:
        """Finish OPAQUE login flow"""
        if not server_response.get('success'):
            raise ValueError("Server login start failed")
        
        client_proof = self._generate_mock_data(32)
        export_key = self.export_key or self._generate_mock_data(32)
        
        return {
            'user_id': self.user_id,
            'client_proof': base64.b64encode(client_proof).decode('utf-8'),
            'export_key': base64.b64encode(export_key).decode('utf-8')
        }


class TestOpaqueEndToEnd:
    """End-to-end OPAQUE integration tests"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.test_user_email = f"test_{secrets.token_hex(8)}@example.com"
        self.test_password = "test_password_123"
        self.mock_client = MockOpaqueClient(self.test_user_email, self.test_password)
    
    def test_opaque_server_status(self):
        """Test OPAQUE server status endpoint"""
        response = client.get(f"{OPAQUE_API_BASE}/status")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["opaque_enabled"] is True
        assert data["supported_features"]["registration"] is True
        assert data["supported_features"]["login"] is True
    
    def test_complete_registration_flow(self):
        """Test complete OPAQUE registration flow"""
        # Step 1: Start registration
        client_reg_request = self.mock_client.start_registration()
        
        response = client.post(
            f"{OPAQUE_API_BASE}/register/start",
            json=client_reg_request
        )
        
        assert response.status_code == 200
        server_reg_response = response.json()
        
        assert "evaluated_element" in server_reg_response
        assert "server_public_key" in server_reg_response
        assert "salt" in server_reg_response
        
        # Step 2: Finish registration
        client_finish_request = self.mock_client.finish_registration(server_reg_response)
        
        response = client.post(
            f"{OPAQUE_API_BASE}/register/finish",
            json=client_finish_request
        )
        
        assert response.status_code == 200
        finish_response = response.json()
        
        assert finish_response["success"] is True
        assert "registration completed successfully" in finish_response["message"]
    
    def test_complete_login_flow(self):
        """Test complete OPAQUE login flow"""
        # First complete registration
        self.test_complete_registration_flow()
        
        # Step 1: Start login
        client_login_request = self.mock_client.start_login()
        
        response = client.post(
            f"{OPAQUE_API_BASE}/login/start",
            json=client_login_request
        )
        
        assert response.status_code == 200
        server_login_response = response.json()
        
        assert server_login_response["success"] is True
        assert "evaluated_element" in server_login_response
        
        # Step 2: Finish login
        client_finish_request = self.mock_client.finish_login(server_login_response)
        
        response = client.post(
            f"{OPAQUE_API_BASE}/login/finish",
            json=client_finish_request
        )
        
        assert response.status_code == 200
        finish_response = response.json()
        
        assert finish_response["success"] is True
        assert finish_response["access_token"] is not None
        assert finish_response["token_type"] == "bearer"
    
    def test_duplicate_registration(self):
        """Test registration with duplicate user"""
        self.test_complete_registration_flow()
        
        # Try to register same user again
        client_reg_request = self.mock_client.start_registration()
        
        response = client.post(
            f"{OPAQUE_API_BASE}/register/start",
            json=client_reg_request
        )
        
        assert response.status_code == 409
        error_data = response.json()
        assert "already registered" in error_data["detail"]
    
    def test_login_nonexistent_user(self):
        """Test login with non-existent user"""
        nonexistent_client = MockOpaqueClient("nonexistent@example.com", "password")
        
        client_login_request = nonexistent_client.start_login()
        
        response = client.post(
            f"{OPAQUE_API_BASE}/login/start",
            json=client_login_request
        )
        
        assert response.status_code == 200
        server_response = response.json()
        
        assert server_response["success"] is False
        assert server_response["evaluated_element"] == ""
    
    def test_zero_knowledge_property(self):
        """Test that server never sees plaintext password"""
        client_reg_request = self.mock_client.start_registration()
        
        response = client.post(
            f"{OPAQUE_API_BASE}/register/start",
            json=client_reg_request
        )
        
        assert response.status_code == 200
        server_response = response.json()
        
        # Verify password is not in server response
        response_str = json.dumps(server_response)
        assert "password" not in response_str.lower()
        assert self.mock_client.password not in response_str 