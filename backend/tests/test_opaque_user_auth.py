"""
Real OPAQUE User Authentication Tests

Tests the complete OPAQUE user authentication flow using the real Node.js OPAQUE server.
NO MOCKING - Tests actual cryptographic operations and real base64 encoding/decoding.

This test suite validates:
- Real OPAQUE registration flow (start → finish)
- Real OPAQUE login flow (start → finish) 
- Base64/Base64URL encoding compatibility
- JWT token generation and validation
- Database persistence of OPAQUE envelopes
- Session management and cleanup
- Error handling and edge cases
"""

import pytest
import base64
import json
import subprocess
import uuid
import time
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models import User
from app.models.secret_tag_opaque import OpaqueSession
from app.models.opaque_server_config import OpaqueServerConfig
from app.services.opaque_user_service import OpaqueUserService
from app.core.security import validate_security_token as verify_token
from app.dependencies import get_db


# Test constants
TEST_USER_EMAIL = "real_opaque_test@example.com"
TEST_USER_NAME = "Real OPAQUE Test User"
TEST_PASSWORD = "SecureTestPassword123!"

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

def generate_real_opaque_registration_request(password: str) -> tuple[str, str]:
    """Generate real OPAQUE registration request using Node.js client."""
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
    
    result = subprocess.run(
        ['node', '-e', script],
        capture_output=True,
        text=True,
        timeout=30
    )
    
    if result.returncode != 0:
        raise RuntimeError(f"Failed to generate OPAQUE registration request: {result.stderr}")
    
    response = json.loads(result.stdout.strip())
    if not response.get('success'):
        raise RuntimeError(f"OPAQUE registration request failed: {response.get('error')}")
    
    return response['clientRegistrationState'], response['registrationRequest']

def finish_real_opaque_registration(client_state: str, registration_response: str, password: str) -> str:
    """Finish real OPAQUE registration using Node.js client."""
    script = f"""
const opaque = require('@serenity-kit/opaque');

async function finishRegistration() {{
    try {{
        if (opaque.ready) {{
            await opaque.ready;
        }}
        
        const {{ registrationRecord }} = opaque.client.finishRegistration({{
            clientRegistrationState: '{client_state}',
            registrationResponse: '{registration_response}',
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
    
    result = subprocess.run(
        ['node', '-e', script],
        capture_output=True,
        text=True,
        timeout=30
    )
    
    if result.returncode != 0:
        raise RuntimeError(f"Failed to finish OPAQUE registration: {result.stderr}")
    
    response = json.loads(result.stdout.strip())
    if not response.get('success'):
        raise RuntimeError(f"OPAQUE registration finish failed: {response.get('error')}")
    
    return response['registrationRecord']

def generate_real_opaque_login_request(password: str) -> tuple[str, str]:
    """Generate real OPAQUE login request using Node.js client."""
    script = f"""
const opaque = require('@serenity-kit/opaque');

