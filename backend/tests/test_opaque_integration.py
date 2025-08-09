"""
Real OPAQUE Integration Tests

Tests complete end-to-end flows combining user authentication and secret tag operations.
NO MOCKING - Tests actual cryptographic operations with real Node.js OPAQUE server.

This test suite validates:
- Complete OPAQUE user registration → secret tag creation → secret tag access
- OAuth user authentication → secret tag creation → secret tag access  
- Mixed authentication scenarios (OAuth users with OPAQUE secret tags)
- Cross-user security boundaries
- Session management across multiple operations
- Real base64 encoding/decoding throughout the entire flow
- Error handling in complex scenarios
"""

import pytest
import base64
import json
import subprocess
import uuid
import secrets
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models import User, SecretTag
from app.models.secret_tag_opaque import OpaqueSession
from app.core.security import create_access_token, validate_security_token as verify_token


# Test constants
OPAQUE_USER_EMAIL = "integration_opaque_user@example.com"
OAUTH_USER_EMAIL = "integration_oauth_user@example.com"
USER_PASSWORD = "IntegrationTestPassword123!"
SECRET_PHRASE_1 = "MyFirstSecretPhrase123!"
SECRET_PHRASE_2 = "MySecondSecretPhrase456!"

def check_node_js_available() -> bool:
    """Check if Node.js and @serenity-kit/opaque are available."""
    try:
        result = subprocess.run(
            ['node', '-e', 'console.log(require("@serenity-kit/opaque").ready ? "ready" : "not ready")'],
            capture_output=True,
            text=True,
            timeout=10
        )
        return result.returncode == 0 and "ready" in result.stdout
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False

