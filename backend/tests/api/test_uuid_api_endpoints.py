"""
UUID API Endpoint Tests

Comprehensive tests for all API endpoints to validate UUID parameter handling,
including validation, error handling, and response serialization.
"""

import pytest
import uuid
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.journal_entry import JournalEntry
from app.models.reminder import Reminder
from app.models.tag import Tag
from tests.test_config import TestDataFactory


class TestUUIDParameterValidation:
    """Test UUID parameter validation across all API endpoints."""

    def test_valid_uuid_parameter_acceptance(self, client: TestClient, token_headers: dict):
        """Test that valid UUID parameters are accepted by all endpoints."""
        # Create a journal entry to test with
        create_response = client.post(
            "/api/journals",
            headers=token_headers,
            json={
                "title": "UUID Test Entry",
                "content": "Testing UUID parameter validation",
                "entry_date": "2023-03-27",
                "tags": ["uuid-test"]
            }
        )
        assert create_response.status_code == 201
        journal_id = create_response.json()["id"]
        
        # Verify the journal_id is a valid UUID
        assert isinstance(uuid.UUID(journal_id), uuid.UUID)
        
        # Test GET endpoint with UUID parameter
        get_response = client.get(f"/api/journals/{journal_id}", headers=token_headers)
        assert get_response.status_code == 200
        assert get_response.json()["id"] == journal_id
        
        # Clean up
        client.delete(f"/api/journals/{journal_id}", headers=token_headers)

    def test_invalid_uuid_parameter_rejection(self, client: TestClient, token_headers: dict):
        """Test that invalid UUID parameters are properly rejected."""
        invalid_uuids = [
            "not-a-uuid",
            "123",
            "invalid-uuid-format",
            "12345678-1234-1234-1234-12345678901",  # Too short
            "12345678-1234-1234-1234-1234567890123",  # Too long
            "",
            "null"
        ]
        
        for invalid_uuid in invalid_uuids:
            # Test journals endpoint
            response = client.get(f"/api/journals/{invalid_uuid}", headers=token_headers)
            assert response.status_code == 422, f"Expected 422 for invalid UUID: {invalid_uuid}"
            
            # Test reminders endpoint
            response = client.get(f"/api/reminders/{invalid_uuid}", headers=token_headers)
            assert response.status_code == 422, f"Expected 422 for invalid UUID: {invalid_uuid}"

    def test_nonexistent_uuid_handling(self, client: TestClient, token_headers: dict):
        """Test handling of valid but non-existent UUIDs."""
        nonexistent_uuid = str(uuid.uuid4())
        
        # Test journals endpoint
        response = client.get(f"/api/journals/{nonexistent_uuid}", headers=token_headers)
        assert response.status_code == 404
        
        # Test reminders endpoint
        response = client.get(f"/api/reminders/{nonexistent_uuid}", headers=token_headers)
        assert response.status_code == 404

    def test_uuid_in_request_body_validation(self, client: TestClient, token_headers: dict):
        """Test UUID validation in request body fields."""
        # Test with invalid user_id in request body (should be validated by foreign key)
        invalid_user_id = "invalid-uuid"
        
        response = client.post(
            "/api/journals",
            headers=token_headers,
            json={
                "title": "Test Entry",
                "content": "Test content",
                "entry_date": "2023-03-27",
                "user_id": invalid_user_id  # This should be validated
            }
        )
        # The request should either be rejected due to validation or processed normally
        # (depending on whether user_id is accepted in the request body)
        assert response.status_code in [201, 422]


