"""
Real OPAQUE Secret Tag Tests

Tests the complete OPAQUE secret tag flow using the real Node.js OPAQUE server.
NO MOCKING - Tests actual cryptographic operations and real base64 encoding/decoding.

This test suite validates:
- Real OPAQUE secret tag registration flow (start → finish)
- Real OPAQUE secret tag authentication flow (start → finish)
- Base64/Base64URL encoding compatibility for secret phrases
- Tag handle generation and uniqueness
- Database persistence of OPAQUE envelopes for tags
- Session management and cleanup
- Integration with user authentication tokens
- Error handling and edge cases
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
from app.models.secret_tag_opaque import OpaqueSession, TagSession
from app.services.secret_tag_service import SecretTagService
from app.core.security import create_access_token


# Test constants
TEST_USER_EMAIL = "secret_tag_test_user@example.com"
TEST_USER_NAME = "Secret Tag Test User"
TEST_SECRET_PHRASE = "MySecretTestPhrase123!"
TEST_TAG_NAME = "Real Test Secret Tag"
TEST_TAG_COLOR = "#FF5722"

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

def validate_base64_data(data: str, name: str) -> bool:
    """Validate base64 data with comprehensive format support."""
    # Try different base64 formats
    for decoder_name, decoder in [("standard", base64.b64decode), ("urlsafe", base64.urlsafe_b64decode)]:
        try:
            # Try with original data
            decoded = decoder(data)
            if len(decoded) > 0:
                return True
        except Exception:
            pass
        
        try:
            # Try with padding
            missing_padding = len(data) % 4
            if missing_padding:
                padded_data = data + '=' * (4 - missing_padding)
                decoded = decoder(padded_data)
                if len(decoded) > 0:
                    return True
        except Exception:
            pass
    
    return False

def generate_real_opaque_tag_registration_request(secret_phrase: str) -> tuple[str, str]:
    """Generate real OPAQUE registration request for secret tag using Node.js client."""
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
    
    result = subprocess.run(
        ['node', '-e', script],
        capture_output=True,
        text=True,
        timeout=30
    )
    
    if result.returncode != 0:
        raise RuntimeError(f"Failed to generate OPAQUE tag registration request: {result.stderr}")
    
    response = json.loads(result.stdout.strip())
    if not response.get('success'):
        raise RuntimeError(f"OPAQUE tag registration request failed: {response.get('error')}")
    
    return response['clientRegistrationState'], response['registrationRequest']

def finish_real_opaque_tag_registration(client_state: str, registration_response: str, secret_phrase: str) -> str:
    """Finish real OPAQUE registration for secret tag using Node.js client."""
    script = f"""
const opaque = require('@serenity-kit/opaque');

