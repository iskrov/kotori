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


def test_login_endpoint(client_with_db, db):
    """Test login endpoint"""
    # First register a user
    register_response = client_with_db.post(
        "/api/auth/register",
        json={
            "email": "testuser@example.com",
            "password": "testpassword",
            "full_name": "Test User"
        }
    )
    assert register_response.status_code == 200
    
    # Now test login
    response = client_with_db.post(
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


def test_login_invalid_credentials(client_with_db):
    """Test login with invalid credentials"""
    response = client_with_db.post(
        "/api/auth/login/json",
        json={"email": "testuser@example.com", "password": "wrongpassword"},
    )
    assert response.status_code == 401


def test_get_current_user(client_with_db, token_headers):
    """Test getting the current authenticated user"""
    response = client_with_db.get("/api/users/me", headers=token_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test@example.com"  # This is the email from sync_test_user fixture


def test_create_and_get_journal_entry(client_with_db, token_headers):
    """Test creating and retrieving a journal entry"""
    # Create entry
    create_response = client_with_db.post(
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
    get_response = client_with_db.get(f"/api/journals/{entry_id}", headers=token_headers)
    assert get_response.status_code == 200
    retrieved_entry = get_response.json()

    # Verify the entry details
    assert retrieved_entry["title"] == "API Test Entry"
    assert retrieved_entry["content"] == "Testing API endpoints"
    assert retrieved_entry["entry_date"] == "2023-03-27"
    assert len(retrieved_entry["tags"]) == 2
    assert "api" in [tag["name"] for tag in retrieved_entry["tags"]]
    assert "test" in [tag["name"] for tag in retrieved_entry["tags"]]

    # Update the entry
    update_response = client_with_db.put(
        f"/api/journals/{entry_id}",
        headers=token_headers,
        json={
            "title": "Updated API Test Entry",
            "content": "Updated content for testing",
            "entry_date": "2023-03-28",
            "tags": ["api", "updated"],
        },
    )
    assert update_response.status_code == 200
    updated_entry = update_response.json()
    assert updated_entry["title"] == "Updated API Test Entry"
    assert updated_entry["content"] == "Updated content for testing"


def test_list_journal_entries(client_with_db, token_headers):
    """Test listing journal entries"""
    # Create a few entries
    for i in range(3):
        client_with_db.post(
            "/api/journals",
            headers=token_headers,
            json={
                "title": f"Test Entry {i}",
                "content": f"Content {i}",
                "entry_date": "2023-03-27",
                "tags": [f"tag{i}"],
            },
        )

    # List entries
    list_response = client_with_db.get("/api/journals", headers=token_headers)
    assert list_response.status_code == 200
    entries = list_response.json()
    assert len(entries) >= 3


def test_create_and_get_reminder(client_with_db, token_headers):
    """Test creating and retrieving a reminder"""
    # Create reminder
    create_response = client_with_db.post(
        "/api/reminders",
        headers=token_headers,
        json={
            "title": "API Test Reminder",
            "description": "Testing reminder endpoints",
            "reminder_date": "2023-03-30T10:00:00",
            "is_recurring": False,
        },
    )
    assert create_response.status_code == 201
    created_reminder = create_response.json()

    # Get the reminder
    reminder_id = created_reminder["id"]
    get_response = client_with_db.get(f"/api/reminders/{reminder_id}", headers=token_headers)
    assert get_response.status_code == 200
    retrieved_reminder = get_response.json()

    # Verify the reminder details
    assert retrieved_reminder["title"] == "API Test Reminder"
    assert retrieved_reminder["description"] == "Testing reminder endpoints"
    assert retrieved_reminder["is_recurring"] is False


def test_get_tags(client_with_db, token_headers):
    """Test getting tags"""
    # Create a journal entry with tags first
    client_with_db.post(
        "/api/journals",
        headers=token_headers,
        json={
            "title": "Entry with tags",
            "content": "Content with tags",
            "entry_date": "2023-03-27",
            "tags": ["tag1", "tag2", "tag3"],
        },
    )

    # Get tags
    response = client_with_db.get("/api/tags", headers=token_headers)
    assert response.status_code == 200
    tags = response.json()
    assert len(tags) >= 3
    tag_names = [tag["name"] for tag in tags]
    assert "tag1" in tag_names
    assert "tag2" in tag_names
    assert "tag3" in tag_names


def test_user_registration_and_login_flow(client_with_db: TestClient, db: Session):
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
        reg_response = client_with_db.post(
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
        login_response = client_with_db.post(
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


def test_logout_user(client_with_db: TestClient, token_headers):
    """Test logout endpoint"""
    response = client_with_db.post("/api/v1/auth/logout", headers=token_headers)
    assert response.status_code == 204