async function generateLoginRequest() {{
    try {{
        if (opaque.ready) {{
            await opaque.ready;
        }}
        
        const {{ clientLoginState, startLoginRequest }} = opaque.client.startLogin({{
            password: '{password}'
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

generateLoginRequest();
"""
    
    result = subprocess.run(
        ['node', '-e', script],
        capture_output=True,
        text=True,
        timeout=30
    )
    
    if result.returncode != 0:
        raise RuntimeError(f"Failed to generate OPAQUE login request: {result.stderr}")
    
    response = json.loads(result.stdout.strip())
    if not response.get('success'):
        raise RuntimeError(f"OPAQUE login request failed: {response.get('error')}")
    
    return response['clientLoginState'], response['startLoginRequest']

def finish_real_opaque_login(client_state: str, login_response: str, password: str) -> str:
    """Finish real OPAQUE login using Node.js client."""
    script = f"""
const opaque = require('@serenity-kit/opaque');

async function finishLogin() {{
    try {{
        if (opaque.ready) {{
            await opaque.ready;
        }}
        
        const {{ finishLoginRequest }} = opaque.client.finishLogin({{
            clientLoginState: '{client_state}',
            loginResponse: '{login_response}',
            password: '{password}'
        }});
        
        console.log(JSON.stringify({{ 
            success: true, 
            finishLoginRequest 
        }}));
    }} catch (error) {{
        console.log(JSON.stringify({{ success: false, error: error.message }}));
    }}
}}

finishLogin();
"""
    
    result = subprocess.run(
        ['node', '-e', script],
        capture_output=True,
        text=True,
        timeout=30
    )
    
    if result.returncode != 0:
        raise RuntimeError(f"Failed to finish OPAQUE login: {result.stderr}")
    
    response = json.loads(result.stdout.strip())
    if not response.get('success'):
        raise RuntimeError(f"OPAQUE login finish failed: {response.get('error')}")
    
    return response['finishLoginRequest']


@pytest.mark.opaque
@pytest.mark.integration
@pytest.mark.slow
@pytest.mark.skipif(not check_node_js_available(), reason="Node.js with @serenity-kit/opaque not available")
class TestOpaqueUserAuth:
    """Test real OPAQUE user authentication with actual cryptographic operations."""

    @pytest.fixture(autouse=True)
    def setup_and_cleanup(self, db_session: Session):
        """Set up test environment and clean up after each test."""
        # Clean up any existing test data
        db_session.query(User).filter(User.email == TEST_USER_EMAIL).delete()
        db_session.query(OpaqueSession).delete()
        db_session.commit()
        
        yield
        
        # Clean up after test
        db_session.query(User).filter(User.email == TEST_USER_EMAIL).delete()
        db_session.query(OpaqueSession).delete()
        db_session.commit()

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

    def test_opaque_user_registration_complete_flow(self, client_app, db_session):
        """Test complete OPAQUE user registration flow with real cryptographic operations."""
        
        # Step 1: Generate real OPAQUE registration request
        client_state, registration_request = generate_real_opaque_registration_request(TEST_PASSWORD)
        
        # Verify registration request is valid base64
        assert validate_base64_data(registration_request, "Registration Request"), "Registration request should be valid base64"
        
        # Step 2: Start registration via API
        start_response = client_app.post("/api/v1/auth/register/start", json={
            "userIdentifier": TEST_USER_EMAIL,
            "opaque_registration_request": registration_request,
            "name": TEST_USER_NAME
        })
        
        assert start_response.status_code == 200, f"Registration start failed: {start_response.text}"
        start_data = start_response.json()
        
        # Verify response structure
        assert "session_id" in start_data
        assert "opaque_registration_response" in start_data
        assert "expires_at" in start_data
        
        session_id = start_data["session_id"]
        registration_response = start_data["opaque_registration_response"]
        
        # Verify registration response is valid base64
        assert validate_base64_data(registration_response, "Registration Response"), "Registration response should be valid base64"
        
        # Verify session was created in database
        session = db_session.query(OpaqueSession).filter(
            OpaqueSession.session_id == session_id
        ).first()
        assert session is not None, "Registration session should be created"
        assert session.session_state == "registration_started"
        
        # Step 3: Complete registration using real OPAQUE client
        registration_record = finish_real_opaque_registration(
            client_state, registration_response, TEST_PASSWORD
        )
        
        # Verify registration record is valid base64
        assert validate_base64_data(registration_record, "Registration Record"), "Registration record should be valid base64"
        
        # Step 4: Finish registration via API
        finish_response = client_app.post("/api/v1/auth/register/finish", json={
            "session_id": session_id,
            "userIdentifier": TEST_USER_EMAIL,
            "opaque_registration_record": registration_record
        })
        
        assert finish_response.status_code == 200, f"Registration finish failed: {finish_response.text}"
        finish_data = finish_response.json()
        
        # Verify response structure
        assert finish_data["success"] is True
        assert "user" in finish_data
        assert "access_token" in finish_data
        assert finish_data["token_type"] == "bearer"
        
        user_data = finish_data["user"]
        assert user_data["email"] == TEST_USER_EMAIL
        assert user_data["full_name"] == TEST_USER_NAME
        assert user_data["is_active"] is True
        
        # Verify JWT token is valid
        access_token = finish_data["access_token"]
        token_payload = verify_token(access_token)
        assert token_payload is not None, "Access token should be valid"
        
        # Verify user was created in database
        user = db_session.query(User).filter(User.email == TEST_USER_EMAIL).first()
        assert user is not None, "User should be created in database"
        assert user.full_name == TEST_USER_NAME
        assert user.google_id is None, "OPAQUE user should not have Google ID"
        assert user.opaque_envelope is not None, "OPAQUE user should have opaque envelope"
        assert len(user.opaque_envelope) > 0, "OPAQUE envelope should not be empty"
        
        # Verify registration session was cleaned up
        session_after = db_session.query(OpaqueSession).filter(
            OpaqueSession.session_id == session_id
        ).first()
        assert session_after is None, "Registration session should be cleaned up"

    def test_opaque_user_login_complete_flow(self, client_app, db_session):
        """Test complete OPAQUE user login flow with real cryptographic operations."""
        
        # First, register a user (using the registration flow)
        client_state, registration_request = generate_real_opaque_registration_request(TEST_PASSWORD)
        
        start_response = client_app.post("/api/v1/auth/register/start", json={
            "userIdentifier": TEST_USER_EMAIL,
            "opaque_registration_request": registration_request,
            "name": TEST_USER_NAME
        })
        assert start_response.status_code == 200
        start_data = start_response.json()
        
        registration_record = finish_real_opaque_registration(
            client_state, start_data["opaque_registration_response"], TEST_PASSWORD
        )
        
        finish_response = client_app.post("/api/v1/auth/register/finish", json={
            "session_id": start_data["session_id"],
            "userIdentifier": TEST_USER_EMAIL,
            "opaque_registration_record": registration_record
        })
        assert finish_response.status_code == 200
        
        # Now test login flow
        
        # Step 1: Generate real OPAQUE login request
        login_client_state, login_request = generate_real_opaque_login_request(TEST_PASSWORD)
        
        # Verify login request is valid base64
        assert validate_base64_data(login_request, "Login Request"), "Login request should be valid base64"
        
        # Step 2: Start login via API
        login_start_response = client_app.post("/api/v1/auth/login/start", json={
            "userIdentifier": TEST_USER_EMAIL,
            "client_credential_request": login_request
        })
        
        assert login_start_response.status_code == 200, f"Login start failed: {login_start_response.text}"
        login_start_data = login_start_response.json()
        
        # Verify response structure
        assert "session_id" in login_start_data
        assert "server_credential_response" in login_start_data
        assert "expires_at" in login_start_data
        
        login_session_id = login_start_data["session_id"]
        server_response = login_start_data["server_credential_response"]
        
        # Verify server response is valid base64
        assert validate_base64_data(server_response, "Server Response"), "Server response should be valid base64"
        
        # Verify login session was created in database
        login_session = db_session.query(OpaqueSession).filter(
            OpaqueSession.session_id == login_session_id
        ).first()
        assert login_session is not None, "Login session should be created"
        assert login_session.session_state == "login_started"
        
        
        # Step 3: Complete login using real OPAQUE client
        login_finalization = finish_real_opaque_login(
            login_client_state, server_response, TEST_PASSWORD
        )
        
        # Verify login finalization is valid base64
        assert validate_base64_data(login_finalization, "Login Finalization"), "Login finalization should be valid base64"
        
        # Step 4: Finish login via API
        login_finish_response = client_app.post("/api/v1/auth/login/finish", json={
            "session_id": login_session_id,
            "userIdentifier": TEST_USER_EMAIL,
            "client_credential_finalization": login_finalization
        })
        
        assert login_finish_response.status_code == 200, f"Login finish failed: {login_finish_response.text}"
        login_finish_data = login_finish_response.json()
        
        # Verify response structure
        assert login_finish_data["success"] is True
        assert "user" in login_finish_data
        assert "access_token" in login_finish_data
        assert login_finish_data["token_type"] == "bearer"
        
        user_data = login_finish_data["user"]
        assert user_data["email"] == TEST_USER_EMAIL
        assert user_data["full_name"] == TEST_USER_NAME
        
        # Verify JWT token is valid
        access_token = login_finish_data["access_token"]
        token_payload = verify_token(access_token)
        assert token_payload is not None, "Access token should be valid"
        
        # Verify login session was cleaned up
        login_session_after = db_session.query(OpaqueSession).filter(
            OpaqueSession.session_id == login_session_id
        ).first()
        assert login_session_after is None, "Login session should be cleaned up"

    def test_opaque_registration_invalid_email(self, client_app):
        """Test OPAQUE registration with invalid email address."""
        client_state, registration_request = generate_real_opaque_registration_request(TEST_PASSWORD)
        
        response = client_app.post("/api/v1/auth/register/start", json={
            "userIdentifier": "invalid-email",
            "opaque_registration_request": registration_request,
            "name": TEST_USER_NAME
        })
        
        assert response.status_code == 422, "Should reject invalid email"

    def test_opaque_registration_duplicate_user(self, client_app, db_session):
        """Test OPAQUE registration with duplicate user email."""
        # Register user first time
        client_state, registration_request = generate_real_opaque_registration_request(TEST_PASSWORD)
        
        start_response = client_app.post("/api/v1/auth/register/start", json={
            "userIdentifier": TEST_USER_EMAIL,
            "opaque_registration_request": registration_request,
            "name": TEST_USER_NAME
        })
        assert start_response.status_code == 200
        start_data = start_response.json()
        
        registration_record = finish_real_opaque_registration(
            client_state, start_data["opaque_registration_response"], TEST_PASSWORD
        )
        
        finish_response = client_app.post("/api/v1/auth/register/finish", json={
            "session_id": start_data["session_id"],
            "userIdentifier": TEST_USER_EMAIL,
            "opaque_registration_record": registration_record
        })
        assert finish_response.status_code == 200
        
        # Try to register same user again
        client_state2, registration_request2 = generate_real_opaque_registration_request(TEST_PASSWORD)
        
        duplicate_response = client_app.post("/api/v1/auth/register/start", json={
            "userIdentifier": TEST_USER_EMAIL,
            "opaque_registration_request": registration_request2,
            "name": TEST_USER_NAME
        })
        
        assert duplicate_response.status_code == 400, "Should reject duplicate user registration"

    def test_opaque_login_nonexistent_user(self, client_app):
        """Test OPAQUE login with nonexistent user."""
        login_client_state, login_request = generate_real_opaque_login_request(TEST_PASSWORD)
        
        response = client_app.post("/api/v1/auth/login/start", json={
            "userIdentifier": "nonexistent@example.com",
            "client_credential_request": login_request
        })
        
        assert response.status_code == 401, "Should reject login for nonexistent user"

    def test_opaque_base64_encoding_formats(self, client_app, db_session):
        """Test that OPAQUE handles both standard and URL-safe base64 formats."""
        client_state, registration_request = generate_real_opaque_registration_request(TEST_PASSWORD)
        
        # Test with original base64
        response1 = client_app.post("/api/v1/auth/register/start", json={
            "userIdentifier": TEST_USER_EMAIL,
            "opaque_registration_request": registration_request,
            "name": TEST_USER_NAME
        })
        
        assert response1.status_code == 200, "Should accept standard base64"
        
        # Clean up
        db_session.query(User).filter(User.email == TEST_USER_EMAIL).delete()
        db_session.query(OpaqueSession).delete()
        db_session.commit()
        
        # Convert to URL-safe base64 and test
        url_safe_request = registration_request.replace('+', '-').replace('/', '_').rstrip('=')
        
        response2 = client_app.post("/api/v1/auth/register/start", json={
            "userIdentifier": "test2_" + TEST_USER_EMAIL,  # Different valid email
            "opaque_registration_request": url_safe_request,
            "name": TEST_USER_NAME
        })
        
        assert response2.status_code == 200, "Should accept URL-safe base64"

    def test_opaque_session_expiration(self, client_app, db_session):
        """Test that OPAQUE sessions expire properly."""
        client_state, registration_request = generate_real_opaque_registration_request(TEST_PASSWORD)
        
        # Start registration
        start_response = client_app.post("/api/v1/auth/register/start", json={
            "userIdentifier": TEST_USER_EMAIL,
            "opaque_registration_request": registration_request,
            "name": TEST_USER_NAME
        })
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
        registration_record = finish_real_opaque_registration(
            client_state, start_data["opaque_registration_response"], TEST_PASSWORD
        )
        
        finish_response = client_app.post("/api/v1/auth/register/finish", json={
            "session_id": session_id,
            "userIdentifier": TEST_USER_EMAIL,
            "opaque_registration_record": registration_record
        })
        
        assert finish_response.status_code == 400, "Should reject expired session" 