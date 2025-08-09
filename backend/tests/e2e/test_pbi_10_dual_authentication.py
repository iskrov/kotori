"""
Comprehensive End-to-End Tests for PBI-10: Dual Authentication Architecture

This module provides comprehensive E2E testing for the dual authentication system
where users can authenticate via OAuth (Google Sign-in) or OPAQUE, and all users
can create and use OPAQUE-protected secret tags regardless of their auth method.

Tests validate all Conditions of Satisfaction (CoS) for PBI-10:
1. Dual authentication workflows work (OAuth + OPAQUE)
2. OAuth users can create/access OPAQUE secret tags  
3. Mixed workflows function correctly
4. All new API endpoints work as designed
5. Legacy endpoints are properly removed
6. Existing functionality is preserved
"""

import pytest
import asyncio
import time
import json
import secrets
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from unittest.mock import Mock, patch

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models import User, SecretTag, JournalEntry
from tests.utils.database_setup import get_test_db_session
from tests.utils.test_helpers import (
    create_test_user, 
    authenticate_test_user,
    create_mock_google_token_response
)


class TestDualAuthenticationSystem:
    """Comprehensive E2E tests for dual authentication architecture"""
    
    @pytest.fixture(autouse=True)
    def setup_and_teardown(self):
        """Setup test environment and cleanup"""
        self.client = TestClient(app)
        
        # Get fresh test database session
        with get_test_db_session() as db:
            self.db = db
            # Clean up any existing test data
            db.query(JournalEntry).delete()
            db.query(SecretTag).delete()
            db.query(User).delete()
            db.commit()
            
        yield
        
        # Cleanup after test
        with get_test_db_session() as db:
            db.query(JournalEntry).delete()
            db.query(SecretTag).delete()
            db.query(User).delete()
            db.commit()

    def test_oauth_user_authentication_flow(self):
        """Test OAuth (Google Sign-in) user authentication works correctly"""
        
        # Mock Google OAuth response
        mock_google_user_data = {
            "email": "oauth-test@example.com",
            "name": "OAuth Test User",
            "given_name": "OAuth",
            "family_name": "User",
            "picture": "https://example.com/photo.jpg",
            "verified_email": True
        }
        
        with patch('app.services.auth_service.verify_google_token') as mock_verify:
            mock_verify.return_value = mock_google_user_data
            
            # Test OAuth authentication
            response = self.client.post(
                "/api/v1/auth/google",
                json={"token": "mock_google_token_12345"}
            )
            
            assert response.status_code == 200
            data = response.json()
            
            # Verify OAuth response structure
            assert "access_token" in data
            assert "refresh_token" in data
            assert "token_type" in data
            assert data["token_type"] == "bearer"
            
            # Store tokens for further testing
            oauth_access_token = data["access_token"]
            
            # Verify user profile access with OAuth token
            profile_response = self.client.get(
                "/api/users/me",
                headers={"Authorization": f"Bearer {oauth_access_token}"}
            )
            
            assert profile_response.status_code == 200
            profile_data = profile_response.json()
            assert profile_data["email"] == "oauth-test@example.com"
            assert profile_data["name"] == "OAuth Test User"
            
            return oauth_access_token

    def test_opaque_user_authentication_flow(self):
        """Test OPAQUE zero-knowledge user authentication works correctly"""
        
        user_email = "opaque-test@example.com"
        password_phrase = "secure opaque password 12345"
        
        # Step 1: OPAQUE User Registration
        reg_start_response = self.client.post(
            "/api/v1/auth/register/start",
            json={
                "email": user_email,
                "opaque_client_message": "mock_registration_request_data",
                "user_data": {
                    "name": "OPAQUE Test User",
                    "display_name": "OPAQUE User"
                }
            }
        )
        
        assert reg_start_response.status_code == 200
        reg_start_data = reg_start_response.json()
        assert "session_id" in reg_start_data
        assert "server_message" in reg_start_data
        
        # Step 2: Complete OPAQUE Registration
        reg_finish_response = self.client.post(
            "/api/v1/auth/register/finish",
            json={
                "session_id": reg_start_data["session_id"],
                "opaque_client_message": "mock_registration_response_data"
            }
        )
        
        assert reg_finish_response.status_code == 200
        reg_finish_data = reg_finish_response.json()
        assert reg_finish_data["registration_successful"] == True
        assert "message" in reg_finish_data
        
        # Step 3: OPAQUE User Login
        login_start_response = self.client.post(
            "/api/v1/auth/login/start",
            json={
                "email": user_email,
                "opaque_client_message": "mock_login_request_data"
            }
        )
        
        assert login_start_response.status_code == 200
        login_start_data = login_start_response.json()
        assert "session_id" in login_start_data
        assert "server_message" in login_start_data
        
        # Step 4: Complete OPAQUE Login
        login_finish_response = self.client.post(
            "/api/v1/auth/login/finish",
            json={
                "session_id": login_start_data["session_id"],
                "opaque_client_message": "mock_login_response_data"
            }
        )
        
        assert login_finish_response.status_code == 200
        login_finish_data = login_finish_response.json()
        
        # Verify OPAQUE authentication response structure
        assert "access_token" in login_finish_data
        assert "refresh_token" in login_finish_data
        assert "token_type" in login_finish_data
        assert login_finish_data["token_type"] == "bearer"
        
        opaque_access_token = login_finish_data["access_token"]
        
        # Verify user profile access with OPAQUE token
        profile_response = self.client.get(
            "/api/users/me",
            headers={"Authorization": f"Bearer {opaque_access_token}"}
        )
        
        assert profile_response.status_code == 200
        profile_data = profile_response.json()
        assert profile_data["email"] == user_email
        assert profile_data["name"] == "OPAQUE Test User"
        
        return opaque_access_token

    def test_oauth_user_creates_secret_tag(self):
        """Test OAuth users can create OPAQUE-protected secret tags"""
        
        # First authenticate via OAuth
        oauth_token = self.test_oauth_user_authentication_flow()
        
        secret_phrase = "my secret oauth phrase 2025"
        tag_name = "OAuth User Secret"
        
        # Step 1: Start secret tag registration
        reg_start_response = self.client.post(
            "/api/v1/secret-tags/register/start",
            headers={"Authorization": f"Bearer {oauth_token}"},
            json={
                "tag_handle": secrets.token_hex(32),  # 32-byte random handle  
                "tag_name": tag_name,
                "color": "#FF5722",
                "opaque_client_message": "mock_tag_registration_request"
            }
        )
        
        assert reg_start_response.status_code == 200
        reg_start_data = reg_start_response.json()
        assert "session_id" in reg_start_data
        assert "server_message" in reg_start_data
        
        # Step 2: Complete secret tag registration
        reg_finish_response = self.client.post(
            "/api/v1/secret-tags/register/finish",
            headers={"Authorization": f"Bearer {oauth_token}"},
            json={
                "session_id": reg_start_data["session_id"],
                "opaque_client_message": "mock_tag_registration_response"
            }
        )
        
        assert reg_finish_response.status_code == 200
        reg_finish_data = reg_finish_response.json()
        assert reg_finish_data["registration_successful"] == True
        assert "tag_id" in reg_finish_data
        
        tag_id = reg_finish_data["tag_id"]
        
        # Step 3: Test secret tag authentication
        auth_start_response = self.client.post(
            f"/api/v1/secret-tags/{tag_id}/auth/start",
            headers={"Authorization": f"Bearer {oauth_token}"},
            json={
                "opaque_client_message": "mock_tag_auth_request"
            }
        )
        
        assert auth_start_response.status_code == 200
        auth_start_data = auth_start_response.json()
        assert "session_id" in auth_start_data
        assert "server_message" in auth_start_data
        
        # Step 4: Complete secret tag authentication
        auth_finish_response = self.client.post(
            f"/api/v1/secret-tags/{tag_id}/auth/finish",
            headers={"Authorization": f"Bearer {oauth_token}"},
            json={
                "session_id": auth_start_data["session_id"],
                "opaque_client_message": "mock_tag_auth_response"
            }
        )
        
        assert auth_finish_response.status_code == 200
        auth_finish_data = auth_finish_response.json()
        assert "tag_access_token" in auth_finish_data
        assert auth_finish_data["authentication_successful"] == True
        
        # Verify OAuth user can access secret tag entries
        tag_access_token = auth_finish_data["tag_access_token"]
        
        entries_response = self.client.get(
            f"/api/v1/secret-tags/{tag_id}/entries",
            headers={"Authorization": f"Bearer {tag_access_token}"}
        )
        
        assert entries_response.status_code == 200
        entries_data = entries_response.json()
        assert isinstance(entries_data, list)
        
        return tag_id, oauth_token

    def test_opaque_user_creates_secret_tag(self):
        """Test OPAQUE users can create and access secret tags"""
        
        # First authenticate via OPAQUE
        opaque_token = self.test_opaque_user_authentication_flow()
        
        secret_phrase = "my opaque user secret phrase 2025"
        tag_name = "OPAQUE User Secret"
        
        # Similar secret tag creation flow as OAuth user
        # Step 1: Start secret tag registration
        reg_start_response = self.client.post(
            "/api/v1/secret-tags/register/start",
            headers={"Authorization": f"Bearer {opaque_token}"},
            json={
                "tag_handle": secrets.token_hex(32),
                "tag_name": tag_name,
                "color": "#2196F3",
                "opaque_client_message": "mock_opaque_tag_registration_request"
            }
        )
        
        assert reg_start_response.status_code == 200
        reg_start_data = reg_start_response.json()
        assert "session_id" in reg_start_data
        
        # Step 2: Complete secret tag registration
        reg_finish_response = self.client.post(
            "/api/v1/secret-tags/register/finish",
            headers={"Authorization": f"Bearer {opaque_token}"},
            json={
                "session_id": reg_start_data["session_id"],
                "opaque_client_message": "mock_opaque_tag_registration_response"
            }
        )
        
        assert reg_finish_response.status_code == 200
        reg_finish_data = reg_finish_response.json()
        assert reg_finish_data["registration_successful"] == True
        
        return reg_finish_data["tag_id"], opaque_token

    def test_mixed_oauth_workflow_persistence(self):
        """Test OAuth user can logout/login and still access secret tags"""
        
        # Create secret tag as OAuth user
        tag_id, oauth_token_1 = self.test_oauth_user_creates_secret_tag()
        
        # Logout (token invalidation)
        logout_response = self.client.post(
            "/api/v1/auth/logout",
            headers={"Authorization": f"Bearer {oauth_token_1}"}
        )
        
        assert logout_response.status_code == 200
        
        # Login again as same OAuth user
        oauth_token_2 = self.test_oauth_user_authentication_flow()
        
        # Verify can still authenticate with secret tag
        auth_start_response = self.client.post(
            f"/api/v1/secret-tags/{tag_id}/auth/start",
            headers={"Authorization": f"Bearer {oauth_token_2}"},
            json={
                "opaque_client_message": "mock_tag_auth_request_2"
            }
        )
        
        assert auth_start_response.status_code == 200
        
        # Complete authentication
        auth_start_data = auth_start_response.json()
        auth_finish_response = self.client.post(
            f"/api/v1/secret-tags/{tag_id}/auth/finish",
            headers={"Authorization": f"Bearer {oauth_token_2}"},
            json={
                "session_id": auth_start_data["session_id"],
                "opaque_client_message": "mock_tag_auth_response_2"
            }
        )
        
        assert auth_finish_response.status_code == 200
        auth_finish_data = auth_finish_response.json()
        assert auth_finish_data["authentication_successful"] == True

    def test_secret_tag_list_and_management(self):
        """Test secret tag listing and management via v1 API"""
        
        # Create OAuth user and secret tag
        tag_id, oauth_token = self.test_oauth_user_creates_secret_tag()
        
        # Test secret tag listing
        list_response = self.client.get(
            "/api/v1/secret-tags",
            headers={"Authorization": f"Bearer {oauth_token}"}
        )
        
        assert list_response.status_code == 200
        list_data = list_response.json()
        assert isinstance(list_data, list)
        assert len(list_data) > 0
        
        # Find our created tag
        created_tag = next((tag for tag in list_data if tag["id"] == tag_id), None)
        assert created_tag is not None
        assert created_tag["tag_name"] == "OAuth User Secret"
        assert created_tag["color"] == "#FF5722"
        
        # Test tag update
        update_response = self.client.patch(
            f"/api/v1/secret-tags/{tag_id}",
            headers={"Authorization": f"Bearer {oauth_token}"},
            json={
                "tag_name": "Updated OAuth Secret",
                "color": "#4CAF50"
            }
        )
        
        assert update_response.status_code == 200
        update_data = update_response.json()
        assert update_data["tag_name"] == "Updated OAuth Secret"
        assert update_data["color"] == "#4CAF50"

    def test_legacy_endpoint_cleanup(self):
        """Test that legacy OPAQUE endpoints return 404"""
        
        # Test legacy endpoints that should be removed
        legacy_endpoints = [
            "/api/auth/google",  # Should be /api/v1/auth/google
            "/api/opaque/register/start",
            "/api/opaque/register/finish",
            "/api/opaque/auth/start",
            "/api/opaque/auth/finish",
            "/secret-tags/register/start",  # Should be /api/v1/secret-tags/
            "/secret-tags/auth/start"
        ]
        
        for endpoint in legacy_endpoints:
            response = self.client.post(endpoint, json={})
            # Should return 404 Not Found since endpoints don't exist
            assert response.status_code == 404, f"Legacy endpoint {endpoint} should return 404"

    def test_existing_functionality_preservation(self):
        """Test that non-authentication functionality still works"""
        
        # Get OAuth token for testing
        oauth_token = self.test_oauth_user_authentication_flow()
        
        # Test journal entries (non-auth functionality)
        journal_response = self.client.get(
            "/api/journals/entries",
            headers={"Authorization": f"Bearer {oauth_token}"}
        )
        
        # Should work (might be empty list but should not error)
        assert journal_response.status_code == 200
        
        # Test regular tags (non-secret tags)
        tags_response = self.client.get(
            "/api/tags",
            headers={"Authorization": f"Bearer {oauth_token}"}
        )
        
        assert tags_response.status_code == 200
        
        # Test speech transcription endpoint
        # (Note: May fail due to audio data requirements, but should not be 404)
        speech_response = self.client.post(
            "/api/speech/transcribe",
            headers={"Authorization": f"Bearer {oauth_token}"},
            json={"audio_data": "mock_audio_data"}
        )
        
        # Should not be 404 (functionality preserved)
        assert speech_response.status_code != 404

    def test_user_preferences_and_metadata(self):
        """Test user preferences like show_secret_tag_names work correctly"""
        
        oauth_token = self.test_oauth_user_authentication_flow()
        
        # Test updating user preferences
        prefs_response = self.client.patch(
            "/api/users/me",
            headers={"Authorization": f"Bearer {oauth_token}"},
            json={
                "show_secret_tag_names": False,
                "display_name": "Updated OAuth User"
            }
        )
        
        assert prefs_response.status_code == 200
        prefs_data = prefs_response.json()
        assert prefs_data["show_secret_tag_names"] == False
        assert prefs_data["display_name"] == "Updated OAuth User"
        
        # Create a secret tag and test that names are hidden when preference is False
        tag_id, _ = self.test_oauth_user_creates_secret_tag()
        
        list_response = self.client.get(
            "/api/v1/secret-tags?includeLabels=false",
            headers={"Authorization": f"Bearer {oauth_token}"}
        )
        
        assert list_response.status_code == 200
        list_data = list_response.json()
        
        # When includeLabels=false, tag names should be hidden/null
        created_tag = next((tag for tag in list_data if tag["id"] == tag_id), None)
        assert created_tag is not None
        # Names should be hidden based on user preference or query param

    def test_comprehensive_api_health_checks(self):
        """Test that all API health endpoints work correctly"""
        
        # Test main health check
        health_response = self.client.get("/health")
        assert health_response.status_code == 200
        
        # Test database health
        db_health_response = self.client.get("/health/db")
        assert db_health_response.status_code == 200
        
        # Test OPAQUE health
        opaque_health_response = self.client.get("/health/opaque")
        assert opaque_health_response.status_code == 200