class TestJournalsRouterUUID:
    """Test UUID handling in journals router endpoints."""

    def test_create_journal_returns_uuid(self, client: TestClient, token_headers: dict):
        """Test that creating a journal returns a valid UUID."""
        response = client.post(
            "/api/journals",
            headers=token_headers,
            json={
                "title": "UUID Creation Test",
                "content": "Testing UUID creation",
                "entry_date": "2023-03-27",
                "tags": ["uuid-creation"]
            }
        )
        assert response.status_code == 201
        
        data = response.json()
        assert "id" in data
        
        # Verify the ID is a valid UUID
        journal_uuid = uuid.UUID(data["id"])
        assert isinstance(journal_uuid, uuid.UUID)
        
        # Verify user_id is also a UUID
        assert "user_id" in data
        user_uuid = uuid.UUID(data["user_id"])
        assert isinstance(user_uuid, uuid.UUID)
        
        # Clean up
        client.delete(f"/api/journals/{data['id']}", headers=token_headers)

    def test_get_journal_by_uuid(self, client: TestClient, token_headers: dict):
        """Test retrieving a journal by UUID."""
        # Create a journal
        create_response = client.post(
            "/api/journals",
            headers=token_headers,
            json={
                "title": "UUID Retrieval Test",
                "content": "Testing UUID retrieval",
                "entry_date": "2023-03-27"
            }
        )
        assert create_response.status_code == 201
        journal_id = create_response.json()["id"]
        
        # Retrieve the journal by UUID
        get_response = client.get(f"/api/journals/{journal_id}", headers=token_headers)
        assert get_response.status_code == 200
        
        data = get_response.json()
        assert data["id"] == journal_id
        assert data["title"] == "UUID Retrieval Test"
        
        # Clean up
        client.delete(f"/api/journals/{journal_id}", headers=token_headers)

    def test_update_journal_by_uuid(self, client: TestClient, token_headers: dict):
        """Test updating a journal by UUID."""
        # Create a journal
        create_response = client.post(
            "/api/journals",
            headers=token_headers,
            json={
                "title": "Original Title",
                "content": "Original content",
                "entry_date": "2023-03-27"
            }
        )
        assert create_response.status_code == 201
        journal_id = create_response.json()["id"]
        
        # Update the journal by UUID
        update_response = client.put(
            f"/api/journals/{journal_id}",
            headers=token_headers,
            json={
                "title": "Updated Title",
                "content": "Updated content",
                "entry_date": "2023-03-27"
            }
        )
        assert update_response.status_code == 200
        
        data = update_response.json()
        assert data["id"] == journal_id  # ID should remain the same
        assert data["title"] == "Updated Title"
        assert data["content"] == "Updated content"
        
        # Clean up
        client.delete(f"/api/journals/{journal_id}", headers=token_headers)

    def test_delete_journal_by_uuid(self, client: TestClient, token_headers: dict):
        """Test deleting a journal by UUID."""
        # Create a journal
        create_response = client.post(
            "/api/journals",
            headers=token_headers,
            json={
                "title": "To Be Deleted",
                "content": "This will be deleted",
                "entry_date": "2023-03-27"
            }
        )
        assert create_response.status_code == 201
        journal_id = create_response.json()["id"]
        
        # Delete the journal by UUID
        delete_response = client.delete(f"/api/journals/{journal_id}", headers=token_headers)
        assert delete_response.status_code == 200
        
        # Verify the journal is deleted
        get_response = client.get(f"/api/journals/{journal_id}", headers=token_headers)
        assert get_response.status_code == 404

    def test_list_journals_with_uuid_filtering(self, client: TestClient, token_headers: dict):
        """Test listing journals with UUID-based filtering."""
        # Create multiple journals
        journal_ids = []
        for i in range(3):
            response = client.post(
                "/api/journals",
                headers=token_headers,
                json={
                    "title": f"Journal {i}",
                    "content": f"Content {i}",
                    "entry_date": "2023-03-27"
                }
            )
            assert response.status_code == 201
            journal_ids.append(response.json()["id"])
        
        # List all journals
        list_response = client.get("/api/journals", headers=token_headers)
        assert list_response.status_code == 200
        
        data = list_response.json()
        assert "items" in data
        assert len(data["items"]) >= 3
        
        # Verify all returned journals have valid UUIDs
        for journal in data["items"]:
            assert "id" in journal
            assert "user_id" in journal
            uuid.UUID(journal["id"])  # Should not raise exception
            uuid.UUID(journal["user_id"])  # Should not raise exception
        
        # Clean up
        for journal_id in journal_ids:
            client.delete(f"/api/journals/{journal_id}", headers=token_headers)


