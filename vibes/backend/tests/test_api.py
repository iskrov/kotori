import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.services import user_service


def test_health_endpoint(client):
    """Test the health endpoint"""
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_root_endpoint(client):
    """Test the API root endpoint"""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "title" in data
    assert "description" in data
    assert "version" in data


@pytest.mark.parametrize(
    "endpoint", ["/api/journals", "/api/users/me", "/api/reminders", "/api/tags"]
)
def test_auth_required_endpoints(client, endpoint):
    """Test that endpoints require authentication"""
    response = client.get(endpoint)
    assert response.status_code == 401


def test_login_endpoint(client, test_user):
    """Test login endpoint"""
    response = client.post(
        "/api/auth/login/json",
        json={"email": "testuser@example.com", "password": "testpassword"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "token_type" in data
    assert data["token_type"] == "bearer"
    assert "user" in data
    assert data["user"]["email"] == "testuser@example.com"


def test_login_invalid_credentials(client):
    """Test login with invalid credentials"""
    response = client.post(
        "/api/auth/login/json",
        json={"email": "testuser@example.com", "password": "wrongpassword"},
    )
    assert response.status_code == 401


def test_get_current_user(client, token_headers):
    """Test getting the current authenticated user"""
    response = client.get("/api/users/me", headers=token_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "testuser@example.com"


def test_create_and_get_journal_entry(client, token_headers):
    """Test creating and retrieving a journal entry"""
    # Create entry
    create_response = client.post(
        "/api/journals",
        headers=token_headers,
        json={
            "title": "API Test Entry",
            "content": "Testing API endpoints",
            "entry_date": "2023-03-27",
            "tags": ["api", "test"],
        },
    )
    assert create_response.status_code == 201
    created_entry = create_response.json()

    # Get the entry
    entry_id = created_entry["id"]
    get_response = client.get(f"/api/journals/{entry_id}", headers=token_headers)
    assert get_response.status_code == 200
    entry = get_response.json()
    assert entry["id"] == entry_id
    assert entry["title"] == "API Test Entry"
    assert entry["content"] == "Testing API endpoints"

    # Verify tags
    tag_names = [tag["name"] for tag in entry["tags"]]
    assert "api" in tag_names
    assert "test" in tag_names

    # Clean up
    delete_response = client.delete(f"/api/journals/{entry_id}", headers=token_headers)
    assert delete_response.status_code == 200


def test_list_journal_entries(client, token_headers):
    """Test listing journal entries"""
    # Create a few entries
    for i in range(3):
        client.post(
            "/api/journals",
            headers=token_headers,
            json={
                "title": f"API Test Entry {i}",
                "content": f"Testing entry list {i}",
                "entry_date": "2023-03-27",
                "tags": ["list-test"],
            },
        )

    # Get entries
    response = client.get("/api/journals", headers=token_headers)
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data

    # We should have at least 3 entries
    assert data["total"] >= 3

    # Verify our entries exist
    titles = [entry["title"] for entry in data["items"]]
    assert any(title.startswith("API Test Entry") for title in titles)


def test_create_and_get_reminder(client, token_headers):
    """Test creating and retrieving a reminder"""
    # Create reminder
    create_response = client.post(
        "/api/reminders",
        headers=token_headers,
        json={
            "title": "API Test Reminder",
            "message": "Testing API reminder endpoints",
            "time": "10:00:00",
            "frequency": "daily",
            "is_active": True,
        },
    )
    assert create_response.status_code == 201
    created_reminder = create_response.json()

    # Get the reminder
    reminder_id = created_reminder["id"]
    get_response = client.get(f"/api/reminders/{reminder_id}", headers=token_headers)
    assert get_response.status_code == 200
    reminder = get_response.json()
    assert reminder["id"] == reminder_id
    assert reminder["title"] == "API Test Reminder"
    assert reminder["message"] == "Testing API reminder endpoints"

    # Clean up
    delete_response = client.delete(
        f"/api/reminders/{reminder_id}", headers=token_headers
    )
    assert delete_response.status_code == 200


def test_get_tags(client, token_headers):
    """Test getting tags"""
    # First ensure we have some tags by creating a journal with tags
    client.post(
        "/api/journals",
        headers=token_headers,
        json={
            "title": "Tag Test Entry",
            "content": "Testing tags API",
            "entry_date": "2023-03-27",
            "tags": ["tag-api-test-1", "tag-api-test-2"],
        },
    )

    # Get tags
    response = client.get("/api/tags", headers=token_headers)
    assert response.status_code == 200
    tags = response.json()

    # Verify our tags exist
    tag_names = [tag["name"] for tag in tags]
    assert "tag-api-test-1" in tag_names
    assert "tag-api-test-2" in tag_names


def test_user_registration_and_login_flow(client: TestClient, db: Session):
    """Test creating a user via register endpoint and immediately logging in."""
    test_email = f"test_flow_{uuid.uuid4()}@example.com"
    test_password = "StrongPassword123"
    test_name = "Test Flow User"
    created_user_id = None

    try:
        # Step 1: Register the user
        register_payload = {
            "email": test_email,
            "password": test_password,
            "full_name": test_name,
        }
        reg_response = client.post(
            "/api/auth/register",
            json=register_payload,
        )
        print(f"Register response status: {reg_response.status_code}")  # Debug print
        print(f"Register response body: {reg_response.text}")  # Debug print
        assert reg_response.status_code == 200, (
            f"Registration failed: {reg_response.text}"
        )
        reg_data = reg_response.json()
        assert reg_data["user"]["email"] == test_email
        assert "access_token" in reg_data  # Registration might return a token too
        created_user_id = reg_data["user"]["id"]
        print(f"User registered successfully: {test_email} (ID: {created_user_id})")

        # Step 2: Attempt to login with the same credentials
        login_payload = {"email": test_email, "password": test_password}
        login_response = client.post(
            "/api/auth/login/json",
            json=login_payload,
        )
        print(f"Login response status: {login_response.status_code}")  # Debug print
        print(f"Login response body: {login_response.text}")  # Debug print
        assert login_response.status_code == 200, (
            f"Login failed after registration: {login_response.text}"
        )
        login_data = login_response.json()
        assert "access_token" in login_data
        assert login_data["token_type"] == "bearer"
        assert login_data["user"]["email"] == test_email
        print(f"Login successful for: {test_email}")

    finally:
        # Step 3: Cleanup - Delete the user from the database
        if created_user_id:
            print(f"Attempting cleanup for user ID: {created_user_id}")
            user = user_service.get(db=db, id=created_user_id)
            if user:
                deleted_user = user_service.remove(db=db, id=created_user_id)
                print(f"Successfully cleaned up user: {deleted_user.email}")
            else:
                print(f"User with ID {created_user_id} not found during cleanup.")
        else:
            print("No user ID captured, cleanup skipped.")


def test_logout_user(client: TestClient, token_headers):
    """Test logging out a user."""
    # Ensure we are logged in by fetching the user profile first
    profile_response = client.get("/api/users/me", headers=token_headers)
    assert profile_response.status_code == 200, (
        "Pre-logout check failed: Could not fetch user profile."
    )
    print(
        f"User profile fetched successfully before logout: {profile_response.json()['email']}"
    )

    # Perform the logout request
    logout_response = client.post("/api/auth/logout", headers=token_headers)
    print(f"Logout response status: {logout_response.status_code}")  # Debug print
    # Expect 204 No Content on successful logout
    assert logout_response.status_code == 204, f"Logout failed: {logout_response.text}"
    print("Logout request successful (Status 204)")

    # # Verify that subsequent requests with the same token fail
    # profile_after_logout = client.get("/api/users/me", headers=token_headers)
    # # Note: Since JWT tokens are stateless, the backend might still accept the token
    # # until it expires, even after calling /logout. A 401 is not guaranteed here.
    # # A better test in a stateful system would check server-side session invalidation.
    # # For now, we just check the logout endpoint returned success.
    # print(f"Profile fetch status after logout: {profile_after_logout.status_code}")
    # assert profile_after_logout.status_code == 401, "Token still valid after logout (Expected 401)"
    # print("Confirmed token is invalid after logout (Status 401)")