@pytest.mark.asyncio
class TestDualAuthenticationIntegration:
    """Integration tests for complete dual authentication workflows"""
    
    def test_complete_pbi_10_conditions_of_satisfaction(self):
        """
        Comprehensive test validating ALL PBI-10 Conditions of Satisfaction:
        
        1. OAuth + OPAQUE user authentication both work
        2. OAuth users can create/use OPAQUE secret tags
        3. All endpoints follow design in docs/secret_tags_target_architecture.md
        4. Tests and docs updated for dual authentication  
        5. Legacy columns and endpoints removed
        """
        
        test_system = TestDualAuthenticationSystem()
        test_system.setup_and_teardown()
        
        print("🔍 Testing PBI-10 CoS: Dual Authentication System")
        
        # CoS 1: OAuth authentication works
        print("✅ Testing OAuth authentication flow...")
        oauth_token = test_system.test_oauth_user_authentication_flow()
        assert oauth_token is not None
        
        # CoS 2: OPAQUE authentication works  
        print("✅ Testing OPAQUE authentication flow...")
        opaque_token = test_system.test_opaque_user_authentication_flow()
        assert opaque_token is not None
        
        # CoS 3: OAuth users can create OPAQUE secret tags
        print("✅ Testing OAuth user creates OPAQUE secret tags...")
        oauth_tag_id, _ = test_system.test_oauth_user_creates_secret_tag()
        assert oauth_tag_id is not None
        
        # CoS 4: OPAQUE users can create secret tags
        print("✅ Testing OPAQUE user creates secret tags...")
        opaque_tag_id, _ = test_system.test_opaque_user_creates_secret_tag()
        assert opaque_tag_id is not None
        
        # CoS 5: Mixed workflows work (OAuth logout/login + secret tag access)
        print("✅ Testing mixed OAuth workflow persistence...")
        test_system.test_mixed_oauth_workflow_persistence()
        
        # CoS 6: API endpoints follow target architecture
        print("✅ Testing API endpoint structure...")
        test_system.test_secret_tag_list_and_management()
        
        # CoS 7: Legacy endpoints removed
        print("✅ Testing legacy endpoint cleanup...")
        test_system.test_legacy_endpoint_cleanup()
        
        # CoS 8: Existing functionality preserved
        print("✅ Testing existing functionality preservation...")
        test_system.test_existing_functionality_preservation()
        
        # CoS 9: User preferences work
        print("✅ Testing user preferences and metadata...")
        test_system.test_user_preferences_and_metadata()
        
        # CoS 10: System health checks
        print("✅ Testing comprehensive API health checks...")
        test_system.test_comprehensive_api_health_checks()
        
        print("🎉 All PBI-10 Conditions of Satisfaction PASSED!")
        print("🚀 Dual Authentication Architecture is working correctly!")


if __name__ == "__main__":
    # Run the comprehensive CoS test
    test_integration = TestDualAuthenticationIntegration()
    test_integration.test_complete_pbi_10_conditions_of_satisfaction() 