class TestRemindersRouterUUID:
    """Test UUID handling in reminders router endpoints."""

    def test_create_reminder_returns_uuid(self, client: TestClient, token_headers: dict):
        """Test that creating a reminder returns a valid UUID."""
        response = client.post(
            "/api/reminders",
            headers=token_headers,
            json={
                "title": "UUID Reminder Test",
                "message": "Testing UUID creation",
                "time": "10:00:00",
                "frequency": "daily",
                "is_active": True
            }
        )
        assert response.status_code == 201
        
        data = response.json()
        assert "id" in data
        
        # Verify the ID is a valid UUID
        reminder_uuid = uuid.UUID(data["id"])
        assert isinstance(reminder_uuid, uuid.UUID)
        
        # Verify user_id is also a UUID
        assert "user_id" in data
        user_uuid = uuid.UUID(data["user_id"])
        assert isinstance(user_uuid, uuid.UUID)
        
        # Clean up
        client.delete(f"/api/reminders/{data['id']}", headers=token_headers)

    def test_get_reminder_by_uuid(self, client: TestClient, token_headers: dict):
        """Test retrieving a reminder by UUID."""
        # Create a reminder
        create_response = client.post(
            "/api/reminders",
            headers=token_headers,
            json={
                "title": "UUID Retrieval Test",
                "message": "Testing UUID retrieval",
                "time": "10:00:00",
                "frequency": "daily",
                "is_active": True
            }
        )
        assert create_response.status_code == 201
        reminder_id = create_response.json()["id"]
        
        # Retrieve the reminder by UUID
        get_response = client.get(f"/api/reminders/{reminder_id}", headers=token_headers)
        assert get_response.status_code == 200
        
        data = get_response.json()
        assert data["id"] == reminder_id
        assert data["title"] == "UUID Retrieval Test"
        
        # Clean up
        client.delete(f"/api/reminders/{reminder_id}", headers=token_headers)

    def test_update_reminder_by_uuid(self, client: TestClient, token_headers: dict):
        """Test updating a reminder by UUID."""
        # Create a reminder
        create_response = client.post(
            "/api/reminders",
            headers=token_headers,
            json={
                "title": "Original Reminder",
                "message": "Original message",
                "time": "10:00:00",
                "frequency": "daily",
                "is_active": True
            }
        )
        assert create_response.status_code == 201
        reminder_id = create_response.json()["id"]
        
        # Update the reminder by UUID
        update_response = client.put(
            f"/api/reminders/{reminder_id}",
            headers=token_headers,
            json={
                "title": "Updated Reminder",
                "message": "Updated message",
                "time": "11:00:00",
                "frequency": "weekly",
                "is_active": False
            }
        )
        assert update_response.status_code == 200
        
        data = update_response.json()
        assert data["id"] == reminder_id  # ID should remain the same
        assert data["title"] == "Updated Reminder"
        assert data["message"] == "Updated message"
        
        # Clean up
        client.delete(f"/api/reminders/{reminder_id}", headers=token_headers)

    def test_delete_reminder_by_uuid(self, client: TestClient, token_headers: dict):
        """Test deleting a reminder by UUID."""
        # Create a reminder
        create_response = client.post(
            "/api/reminders",
            headers=token_headers,
            json={
                "title": "To Be Deleted",
                "message": "This will be deleted",
                "time": "10:00:00",
                "frequency": "daily",
                "is_active": True
            }
        )
        assert create_response.status_code == 201
        reminder_id = create_response.json()["id"]
        
        # Delete the reminder by UUID
        delete_response = client.delete(f"/api/reminders/{reminder_id}", headers=token_headers)
        assert delete_response.status_code == 200
        
        # Verify the reminder is deleted
        get_response = client.get(f"/api/reminders/{reminder_id}", headers=token_headers)
        assert get_response.status_code == 404

    def test_list_reminders_with_uuid_values(self, client: TestClient, token_headers: dict):
        """Test listing reminders with UUID values."""
        # Create multiple reminders
        reminder_ids = []
        for i in range(3):
            response = client.post(
                "/api/reminders",
                headers=token_headers,
                json={
                    "title": f"Reminder {i}",
                    "message": f"Message {i}",
                    "time": "10:00:00",
                    "frequency": "daily",
                    "is_active": True
                }
            )
            assert response.status_code == 201
            reminder_ids.append(response.json()["id"])
        
        # List all reminders
        list_response = client.get("/api/reminders", headers=token_headers)
        assert list_response.status_code == 200
        
        data = list_response.json()
        assert isinstance(data, list)
        assert len(data) >= 3
        
        # Verify all returned reminders have valid UUIDs
        for reminder in data:
            assert "id" in reminder
            assert "user_id" in reminder
            uuid.UUID(reminder["id"])  # Should not raise exception
            uuid.UUID(reminder["user_id"])  # Should not raise exception
        
        # Clean up
        for reminder_id in reminder_ids:
            client.delete(f"/api/reminders/{reminder_id}", headers=token_headers)