def complete_opaque_user_registration(client_app, email: str, password: str, name: str) -> dict:
    """Complete OPAQUE user registration flow and return user data with token."""
    
    # Generate real OPAQUE registration request
    script = f"""
const opaque = require('@serenity-kit/opaque');

async function generateRegistrationRequest() {{
    try {{
        if (opaque.ready) {{
            await opaque.ready;
        }}
        
        const {{ clientRegistrationState, registrationRequest }} = opaque.client.startRegistration({{
            password: '{password}'
        }});
        
        console.log(JSON.stringify({{ 
            success: true, 
            clientRegistrationState,
            registrationRequest 
        }}));
    }} catch (error) {{
        console.log(JSON.stringify({{ success: false, error: error.message }}));
    }}
}}

generateRegistrationRequest();
"""
    
    result = subprocess.run(['node', '-e', script], capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        raise RuntimeError(f"Failed to generate OPAQUE registration request: {result.stderr}")
    
    response = json.loads(result.stdout.strip())
    if not response.get('success'):
        raise RuntimeError(f"OPAQUE registration request failed: {response.get('error')}")
    
    client_state = response['clientRegistrationState']
    registration_request = response['registrationRequest']
    
    # Start registration
    start_response = client_app.post("/api/v1/auth/register/start", json={
        "userIdentifier": email,
        "opaque_registration_request": registration_request,
        "name": name
    })
    
    assert start_response.status_code == 200, f"Registration start failed: {start_response.text}"
    start_data = start_response.json()
    
    # Finish registration
    script = f"""
const opaque = require('@serenity-kit/opaque');

async function finishRegistration() {{
    try {{
        if (opaque.ready) {{
            await opaque.ready;
        }}
        
        const {{ registrationRecord }} = opaque.client.finishRegistration({{
            clientRegistrationState: '{client_state}',
            registrationResponse: '{start_data["opaque_registration_response"]}',
            password: '{password}'
        }});
        
        console.log(JSON.stringify({{ 
            success: true, 
            registrationRecord 
        }}));
    }} catch (error) {{
        console.log(JSON.stringify({{ success: false, error: error.message }}));
    }}
}}

finishRegistration();
"""
    
    result = subprocess.run(['node', '-e', script], capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        raise RuntimeError(f"Failed to finish OPAQUE registration: {result.stderr}")
    
    response = json.loads(result.stdout.strip())
    if not response.get('success'):
        raise RuntimeError(f"OPAQUE registration finish failed: {response.get('error')}")
    
    registration_record = response['registrationRecord']
    
    finish_response = client_app.post("/api/v1/auth/register/finish", json={
        "session_id": start_data["session_id"],
        "userIdentifier": email,
        "opaque_registration_record": registration_record
    })
    
    assert finish_response.status_code == 200, f"Registration finish failed: {finish_response.text}"
    return finish_response.json()

def complete_opaque_secret_tag_registration(client_app, auth_headers, tag_name: str, secret_phrase: str, color: str = "#FF5722") -> dict:
    """Complete OPAQUE secret tag registration flow and return tag data."""
    
    # Generate real OPAQUE registration request for tag
    script = f"""
const opaque = require('@serenity-kit/opaque');

async function generateTagRegistrationRequest() {{
    try {{
        if (opaque.ready) {{
            await opaque.ready;
        }}
        
        const {{ clientRegistrationState, registrationRequest }} = opaque.client.startRegistration({{
            password: '{secret_phrase}'
        }});
        
        console.log(JSON.stringify({{ 
            success: true, 
            clientRegistrationState,
            registrationRequest 
        }}));
    }} catch (error) {{
        console.log(JSON.stringify({{ success: false, error: error.message }}));
    }}
}}

generateTagRegistrationRequest();
"""
    
    result = subprocess.run(['node', '-e', script], capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        raise RuntimeError(f"Failed to generate OPAQUE tag registration request: {result.stderr}")
    
    response = json.loads(result.stdout.strip())
    if not response.get('success'):
        raise RuntimeError(f"OPAQUE tag registration request failed: {response.get('error')}")
    
    client_state = response['clientRegistrationState']
    registration_request = response['registrationRequest']
    
    # Start tag registration
    start_response = client_app.post("/api/v1/secret-tags/register/start", 
        headers=auth_headers,
        json={
            "tag_name": tag_name,
            "color": color,
            "opaque_registration_request": registration_request
        }
    )
    
    assert start_response.status_code == 200, f"Tag registration start failed: {start_response.text}"
    start_data = start_response.json()
    
    # Finish tag registration
    script = f"""
const opaque = require('@serenity-kit/opaque');

async function finishTagRegistration() {{
    try {{
        if (opaque.ready) {{
            await opaque.ready;
        }}
        
        const {{ registrationRecord }} = opaque.client.finishRegistration({{
            clientRegistrationState: '{client_state}',
            registrationResponse: '{start_data["opaque_registration_response"]}',
            password: '{secret_phrase}'
        }});
        
        console.log(JSON.stringify({{ 
            success: true, 
            registrationRecord 
        }}));
    }} catch (error) {{
        console.log(JSON.stringify({{ success: false, error: error.message }}));
    }}
}}

finishTagRegistration();
"""
    
    result = subprocess.run(['node', '-e', script], capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        raise RuntimeError(f"Failed to finish OPAQUE tag registration: {result.stderr}")
    
    response = json.loads(result.stdout.strip())
    if not response.get('success'):
        raise RuntimeError(f"OPAQUE tag registration finish failed: {response.get('error')}")
    
    registration_record = response['registrationRecord']
    
    finish_response = client_app.post("/api/v1/secret-tags/register/finish",
        headers=auth_headers,
        json={
            "session_id": start_data["session_id"],
            "opaque_registration_record": registration_record
        }
    )
    
    assert finish_response.status_code == 200, f"Tag registration finish failed: {finish_response.text}"
    
    result = finish_response.json()
    result["tag_handle"] = start_data["tag_handle"]  # Include handle for auth
    return result

def authenticate_with_secret_tag(client_app, auth_headers, tag_handle: str, secret_phrase: str) -> dict:
    """Authenticate with a secret tag and return access token."""
    
    # Generate real OPAQUE auth request for tag
    script = f"""
const opaque = require('@serenity-kit/opaque');

async function generateTagAuthRequest() {{
    try {{
        if (opaque.ready) {{
            await opaque.ready;
        }}
        
        const {{ clientLoginState, startLoginRequest }} = opaque.client.startLogin({{
            password: '{secret_phrase}'
        }});
        
        console.log(JSON.stringify({{ 
            success: true, 
            clientLoginState,
            startLoginRequest 
        }}));
    }} catch (error) {{
        console.log(JSON.stringify({{ success: false, error: error.message }}));
    }}
}}

generateTagAuthRequest();
"""
    
    result = subprocess.run(['node', '-e', script], capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        raise RuntimeError(f"Failed to generate OPAQUE tag auth request: {result.stderr}")
    
    response = json.loads(result.stdout.strip())
    if not response.get('success'):
        raise RuntimeError(f"OPAQUE tag auth request failed: {response.get('error')}")
    
    client_state = response['clientLoginState']
    auth_request = response['startLoginRequest']
    
    # Start tag authentication
    auth_start_response = client_app.post(f"/api/v1/secret-tags/{tag_handle}/auth/start",
        headers=auth_headers,
        json={
            "client_credential_request": auth_request
        }
    )
    
    assert auth_start_response.status_code == 200, f"Tag auth start failed: {auth_start_response.text}"
    auth_start_data = auth_start_response.json()
    
    # Finish tag authentication
    script = f"""
const opaque = require('@serenity-kit/opaque');

async function finishTagAuth() {{
    try {{
        if (opaque.ready) {{
            await opaque.ready;
        }}
        
        const {{ finishLoginRequest }} = opaque.client.finishLogin({{
            clientLoginState: '{client_state}',
            loginResponse: '{auth_start_data["server_credential_response"]}',
            password: '{secret_phrase}'
        }});
        
        console.log(JSON.stringify({{ 
            success: true, 
            finishLoginRequest 
        }}));
    }} catch (error) {{
        console.log(JSON.stringify({{ success: false, error: error.message }}));
    }}
}}

finishTagAuth();
"""
    
    result = subprocess.run(['node', '-e', script], capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        raise RuntimeError(f"Failed to finish OPAQUE tag auth: {result.stderr}")
    
    response = json.loads(result.stdout.strip())
    if not response.get('success'):
        raise RuntimeError(f"OPAQUE tag auth finish failed: {response.get('error')}")
    
    auth_finalization = response['finishLoginRequest']
    
    auth_finish_response = client_app.post(f"/api/v1/secret-tags/{tag_handle}/auth/finish",
        headers=auth_headers,
        json={
            "session_id": auth_start_data["session_id"],
            "client_credential_finalization": auth_finalization
        }
    )
    
    assert auth_finish_response.status_code == 200, f"Tag auth finish failed: {auth_finish_response.text}"
    return auth_finish_response.json()


@pytest.mark.opaque
@pytest.mark.integration
@pytest.mark.e2e
@pytest.mark.slow
@pytest.mark.skipif(not check_node_js_available(), reason="Node.js with @serenity-kit/opaque not available")
class TestOpaqueIntegration:
    """Test complete integration flows with real OPAQUE operations."""

    @pytest.fixture(autouse=True)
    def setup_and_cleanup(self, db_session: Session):
        """Set up test environment and clean up after each test."""
        # Clean up any existing test data
        db_session.query(SecretTag).filter(
            SecretTag.tag_name.like("%Integration%")
        ).delete(synchronize_session=False)
        db_session.query(User).filter(
            User.email.in_([OPAQUE_USER_EMAIL, OAUTH_USER_EMAIL])
        ).delete(synchronize_session=False)
        db_session.query(OpaqueSession).delete()
        db_session.commit()
        
        yield
        
        # Clean up after test
        db_session.query(SecretTag).filter(
            SecretTag.tag_name.like("%Integration%")
        ).delete(synchronize_session=False)
        db_session.query(User).filter(
            User.email.in_([OPAQUE_USER_EMAIL, OAUTH_USER_EMAIL])
        ).delete(synchronize_session=False)
        db_session.query(OpaqueSession).delete()
        db_session.commit()

    @pytest.fixture
    def oauth_user(self, db_session: Session):
        """Create an OAuth test user."""
        user = User(
            id=uuid.uuid4(),
            email=OAUTH_USER_EMAIL,
            full_name="Integration OAuth User",
            google_id="integration_oauth_123",
            opaque_envelope=None,  # OAuth users don't have OPAQUE envelope
            is_active=True,
            is_superuser=False
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user

    @pytest.fixture
    def oauth_auth_headers(self, oauth_user):
        """Create authentication headers for OAuth user."""
        access_token = create_access_token(subject=oauth_user.id)
        return {"Authorization": f"Bearer {access_token}"}

    @pytest.fixture
    def client_app(self, db_session):
        """Create test client with database override."""
        from app.dependencies import get_db
        
        def override_get_db():
            yield db_session
        
        app.dependency_overrides[get_db] = override_get_db
        
        try:
            with TestClient(app) as client:
                yield client
        finally:
            app.dependency_overrides.clear()

    def test_complete_opaque_user_with_secret_tags_flow(self, client_app, db_session):
        """Test complete flow: OPAQUE user registration → login → create secret tags → authenticate with tags."""
        
        # Step 1: Register OPAQUE user
        user_data = complete_opaque_user_registration(
            client_app, OPAQUE_USER_EMAIL, USER_PASSWORD, "Integration OPAQUE User"
        )
        
        assert user_data["success"] is True
        assert user_data["user"]["email"] == OPAQUE_USER_EMAIL
        user_token = user_data["access_token"]
        user_headers = {"Authorization": f"Bearer {user_token}"}
        
        # Verify user in database
        user = db_session.query(User).filter(User.email == OPAQUE_USER_EMAIL).first()
        assert user is not None
        assert user.google_id is None  # OPAQUE user
        assert user.opaque_envelope is not None  # Has OPAQUE data
        
        # Step 2: Create first secret tag
        tag1_data = complete_opaque_secret_tag_registration(
            client_app, user_headers, "Integration Secret Tag 1", SECRET_PHRASE_1, "#FF5722"
        )
        
        assert tag1_data["success"] is True
        assert tag1_data["tag_name"] == "Integration Secret Tag 1"
        tag1_handle = tag1_data["tag_handle"]
        
        # Step 3: Create second secret tag
        tag2_data = complete_opaque_secret_tag_registration(
            client_app, user_headers, "Integration Secret Tag 2", SECRET_PHRASE_2, "#2196F3"
        )
        
        assert tag2_data["success"] is True
        assert tag2_data["tag_name"] == "Integration Secret Tag 2"
        tag2_handle = tag2_data["tag_handle"]
        
        # Step 4: List secret tags
        list_response = client_app.get("/api/v1/secret-tags", headers=user_headers)
        assert list_response.status_code == 200
        
        list_data = list_response.json()
        assert len(list_data["tags"]) == 2
        
        tag_names = [tag["tag_name"] for tag in list_data["tags"]]
        assert "Integration Secret Tag 1" in tag_names
        assert "Integration Secret Tag 2" in tag_names
        
        # Step 5: Authenticate with first secret tag
        auth1_data = authenticate_with_secret_tag(
            client_app, user_headers, tag1_handle, SECRET_PHRASE_1
        )
        
        assert auth1_data["success"] is True
        assert "tag_access_token" in auth1_data
        tag1_token = auth1_data["tag_access_token"]
        assert len(tag1_token) > 50  # Valid JWT
        
        # Step 6: Authenticate with second secret tag
        auth2_data = authenticate_with_secret_tag(
            client_app, user_headers, tag2_handle, SECRET_PHRASE_2
        )
        
        assert auth2_data["success"] is True
        assert "tag_access_token" in auth2_data
        tag2_token = auth2_data["tag_access_token"]
        assert len(tag2_token) > 50  # Valid JWT
        
        # Verify tokens are different
        assert tag1_token != tag2_token
        
        # Verify all sessions were cleaned up
        remaining_sessions = db_session.query(OpaqueSession).count()
        assert remaining_sessions == 0, "All OPAQUE sessions should be cleaned up"

    def test_oauth_user_with_opaque_secret_tags_flow(self, client_app, oauth_auth_headers, oauth_user, db_session):
        """Test OAuth user creating and using OPAQUE secret tags."""
        
        # Step 1: OAuth user creates secret tags (using OPAQUE for tags)
        tag1_data = complete_opaque_secret_tag_registration(
            client_app, oauth_auth_headers, "OAuth User Integration Tag 1", SECRET_PHRASE_1, "#9C27B0"
        )
        
        assert tag1_data["success"] is True
        assert tag1_data["tag_name"] == "OAuth User Integration Tag 1"
        tag1_handle = tag1_data["tag_handle"]
        
        tag2_data = complete_opaque_secret_tag_registration(
            client_app, oauth_auth_headers, "OAuth User Integration Tag 2", SECRET_PHRASE_2, "#FF9800"
        )
        
        assert tag2_data["success"] is True
        tag2_handle = tag2_data["tag_handle"]
        
        # Step 2: Verify tags are associated with OAuth user
        list_response = client_app.get("/api/v1/secret-tags", headers=oauth_auth_headers)
        assert list_response.status_code == 200
        
        list_data = list_response.json()
        assert len(list_data["tags"]) == 2
        
        # Step 3: Authenticate with secret tags (OPAQUE auth for tags)
        auth1_data = authenticate_with_secret_tag(
            client_app, oauth_auth_headers, tag1_handle, SECRET_PHRASE_1
        )
        
        assert auth1_data["success"] is True
        assert "tag_access_token" in auth1_data
        
        auth2_data = authenticate_with_secret_tag(
            client_app, oauth_auth_headers, tag2_handle, SECRET_PHRASE_2
        )
        
        assert auth2_data["success"] is True
        assert "tag_access_token" in auth2_data
        
        # Verify tags in database belong to OAuth user
        tags = db_session.query(SecretTag).filter(
            SecretTag.user_id == oauth_user.id
        ).all()
        
        assert len(tags) == 2
        for tag in tags:
            assert tag.opaque_envelope is not None  # Tags use OPAQUE regardless of user auth method
            assert len(tag.tag_handle) == 32  # Proper tag handle

    def test_cross_user_security_boundaries(self, client_app, oauth_auth_headers, oauth_user, db_session):
        """Test that users cannot access each other's secret tags."""
        
        # Step 1: Create OPAQUE user and their secret tag
        opaque_user_data = complete_opaque_user_registration(
            client_app, OPAQUE_USER_EMAIL, USER_PASSWORD, "Integration OPAQUE User"
        )
        
        opaque_user_token = opaque_user_data["access_token"]
        opaque_user_headers = {"Authorization": f"Bearer {opaque_user_token}"}
        
        opaque_tag_data = complete_opaque_secret_tag_registration(
            client_app, opaque_user_headers, "OPAQUE User Private Tag", SECRET_PHRASE_1, "#E91E63"
        )
        
        opaque_tag_handle = opaque_tag_data["tag_handle"]
        
        # Step 2: Create OAuth user's secret tag
        oauth_tag_data = complete_opaque_secret_tag_registration(
            client_app, oauth_auth_headers, "OAuth User Private Tag", SECRET_PHRASE_2, "#607D8B"
        )
        
        oauth_tag_handle = oauth_tag_data["tag_handle"]
        
        # Step 3: Verify OAuth user cannot access OPAQUE user's tag
        script = f"""
const opaque = require('@serenity-kit/opaque');

async function generateTagAuthRequest() {{
    try {{
        if (opaque.ready) {{
            await opaque.ready;
        }}
        
        const {{ clientLoginState, startLoginRequest }} = opaque.client.startLogin({{
            password: '{SECRET_PHRASE_1}'
        }});
        
        console.log(JSON.stringify({{ 
            success: true, 
            clientLoginState,
            startLoginRequest 
        }}));
    }} catch (error) {{
        console.log(JSON.stringify({{ success: false, error: error.message }}));
    }}
}}

generateTagAuthRequest();
"""
        
        result = subprocess.run(['node', '-e', script], capture_output=True, text=True, timeout=30)
        response = json.loads(result.stdout.strip())
        auth_request = response['startLoginRequest']
        
        # OAuth user tries to access OPAQUE user's tag
        cross_access_response = client_app.post(f"/api/v1/secret-tags/{opaque_tag_handle}/auth/start",
            headers=oauth_auth_headers,  # OAuth user's headers
            json={
                "client_credential_request": auth_request
            }
        )
        
        # Should fail - OAuth user cannot access OPAQUE user's tag
        assert cross_access_response.status_code == 404, "Should not allow cross-user tag access"
        
        # Step 4: Verify OPAQUE user cannot access OAuth user's tag
        cross_access_response2 = client_app.post(f"/api/v1/secret-tags/{oauth_tag_handle}/auth/start",
            headers=opaque_user_headers,  # OPAQUE user's headers
            json={
                "client_credential_request": auth_request
            }
        )
        
        # Should fail - OPAQUE user cannot access OAuth user's tag
        assert cross_access_response2.status_code == 404, "Should not allow cross-user tag access"
        
        # Step 5: Verify users can only list their own tags
        opaque_list = client_app.get("/api/v1/secret-tags", headers=opaque_user_headers)
        assert opaque_list.status_code == 200
        opaque_tags = opaque_list.json()["tags"]
        assert len(opaque_tags) == 1
        assert opaque_tags[0]["tag_name"] == "OPAQUE User Private Tag"
        
        oauth_list = client_app.get("/api/v1/secret-tags", headers=oauth_auth_headers)
        assert oauth_list.status_code == 200
        oauth_tags = oauth_list.json()["tags"]
        assert len(oauth_tags) == 1
        assert oauth_tags[0]["tag_name"] == "OAuth User Private Tag"

    def test_mixed_authentication_persistence(self, client_app, oauth_auth_headers, oauth_user, db_session):
        """Test that secret tag access persists across user authentication sessions."""
        
        # Step 1: OAuth user creates secret tag
        tag_data = complete_opaque_secret_tag_registration(
            client_app, oauth_auth_headers, "Persistent Integration Tag", SECRET_PHRASE_1, "#4CAF50"
        )
        
        tag_handle = tag_data["tag_handle"]
        
        # Step 2: Authenticate with secret tag
        auth_data = authenticate_with_secret_tag(
            client_app, oauth_auth_headers, tag_handle, SECRET_PHRASE_1
        )
        
        assert auth_data["success"] is True
        first_tag_token = auth_data["tag_access_token"]
        
        # Step 3: Simulate new user session (new JWT token)
        new_user_token = create_access_token(subject=oauth_user.id)
        new_user_headers = {"Authorization": f"Bearer {new_user_token}"}
        
        # Step 4: Authenticate with same secret tag using new user session
        auth_data2 = authenticate_with_secret_tag(
            client_app, new_user_headers, tag_handle, SECRET_PHRASE_1
        )
        
        assert auth_data2["success"] is True
        second_tag_token = auth_data2["tag_access_token"]
        
        # Both tag tokens should be valid but different (new sessions)
        assert len(first_tag_token) > 50
        assert len(second_tag_token) > 50
        assert first_tag_token != second_tag_token  # Different sessions
        
        # Step 5: Verify tag still exists and accessible
        list_response = client_app.get("/api/v1/secret-tags", headers=new_user_headers)
        assert list_response.status_code == 200
        
        tags = list_response.json()["tags"]
        assert len(tags) == 1
        assert tags[0]["tag_name"] == "Persistent Integration Tag"

    def test_error_handling_in_complex_flows(self, client_app, oauth_auth_headers, db_session):
        """Test error handling throughout complex authentication flows."""
        
        # Test 1: Invalid secret phrase in tag creation
        script = """
const opaque = require('@serenity-kit/opaque');

async function generateInvalidRequest() {
    console.log(JSON.stringify({ 
        success: true, 
        clientRegistrationState: "invalid_state",
        registrationRequest: "invalid_request"
    }));
}

generateInvalidRequest();
"""
        
        result = subprocess.run(['node', '-e', script], capture_output=True, text=True, timeout=30)
        response = json.loads(result.stdout.strip())
        
        invalid_response = client_app.post("/api/v1/secret-tags/register/start", 
            headers=oauth_auth_headers,
            json={
                "tag_name": "Invalid Test Tag",
                "color": "#FF0000",
                "opaque_registration_request": response['registrationRequest']
            }
        )
        
        # Should fail with invalid OPAQUE data
        assert invalid_response.status_code == 422, "Should reject invalid OPAQUE data"
        
        # Test 2: Session expiration during complex flow
        tag_data = complete_opaque_secret_tag_registration(
            client_app, oauth_auth_headers, "Expiration Test Tag", SECRET_PHRASE_1, "#FFC107"
        )
        
        tag_handle = tag_data["tag_handle"]
        
        # Manually expire all sessions
        db_session.query(OpaqueSession).update({
            "expires_at": datetime.now(timezone.utc).replace(year=2020)
        })
        db_session.commit()
        
        # Try to authenticate with expired session context
        script = f"""
const opaque = require('@serenity-kit/opaque');

async function generateTagAuthRequest() {{
    try {{
        if (opaque.ready) {{
            await opaque.ready;
        }}
        
        const {{ clientLoginState, startLoginRequest }} = opaque.client.startLogin({{
            password: '{SECRET_PHRASE_1}'
        }});
        
        console.log(JSON.stringify({{ 
            success: true, 
            clientLoginState,
            startLoginRequest 
        }}));
    }} catch (error) {{
        console.log(JSON.stringify({{ success: false, error: error.message }}));
    }}
}}

generateTagAuthRequest();
"""
        
        result = subprocess.run(['node', '-e', script], capture_output=True, text=True, timeout=30)
        response = json.loads(result.stdout.strip())
        auth_request = response['startLoginRequest']
        
        # Should still work - tag auth creates new sessions
        auth_response = client_app.post(f"/api/v1/secret-tags/{tag_handle}/auth/start",
            headers=oauth_auth_headers,
            json={
                "client_credential_request": auth_request
            }
        )
        
        assert auth_response.status_code == 200, "Tag auth should work despite expired sessions" 