async function finishTagRegistration() {{
    try {{
        if (opaque.ready) {{
            await opaque.ready;
        }}
        
        const {{ registrationRecord }} = opaque.client.finishRegistration({{
            clientRegistrationState: '{client_state}',
            registrationResponse: '{registration_response}',
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
    
    result = subprocess.run(
        ['node', '-e', script],
        capture_output=True,
        text=True,
        timeout=30
    )
    
    if result.returncode != 0:
        raise RuntimeError(f"Failed to finish OPAQUE tag registration: {result.stderr}")
    
    response = json.loads(result.stdout.strip())
    if not response.get('success'):
        raise RuntimeError(f"OPAQUE tag registration finish failed: {response.get('error')}")
    
    return response['registrationRecord']

def generate_real_opaque_tag_auth_request(secret_phrase: str) -> tuple[str, str]:
    """Generate real OPAQUE authentication request for secret tag using Node.js client."""
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
    
    result = subprocess.run(
        ['node', '-e', script],
        capture_output=True,
        text=True,
        timeout=30
    )
    
    if result.returncode != 0:
        raise RuntimeError(f"Failed to generate OPAQUE tag auth request: {result.stderr}")
    
    response = json.loads(result.stdout.strip())
    if not response.get('success'):
        raise RuntimeError(f"OPAQUE tag auth request failed: {response.get('error')}")
    
    return response['clientLoginState'], response['startLoginRequest']

def finish_real_opaque_tag_auth(client_state: str, server_response: str, secret_phrase: str) -> str:
    """Finish real OPAQUE authentication for secret tag using Node.js client."""
    
    script = f"""
const opaque = require('@serenity-kit/opaque');

async function finishTagAuth() {{
    try {{
        if (opaque.ready) {{
            await opaque.ready;
        }}
        
        const {{ finishLoginRequest }} = opaque.client.finishLogin({{
            clientLoginState: '{client_state}',
            loginResponse: '{server_response}',
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
    
    result = subprocess.run(
        ['node', '-e', script],
        capture_output=True,
        text=True,
        timeout=30
    )
    
    if result.returncode != 0:
        raise RuntimeError(f"Failed to finish OPAQUE tag auth: {result.stderr}")
    
    response = json.loads(result.stdout.strip())
    if not response.get('success'):
        raise RuntimeError(f"OPAQUE tag auth finish failed: {response.get('error')}")
    
    return response['finishLoginRequest']


@pytest.mark.opaque
@pytest.mark.integration
@pytest.mark.slow
@pytest.mark.skipif(not check_node_js_available(), reason="Node.js with @serenity-kit/opaque not available")
class TestOpaqueSecretTags:
    """Test real OPAQUE secret tag operations with actual cryptographic operations."""

    @pytest.fixture(autouse=True)
    def setup_and_cleanup(self, db_session: Session):
        """Set up test environment and clean up after each test."""
        # Clean up any existing test data (delete in correct order due to foreign keys)
        from app.models import WrappedKey
        
        # 1. First delete TagSession (references SecretTag)
        db_session.query(TagSession).filter(
            TagSession.tag_id.in_(
                db_session.query(SecretTag.id).filter(SecretTag.tag_name.like("%Test%"))
            )
        ).delete(synchronize_session=False)
        
        # 2. Then delete WrappedKey (references SecretTag)
        db_session.query(WrappedKey).filter(
            WrappedKey.tag_id.in_(
                db_session.query(SecretTag.id).filter(SecretTag.tag_name.like("%Test%"))
            )
        ).delete(synchronize_session=False)
        
        # 3. Then delete SecretTag
        db_session.query(SecretTag).filter(
            SecretTag.tag_name.like("%Test%")
        ).delete(synchronize_session=False)
        
        # 4. Finally delete other records
        db_session.query(User).filter(User.email == TEST_USER_EMAIL).delete()
        db_session.query(OpaqueSession).delete()
        db_session.commit()
        
        yield
        
        # Clean up after test (delete in correct order due to foreign keys)
        # 1. First delete TagSession (references SecretTag)
        db_session.query(TagSession).filter(
            TagSession.tag_id.in_(
                db_session.query(SecretTag.id).filter(SecretTag.tag_name.like("%Test%"))
            )
        ).delete(synchronize_session=False)
        
        # 2. Then delete WrappedKey (references SecretTag)
        db_session.query(WrappedKey).filter(
            WrappedKey.tag_id.in_(
                db_session.query(SecretTag.id).filter(SecretTag.tag_name.like("%Test%"))
            )
        ).delete(synchronize_session=False)
        
        # 3. Then delete SecretTag
        db_session.query(SecretTag).filter(
            SecretTag.tag_name.like("%Test%")
        ).delete(synchronize_session=False)
        
        # 4. Finally delete other records
        db_session.query(User).filter(User.email == TEST_USER_EMAIL).delete()
        db_session.query(OpaqueSession).delete()
        db_session.commit()

    @pytest.fixture
    def test_user(self, db_session: Session):
        """Create a test user for secret tag operations."""
        user = User(
            id=uuid.uuid4(),
            email=TEST_USER_EMAIL,
            full_name=TEST_USER_NAME,
            google_id="test_google_id_123",  # OAuth user
            opaque_envelope=None,  # OAuth users don't have OPAQUE envelope
            is_active=True,
            is_superuser=False
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user

    @pytest.fixture
    def auth_headers(self, test_user):
        """Create authentication headers for test user."""
        access_token = create_access_token(subject=test_user.id)
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

    def test_opaque_secret_tag_registration_complete_flow(self, client_app, auth_headers, test_user, db_session):
        """Test complete OPAQUE secret tag registration flow with real cryptographic operations."""
        
        # Step 1: Generate real OPAQUE registration request for secret tag
        client_state, registration_request = generate_real_opaque_tag_registration_request(TEST_SECRET_PHRASE)
        
        # Verify registration request is valid base64
        assert validate_base64_data(registration_request, "Registration Request"), "Registration request should be valid base64"
        
        # Step 2: Start secret tag registration via API
        start_response = client_app.post("/api/v1/secret-tags/register/start", 
            headers=auth_headers,
            json={
                "tag_name": TEST_TAG_NAME,
                "color": TEST_TAG_COLOR,
                "opaque_registration_request": registration_request
            }
        )
        
        assert start_response.status_code == 200, f"Tag registration start failed: {start_response.text}"
        start_data = start_response.json()
        
        # Verify response structure
        assert "session_id" in start_data
        assert "opaque_registration_response" in start_data
        assert "tag_handle" in start_data
        assert "expires_at" in start_data
        
        session_id = start_data["session_id"]
        registration_response = start_data["opaque_registration_response"]
        tag_handle = start_data["tag_handle"]
        
        # Verify registration response is valid base64
        assert validate_base64_data(registration_response, "Registration Response"), "Registration response should be valid base64"
        
        # Verify tag_handle is valid base64 and correct length (32 bytes)
        assert validate_base64_data(tag_handle, "Tag Handle"), "Tag handle should be valid base64"
        # Additional check for tag handle length
        try:
            decoded_handle = base64.urlsafe_b64decode(tag_handle + '=' * (4 - len(tag_handle) % 4))
            assert len(decoded_handle) == 32, "Tag handle should be 32 bytes"
        except Exception:
            decoded_handle = base64.b64decode(tag_handle + '=' * (4 - len(tag_handle) % 4))
            assert len(decoded_handle) == 32, "Tag handle should be 32 bytes"
        
        # Verify session was created in database
        session = db_session.query(OpaqueSession).filter(
            OpaqueSession.session_id == session_id
        ).first()
        assert session is not None, "Registration session should be created"
        assert session.session_state == "tag_registration_started"
        assert str(session.user_id) == str(test_user.id)
        
        # Step 3: Complete registration using real OPAQUE client
        registration_record = finish_real_opaque_tag_registration(
            client_state, registration_response, TEST_SECRET_PHRASE
        )
        
        # Verify registration record is valid base64
        assert validate_base64_data(registration_record, "Registration Record"), "Registration record should be valid base64"
        
        # Step 4: Finish registration via API
        finish_response = client_app.post("/api/v1/secret-tags/register/finish",
            headers=auth_headers,
            json={
                "session_id": session_id,
                "opaque_registration_record": registration_record
            }
        )
        
        assert finish_response.status_code == 200, f"Tag registration finish failed: {finish_response.text}"
        finish_data = finish_response.json()
        
        # Verify response structure
        assert finish_data["success"] is True
        assert finish_data["tag_name"] == TEST_TAG_NAME
        assert finish_data["color"] == TEST_TAG_COLOR
        assert finish_data["tag_handle"] == tag_handle
        assert "tag_id" in finish_data
        assert "created_at" in finish_data
        
        # Verify secret tag was created in database
        tag = db_session.query(SecretTag).filter(SecretTag.id == finish_data["tag_id"]).first()
        assert tag is not None, "Secret tag should be created in database"
        assert tag.user_id == test_user.id
        assert tag.tag_name == TEST_TAG_NAME
        assert tag.color == TEST_TAG_COLOR
        assert len(tag.tag_handle) == 32, "Tag handle should be 32 bytes in database"
        assert tag.opaque_envelope is not None, "Secret tag should have opaque envelope"
        assert len(tag.opaque_envelope) > 0, "OPAQUE envelope should not be empty"
        
        # Verify registration session was cleaned up
        session_after = db_session.query(OpaqueSession).filter(
            OpaqueSession.session_id == session_id
        ).first()
        assert session_after is None, "Registration session should be cleaned up"

    def test_opaque_secret_tag_authentication_complete_flow(self, client_app, auth_headers, test_user, db_session):
        """Test complete OPAQUE secret tag authentication flow with real cryptographic operations."""
        
        # First, create a secret tag using the registration flow
        client_state, registration_request = generate_real_opaque_tag_registration_request(TEST_SECRET_PHRASE)
        
        start_response = client_app.post("/api/v1/secret-tags/register/start", 
            headers=auth_headers,
            json={
                "tag_name": TEST_TAG_NAME,
                "color": TEST_TAG_COLOR,
                "opaque_registration_request": registration_request
            }
        )
        assert start_response.status_code == 200
        start_data = start_response.json()
        
        registration_record = finish_real_opaque_tag_registration(
            client_state, start_data["opaque_registration_response"], TEST_SECRET_PHRASE
        )
        
        finish_response = client_app.post("/api/v1/secret-tags/register/finish",
            headers=auth_headers,
            json={
                "session_id": start_data["session_id"],
                "opaque_registration_record": registration_record
            }
        )
        assert finish_response.status_code == 200
        
        tag_handle = start_data["tag_handle"]
        
        # Now test authentication flow
        
        # Step 1: Generate real OPAQUE authentication request
        auth_client_state, auth_request = generate_real_opaque_tag_auth_request(TEST_SECRET_PHRASE)
        
        # Verify auth request is valid base64
        assert validate_base64_data(auth_request, "Auth Request"), "Auth request should be valid base64"
        
        # Step 2: Start authentication via API
        # Tag handles are now URL-safe base64 without padding
        auth_start_response = client_app.post(f"/api/v1/secret-tags/{tag_handle}/auth/start",
            headers=auth_headers,
            json={
                "client_credential_request": auth_request
            }
        )
        
        assert auth_start_response.status_code == 200, f"Tag auth start failed: {auth_start_response.text}"
        auth_start_data = auth_start_response.json()
        
        # Verify response structure
        assert "session_id" in auth_start_data
        assert "server_credential_response" in auth_start_data
        assert "expires_at" in auth_start_data
        
        auth_session_id = auth_start_data["session_id"]
        server_response = auth_start_data["server_credential_response"]
        
        # Verify server response is valid base64
        assert validate_base64_data(server_response, "Server Response"), "Server response should be valid base64"
        
        # Verify auth session was created in database
        auth_session = db_session.query(OpaqueSession).filter(
            OpaqueSession.session_id == auth_session_id
        ).first()
        assert auth_session is not None, "Auth session should be created"
        assert auth_session.session_state == "tag_authentication_started"
        assert str(auth_session.user_id) == str(test_user.id)
        
        # Step 3: Complete authentication using real OPAQUE client
        auth_finalization = finish_real_opaque_tag_auth(
            auth_client_state, server_response, TEST_SECRET_PHRASE
        )
        
        # Verify auth finalization is valid base64
        assert validate_base64_data(auth_finalization, "Auth Finalization"), "Auth finalization should be valid base64"
        
        # Step 4: Finish authentication via API
        auth_finish_response = client_app.post(f"/api/v1/secret-tags/{tag_handle}/auth/finish",
            headers=auth_headers,
            json={
                "session_id": auth_session_id,
                "client_credential_finalization": auth_finalization
            }
        )
        
        assert auth_finish_response.status_code == 200, f"Tag auth finish failed: {auth_finish_response.text}"
        auth_finish_data = auth_finish_response.json()
        
        # Verify response structure
        assert auth_finish_data["success"] is True
        assert "tag_access_token" in auth_finish_data
        assert "tag_id" in auth_finish_data
        assert "expires_at" in auth_finish_data
        
        # Verify tag access token is valid JWT
        tag_access_token = auth_finish_data["tag_access_token"]
        assert len(tag_access_token) > 50, "Tag access token should be a valid JWT"
        
        # Verify auth session was cleaned up
        auth_session_after = db_session.query(OpaqueSession).filter(
            OpaqueSession.session_id == auth_session_id
        ).first()
        assert auth_session_after is None, "Auth session should be cleaned up"

    def test_secret_tag_list_after_creation(self, client_app, auth_headers, test_user, db_session):
        """Test listing secret tags after creating one."""
        
        # Create a secret tag first
        client_state, registration_request = generate_real_opaque_tag_registration_request(TEST_SECRET_PHRASE)
        
        start_response = client_app.post("/api/v1/secret-tags/register/start", 
            headers=auth_headers,
            json={
                "tag_name": TEST_TAG_NAME,
                "color": TEST_TAG_COLOR,
                "opaque_registration_request": registration_request
            }
        )
        assert start_response.status_code == 200
        start_data = start_response.json()
        
        registration_record = finish_real_opaque_tag_registration(
            client_state, start_data["opaque_registration_response"], TEST_SECRET_PHRASE
        )
        
        finish_response = client_app.post("/api/v1/secret-tags/register/finish",
            headers=auth_headers,
            json={
                "session_id": start_data["session_id"],
                "opaque_registration_record": registration_record
            }
        )
        assert finish_response.status_code == 200
        finish_data = finish_response.json()
        
        # Now list secret tags
        list_response = client_app.get("/api/v1/secret-tags", headers=auth_headers)
        assert list_response.status_code == 200
        
        list_data = list_response.json()
        assert "tags" in list_data
        assert len(list_data["tags"]) == 1
        
        tag_info = list_data["tags"][0]
        assert tag_info["tag_id"] == finish_data["tag_id"]
        assert tag_info["tag_name"] == TEST_TAG_NAME
        assert tag_info["color"] == TEST_TAG_COLOR
        assert "created_at" in tag_info

    def test_secret_tag_authentication_wrong_phrase(self, client_app, auth_headers, test_user, db_session):
        """Test secret tag authentication with wrong secret phrase."""
        
        # Create a secret tag first
        client_state, registration_request = generate_real_opaque_tag_registration_request(TEST_SECRET_PHRASE)
        
        start_response = client_app.post("/api/v1/secret-tags/register/start", 
            headers=auth_headers,
            json={
                "tag_name": TEST_TAG_NAME,
                "color": TEST_TAG_COLOR,
                "opaque_registration_request": registration_request
            }
        )
        assert start_response.status_code == 200
        start_data = start_response.json()
        
        registration_record = finish_real_opaque_tag_registration(
            client_state, start_data["opaque_registration_response"], TEST_SECRET_PHRASE
        )
        
        finish_response = client_app.post("/api/v1/secret-tags/register/finish",
            headers=auth_headers,
            json={
                "session_id": start_data["session_id"],
                "opaque_registration_record": registration_record
            }
        )
        assert finish_response.status_code == 200
        
        tag_handle = start_data["tag_handle"]
        
        # Try to authenticate with wrong phrase
        wrong_phrase = "WrongSecretPhrase123!"
        auth_client_state, auth_request = generate_real_opaque_tag_auth_request(wrong_phrase)
        
        auth_start_response = client_app.post(f"/api/v1/secret-tags/{tag_handle}/auth/start",
            headers=auth_headers,
            json={
                "client_credential_request": auth_request
            }
        )
        
        # Auth start should succeed (server doesn't know the phrase is wrong yet)
        assert auth_start_response.status_code == 200
        auth_start_data = auth_start_response.json()
        
        # Try to finish auth with wrong phrase - this should fail at the OPAQUE client level
        try:
            auth_finalization = finish_real_opaque_tag_auth(
                auth_client_state, auth_start_data["server_credential_response"], wrong_phrase
            )
            # If we get here, the OPAQUE client didn't reject the wrong password - test should fail
            assert False, "OPAQUE client should have rejected wrong password but didn't"
        except RuntimeError as e:
            # This is expected - OPAQUE client correctly rejects wrong password
            assert "finishLoginRequest" in str(e) and "undefined" in str(e), f"Expected OPAQUE rejection error, got: {e}"
            
            # Test passes - OPAQUE correctly rejected the wrong password
            print("✅ OPAQUE correctly rejected wrong password at client level")

    def test_secret_tag_nonexistent_handle(self, client_app, auth_headers):
        """Test secret tag authentication with nonexistent tag handle."""
        
        # This will be overwritten below with URL-safe version
        
        auth_client_state, auth_request = generate_real_opaque_tag_auth_request(TEST_SECRET_PHRASE)
        
        # Generate URL-safe fake handle without padding
        fake_handle = base64.urlsafe_b64encode(secrets.token_bytes(32)).decode().rstrip('=')
        response = client_app.post(f"/api/v1/secret-tags/{fake_handle}/auth/start",
            headers=auth_headers,
            json={
                "client_credential_request": auth_request
            }
        )
        
        assert response.status_code == 401, "Should reject nonexistent tag handle with unauthorized (good security practice)"

    def test_secret_tag_base64_encoding_formats(self, client_app, auth_headers, test_user, db_session):
        """Test that secret tag OPAQUE handles both standard and URL-safe base64 formats."""
        
        client_state, registration_request = generate_real_opaque_tag_registration_request(TEST_SECRET_PHRASE)
        
        # Test with original base64
        response1 = client_app.post("/api/v1/secret-tags/register/start", 
            headers=auth_headers,
            json={
                "tag_name": TEST_TAG_NAME,
                "color": TEST_TAG_COLOR,
                "opaque_registration_request": registration_request
            }
        )
        
        assert response1.status_code == 200, "Should accept standard base64"
        
        # Clean up
        db_session.query(SecretTag).filter(
            SecretTag.tag_name == TEST_TAG_NAME
        ).delete()
        db_session.query(OpaqueSession).delete()
        db_session.commit()
        
        # Convert to URL-safe base64 and test
        url_safe_request = registration_request.replace('+', '-').replace('/', '_').rstrip('=')
        
        response2 = client_app.post("/api/v1/secret-tags/register/start", 
            headers=auth_headers,
            json={
                "tag_name": TEST_TAG_NAME + " 2",  # Different name
                "color": TEST_TAG_COLOR,
                "opaque_registration_request": url_safe_request
            }
        )
        
        assert response2.status_code == 200, "Should accept URL-safe base64"

    def test_secret_tag_session_expiration(self, client_app, auth_headers, test_user, db_session):
        """Test that secret tag OPAQUE sessions expire properly."""
        
        client_state, registration_request = generate_real_opaque_tag_registration_request(TEST_SECRET_PHRASE)
        
        # Start registration
        start_response = client_app.post("/api/v1/secret-tags/register/start", 
            headers=auth_headers,
            json={
                "tag_name": TEST_TAG_NAME,
                "color": TEST_TAG_COLOR,
                "opaque_registration_request": registration_request
            }
        )
        assert start_response.status_code == 200
        start_data = start_response.json()
        
        session_id = start_data["session_id"]
        
        # Manually expire the session
        session = db_session.query(OpaqueSession).filter(
            OpaqueSession.session_id == session_id
        ).first()
        assert session is not None
        
        # Set expiration to past
        session.expires_at = datetime.now(timezone.utc).replace(year=2020)
        db_session.commit()
        
        # Try to finish registration with expired session
        registration_record = finish_real_opaque_tag_registration(
            client_state, start_data["opaque_registration_response"], TEST_SECRET_PHRASE
        )
        
        finish_response = client_app.post("/api/v1/secret-tags/register/finish",
            headers=auth_headers,
            json={
                "session_id": session_id,
                "opaque_registration_record": registration_record
            }
        )
        
        assert finish_response.status_code == 400, "Should reject expired session"

    def test_secret_tag_unauthorized_access(self, client_app, db_session):
        """Test secret tag operations without authentication."""
        
        client_state, registration_request = generate_real_opaque_tag_registration_request(TEST_SECRET_PHRASE)
        
        # Try to start registration without auth headers
        response = client_app.post("/api/v1/secret-tags/register/start", 
            json={
                "tag_name": TEST_TAG_NAME,
                "color": TEST_TAG_COLOR,
                "opaque_registration_request": registration_request
            }
        )
        
        assert response.status_code == 401, "Should reject unauthorized access" 