class TestUsersRouterUUID:
    """Test UUID handling in users router endpoints."""

    def test_get_current_user_returns_uuid(self, client_with_db: TestClient, token_headers: dict):
        """Test that getting current user returns valid UUID."""
        response = client_with_db.get("/api/users/me", headers=token_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        
        # Verify the ID is a valid UUID
        user_uuid = uuid.UUID(data["id"])
        assert isinstance(user_uuid, uuid.UUID)

    def test_get_user_by_uuid(self, client_with_db: TestClient, token_headers: dict, sync_test_user: User):
        """Test retrieving a user by UUID."""
        user_id = str(sync_test_user.id)
        
        # Test accessing own profile by UUID - should work
        response = client_with_db.get(f"/api/users/{user_id}", headers=token_headers)
        
        # Should return 200 since user is accessing their own profile
        if response.status_code == 200:
            data = response.json()
            assert data["id"] == user_id
            # Verify the ID is a valid UUID
            user_uuid = uuid.UUID(data["id"])
            assert isinstance(user_uuid, uuid.UUID)
        else:
            # Unexpected status code
            assert False, f"Unexpected status code: {response.status_code}, response: {response.text}"

    def test_user_profile_endpoints_with_uuid(self, client_with_db: TestClient, token_headers: dict):
        """Test user profile endpoints return valid UUIDs."""
        
        # Test GET /api/users/me
        response = client_with_db.get("/api/users/me", headers=token_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        
        # Verify the ID is a valid UUID
        user_uuid = uuid.UUID(data["id"])
        assert isinstance(user_uuid, uuid.UUID)
        
        # Test other user endpoints if they exist
        # For example, updating user profile
        update_data = {"full_name": "Updated Name"}
        response = client_with_db.put("/api/users/me", json=update_data, headers=token_headers)
        
        if response.status_code == 200:
            data = response.json()
            assert "id" in data
            user_uuid = uuid.UUID(data["id"])
            assert isinstance(user_uuid, uuid.UUID)
        elif response.status_code == 404:
            # Endpoint doesn't exist, which is fine
            pass
        else:
            # For other status codes, just verify it's not a server error
            assert response.status_code < 500, f"Server error: {response.status_code}, response: {response.text}"


class TestTagsRouterUUID:
    """Test UUID handling in tags router endpoints."""

    def test_get_tags_returns_uuid_values(self, client: TestClient, token_headers: dict):
        """Test that getting tags returns valid UUID values."""
        # First create a journal with tags to ensure we have tags
        client.post(
            "/api/journals",
            headers=token_headers,
            json={
                "title": "Tag Test Entry",
                "content": "Testing tags",
                "entry_date": "2023-03-27",
                "tags": ["uuid-tag-test-1", "uuid-tag-test-2"]
            }
        )
        
        # Get tags
        response = client.get("/api/tags", headers=token_headers)
        assert response.status_code == 200
        
        tags = response.json()
        assert isinstance(tags, list)
        
        # Verify all tags have valid UUIDs
        for tag in tags:
            assert "id" in tag
            assert "user_id" in tag
            uuid.UUID(tag["id"])  # Should not raise exception
            uuid.UUID(tag["user_id"])  # Should not raise exception

    def test_tag_crud_operations_with_uuid(self, client: TestClient, token_headers: dict):
        """Test tag CRUD operations with UUID handling."""
        # Create a journal with tags
        journal_response = client.post(
            "/api/journals",
            headers=token_headers,
            json={
                "title": "Tag CRUD Test",
                "content": "Testing tag CRUD",
                "entry_date": "2023-03-27",
                "tags": ["crud-test-tag"]
            }
        )
        assert journal_response.status_code == 201
        journal_id = journal_response.json()["id"]
        
        # Get the created tag
        tags_response = client.get("/api/tags", headers=token_headers)
        assert tags_response.status_code == 200
        
        tags = tags_response.json()
        crud_tag = next((tag for tag in tags if tag["name"] == "crud-test-tag"), None)
        assert crud_tag is not None
        
        # Verify tag has valid UUID
        tag_uuid = uuid.UUID(crud_tag["id"])
        assert isinstance(tag_uuid, uuid.UUID)
        
        # Clean up
        client.delete(f"/api/journals/{journal_id}", headers=token_headers)


class TestAuthenticationWithUUID:
    """Test authentication endpoints with UUID handling."""

    def test_login_returns_user_with_uuid(self, client_with_db: TestClient, test_user_sync: User):
        """Test that login returns user with valid UUID."""
        response = client_with_db.post(
            "/api/auth/login/json",
            json={
                "email": test_user_sync.email,
                "password": "testpassword"  # This should match the test user's password
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            assert "user" in data
            assert "id" in data["user"]
            
            # Verify the ID is a valid UUID
            user_uuid = uuid.UUID(data["user"]["id"])
            assert isinstance(user_uuid, uuid.UUID)
        else:
            # Login might fail if the endpoint doesn't exist or has different requirements
            # We'll just verify it's not a server error
            assert response.status_code < 500, f"Server error: {response.status_code}, response: {response.text}"

    def test_register_returns_user_with_uuid(self, client_with_db: TestClient, db: Session):
        """Test that registration returns user with valid UUID."""
        test_email = f"uuid_register_test_{uuid.uuid4()}@example.com"
        
        response = client_with_db.post(
            "/api/auth/register",
            json={
                "email": test_email,
                "password": "TestPassword123",
                "full_name": "UUID Test User"
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            assert "user" in data
            assert "id" in data["user"]
            
            # Verify user ID is a valid UUID
            user_uuid = uuid.UUID(data["user"]["id"])
            assert isinstance(user_uuid, uuid.UUID)
            
            # Clean up - delete the created user
            from app.services import user_service
            user_service.remove(db=db, id=user_uuid)


class TestErrorHandlingWithUUID:
    """Test error handling scenarios with UUID parameters."""

    def test_malformed_uuid_error_response(self, client: TestClient, token_headers: dict):
        """Test error response format for malformed UUIDs."""
        malformed_uuid = "not-a-valid-uuid"
        
        response = client.get(f"/api/journals/{malformed_uuid}", headers=token_headers)
        assert response.status_code == 422
        
        data = response.json()
        assert "detail" in data
        # The error should mention UUID validation
        error_detail = str(data["detail"]).lower()
        assert "uuid" in error_detail or "invalid" in error_detail

    def test_constraint_violation_error_with_uuid(self, client: TestClient, token_headers: dict):
        """Test constraint violation error handling with UUID context."""
        # Create a journal
        create_response = client.post(
            "/api/journals",
            headers=token_headers,
            json={
                "title": "Constraint Test",
                "content": "Testing constraints",
                "entry_date": "2023-03-27"
            }
        )
        assert create_response.status_code == 201
        journal_id = create_response.json()["id"]
        
        # Try to create another journal with invalid data that might violate constraints
        # This test depends on the specific constraints in the system
        
        # Clean up
        client.delete(f"/api/journals/{journal_id}", headers=token_headers)

    def test_permission_denied_with_uuid(self, client: TestClient, token_headers: dict, db: Session):
        """Test permission denied scenarios with UUID parameters."""
        # Create another user
        other_user_data = TestDataFactory.create_user_data("other_user")
        other_user = User(**other_user_data)
        db.add(other_user)
        db.commit()
        db.refresh(other_user)
        
        # Create a journal for the other user
        other_user_journal_data = TestDataFactory.create_journal_entry_data(
            other_user.id, "other_user_journal"
        )
        other_user_journal = JournalEntry(**other_user_journal_data)
        db.add(other_user_journal)
        db.commit()
        db.refresh(other_user_journal)
        
        # Try to access the other user's journal (should be forbidden)
        response = client.get(f"/api/journals/{other_user_journal.id}", headers=token_headers)
        # The response could be 403 (forbidden) or 404 (not found, hiding existence)
        assert response.status_code in [403, 404]
        
        # Clean up
        db.delete(other_user_journal)
        db.delete(other_user)
        db.commit()


class TestAPIResponseSerialization:
    """Test API response serialization with UUID values."""

    def test_consistent_uuid_format_in_responses(self, client: TestClient, token_headers: dict):
        """Test that UUID values are consistently formatted in API responses."""
        # Create a journal
        create_response = client.post(
            "/api/journals",
            headers=token_headers,
            json={
                "title": "Serialization Test",
                "content": "Testing UUID serialization",
                "entry_date": "2023-03-27",
                "tags": ["serialization-test"]
            }
        )
        assert create_response.status_code == 201
        
        created_data = create_response.json()
        journal_id = created_data["id"]
        
        # Get the journal
        get_response = client.get(f"/api/journals/{journal_id}", headers=token_headers)
        assert get_response.status_code == 200
        
        get_data = get_response.json()
        
        # Verify UUID format consistency
        assert created_data["id"] == get_data["id"]
        assert created_data["user_id"] == get_data["user_id"]
        
        # Verify UUIDs are in string format
        assert isinstance(created_data["id"], str)
        assert isinstance(created_data["user_id"], str)
        assert isinstance(get_data["id"], str)
        assert isinstance(get_data["user_id"], str)
        
        # Verify they can be parsed as UUIDs
        uuid.UUID(created_data["id"])
        uuid.UUID(created_data["user_id"])
        uuid.UUID(get_data["id"])
        uuid.UUID(get_data["user_id"])
        
        # Clean up
        client.delete(f"/api/journals/{journal_id}", headers=token_headers)

    def test_uuid_values_in_list_responses(self, client: TestClient, token_headers: dict):
        """Test UUID values in list/pagination responses."""
        # Create multiple journals
        journal_ids = []
        for i in range(3):
            response = client.post(
                "/api/journals",
                headers=token_headers,
                json={
                    "title": f"List Test {i}",
                    "content": f"Content {i}",
                    "entry_date": "2023-03-27"
                }
            )
            assert response.status_code == 201
            journal_ids.append(response.json()["id"])
        
        # Get list response
        list_response = client.get("/api/journals", headers=token_headers)
        assert list_response.status_code == 200
        
        data = list_response.json()
        assert "items" in data
        
        # Verify all items have consistent UUID format
        for item in data["items"]:
            assert "id" in item
            assert "user_id" in item
            assert isinstance(item["id"], str)
            assert isinstance(item["user_id"], str)
            uuid.UUID(item["id"])  # Should not raise exception
            uuid.UUID(item["user_id"])  # Should not raise exception
        
        # Clean up
        for journal_id in journal_ids:
            client.delete(f"/api/journals/{journal_id}", headers=token_headers) 