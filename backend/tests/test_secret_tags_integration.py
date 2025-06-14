"""
Integration Tests for Secret Tags System

This module provides end-to-end integration tests for the complete secret tags system,
testing the interaction between all components:
- Database models and relationships
- API endpoints and authentication
- Speech service integration
- Zero-knowledge encryption compliance
- Complete user workflows
"""

import pytest
import json
from datetime import datetime
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from app.models.user import User
from app.models.secret_tag import SecretTag
from app.models.journal_entry import JournalEntry


class TestSecretTagsIntegration:
    """Integration tests for complete secret tags workflows"""

    def test_complete_secret_tag_workflow(self, client: TestClient, token_headers, test_user, db: Session):
        """Test complete workflow: create tag -> create entry -> retrieve entry"""
        
        # Step 1: Create a secret tag in the database (simulating client-side creation)
        secret_tag = SecretTag(
            id="integration-test-tag",
            user_id=test_user.id,
            color_code="#FF5733",
            created_at_client="2024-01-01T10:00:00Z",
            is_active=True,
            tag_hash="integration_test_hash_123"
        )
        db.add(secret_tag)
        db.commit()
        db.refresh(secret_tag)

        # Step 2: Create an encrypted journal entry with the secret tag
        encrypted_entry_data = {
            "title": "Integration Test Entry",
            "content": "",  # Empty for encrypted entries
            "entry_date": "2024-01-01T12:00:00Z",
            "encrypted_content": "base64_encrypted_content_integration",
            "encryption_iv": "base64_iv_integration",
            "encryption_salt": "base64_salt_integration",
            "encrypted_key": "base64_key_integration",
            "key_derivation_iterations": 100000,
            "encryption_algorithm": "AES-GCM",
            "encryption_wrap_iv": "base64_wrap_iv_integration",
            "secret_tag_id": secret_tag.id,
            "secret_tag_hash": secret_tag.tag_hash,
            "tags": ["integration", "test"]
        }

        # Create the entry via API
        create_response = client.post(
            "/api/journals",
            json=encrypted_entry_data,
            headers=token_headers
        )
        assert create_response.status_code == 200
        created_entry = create_response.json()
        
        # Verify entry was created with secret tag
        assert created_entry["secret_tag_id"] == secret_tag.id
        assert created_entry["secret_tag_hash"] == secret_tag.tag_hash
        assert created_entry["encrypted_content"] == "base64_encrypted_content_integration"
        assert created_entry["content"] == ""  # Should be empty

        # Step 3: Retrieve entries and verify filtering
        get_response = client.get(
            "/api/journals",
            headers=token_headers
        )
        assert get_response.status_code == 200
        entries = get_response.json()
        
        # Should contain our encrypted entry
        integration_entry = next((e for e in entries if e["id"] == created_entry["id"]), None)
        assert integration_entry is not None
        assert integration_entry["secret_tag_id"] == secret_tag.id

        # Step 4: Test secret tag activation endpoint
        activation_response = client.post(
            "/api/speech/secret-tag/activate",
            json={
                "tag_id": secret_tag.id,
                "action": "activate"
            },
            headers=token_headers
        )
        assert activation_response.status_code == 200
        activation_data = activation_response.json()
        assert activation_data["success"] is True
        assert activation_data["tag_id"] == secret_tag.id

        # Step 5: Clean up
        db.delete(db.query(JournalEntry).filter(JournalEntry.id == created_entry["id"]).first())
        db.delete(secret_tag)
        db.commit()

    def test_multi_user_secret_tag_isolation(self, client: TestClient, db: Session):
        """Test that secret tags are properly isolated between users"""
        
        # Create two users
        user1 = User(
            email="user1@isolation.test",
            full_name="User One",
            hashed_password="password1",
            is_active=True
        )
        user2 = User(
            email="user2@isolation.test",
            full_name="User Two",
            hashed_password="password2",
            is_active=True
        )
        db.add(user1)
        db.add(user2)
        db.commit()
        db.refresh(user1)
        db.refresh(user2)

        # Create secret tags for each user
        tag1 = SecretTag(
            id="user1-tag",
            user_id=user1.id,
            tag_hash="user1_hash",
            created_at_client="2024-01-01T10:00:00Z"
        )
        tag2 = SecretTag(
            id="user2-tag",
            user_id=user2.id,
            tag_hash="user2_hash",
            created_at_client="2024-01-01T10:00:00Z"
        )
        db.add(tag1)
        db.add(tag2)
        db.commit()

        # Create tokens for both users
        from app.core.security import create_access_token
        from datetime import timedelta
        
        token1 = create_access_token(user1.id, expires_delta=timedelta(minutes=30))
        token2 = create_access_token(user2.id, expires_delta=timedelta(minutes=30))
        
        headers1 = {"Authorization": f"Bearer {token1}"}
        headers2 = {"Authorization": f"Bearer {token2}"}

        # User 1 tries to activate User 2's tag (should fail)
        response = client.post(
            "/api/speech/secret-tag/activate",
            json={
                "tag_id": "user2-tag",
                "action": "activate"
            },
            headers=headers1
        )
        assert response.status_code == 404  # Tag not found for user 1

        # User 2 can activate their own tag
        response = client.post(
            "/api/speech/secret-tag/activate",
            json={
                "tag_id": "user2-tag",
                "action": "activate"
            },
            headers=headers2
        )
        assert response.status_code == 200

        # Clean up
        db.delete(tag1)
        db.delete(tag2)
        db.delete(user1)
        db.delete(user2)
        db.commit()

    def test_secret_tag_entry_filtering_workflow(self, client: TestClient, token_headers, test_user, db: Session):
        """Test complete entry filtering workflow with secret tags"""
        
        # Create multiple secret tags
        work_tag = SecretTag(
            id="work-tag-filter",
            user_id=test_user.id,
            tag_hash="work_filter_hash",
            created_at_client="2024-01-01T10:00:00Z"
        )
        personal_tag = SecretTag(
            id="personal-tag-filter",
            user_id=test_user.id,
            tag_hash="personal_filter_hash",
            created_at_client="2024-01-01T10:00:00Z"
        )
        db.add(work_tag)
        db.add(personal_tag)
        db.commit()

        # Create entries with different secret tags
        entries_data = [
            {
                "title": "Public Entry",
                "content": "This is public content",
                "entry_date": "2024-01-01T10:00:00Z",
                "secret_tag_id": None,
                "secret_tag_hash": None
            },
            {
                "title": "Work Entry",
                "content": "",
                "entry_date": "2024-01-01T11:00:00Z",
                "encrypted_content": "work_encrypted_content",
                "encryption_iv": "work_iv",
                "encryption_salt": "work_salt",
                "encrypted_key": "work_key",
                "encryption_algorithm": "AES-GCM",
                "secret_tag_id": work_tag.id,
                "secret_tag_hash": work_tag.tag_hash
            },
            {
                "title": "Personal Entry",
                "content": "",
                "entry_date": "2024-01-01T12:00:00Z",
                "encrypted_content": "personal_encrypted_content",
                "encryption_iv": "personal_iv",
                "encryption_salt": "personal_salt",
                "encrypted_key": "personal_key",
                "encryption_algorithm": "AES-GCM",
                "secret_tag_id": personal_tag.id,
                "secret_tag_hash": personal_tag.tag_hash
            }
        ]

        created_entries = []
        for entry_data in entries_data:
            response = client.post("/api/journals", json=entry_data, headers=token_headers)
            assert response.status_code == 200
            created_entries.append(response.json())

        # Test filtering with no secret tag hashes (should return only public entries)
        response = client.get("/api/journals", headers=token_headers)
        assert response.status_code == 200
        all_entries = response.json()
        
        # Should contain all entries (filtering happens client-side)
        assert len(all_entries) >= 3

        # Test filtering with specific secret tag hash
        response = client.get(
            f"/api/journals?secret_tag_hashes={work_tag.tag_hash}",
            headers=token_headers
        )
        assert response.status_code == 200
        work_entries = response.json()
        
        # Should contain public entries and work entries
        work_entry_found = any(e["secret_tag_id"] == work_tag.id for e in work_entries)
        assert work_entry_found

        # Clean up
        for entry in created_entries:
            client.delete(f"/api/journals/{entry['id']}", headers=token_headers)
        db.delete(work_tag)
        db.delete(personal_tag)
        db.commit()

    def test_speech_transcription_with_secret_tags(self, client: TestClient, token_headers, test_user, db: Session):
        """Test speech transcription endpoint with secret tag detection"""
        
        # Create a secret tag for testing
        secret_tag = SecretTag(
            id="speech-test-tag",
            user_id=test_user.id,
            tag_hash="speech_test_hash",
            created_at_client="2024-01-01T10:00:00Z",
            is_active=True
        )
        db.add(secret_tag)
        db.commit()

        # Mock audio file for testing
        import io
        audio_content = b"fake_audio_data_for_speech_test"
        
        # Mock the speech service to avoid actual API calls
        import unittest.mock
        from app.services.speech_service import speech_service
        
        with unittest.mock.patch.object(speech_service, 'transcribe_audio_with_user_context') as mock_transcribe:
            mock_transcribe.return_value = {
                "transcript": "activate work secret mode",
                "detected_language_code": "en-US",
                "secret_tag_detected": None  # Server-side detection is placeholder
            }
            
            # Test transcription endpoint
            response = client.post(
                "/api/speech/transcribe",
                files={"file": ("test.wav", io.BytesIO(audio_content), "audio/wav")},
                headers=token_headers
            )

            assert response.status_code == 200
            data = response.json()
            
            # Verify response structure
            assert "transcript" in data
            assert "detected_language_code" in data
            assert "secret_tag_detected" in data
            assert data["transcript"] == "activate work secret mode"
            assert data["detected_language_code"] == "en-US"
            
            # Verify speech service was called with correct parameters
            mock_transcribe.assert_called_once()
            call_args = mock_transcribe.call_args
            assert call_args[1]["user_id"] == test_user.id
            assert call_args[1]["db"] is not None

        # Clean up
        db.delete(secret_tag)
        db.commit()

    def test_zero_knowledge_compliance_integration(self, client: TestClient, token_headers, test_user, db: Session):
        """Test that the complete system maintains zero-knowledge principles"""
        
        # Create secret tag
        secret_tag = SecretTag(
            id="zero-knowledge-test",
            user_id=test_user.id,
            tag_hash="zero_knowledge_hash",
            created_at_client="2024-01-01T10:00:00Z"
        )
        db.add(secret_tag)
        db.commit()

        # Create encrypted entry
        entry_data = {
            "title": "Zero Knowledge Test",
            "content": "",  # No plaintext content
            "entry_date": "2024-01-01T10:00:00Z",
            "encrypted_content": "client_side_encrypted_content",
            "encryption_iv": "client_generated_iv",
            "encryption_salt": "client_generated_salt",
            "encrypted_key": "client_wrapped_key",
            "encryption_algorithm": "AES-GCM",
            "secret_tag_id": secret_tag.id,
            "secret_tag_hash": secret_tag.tag_hash
        }

        response = client.post("/api/journals", json=entry_data, headers=token_headers)
        assert response.status_code == 200
        created_entry = response.json()

        # Verify zero-knowledge compliance
        # 1. No plaintext content stored
        assert created_entry["content"] == ""
        
        # 2. Only encrypted content and metadata stored
        assert created_entry["encrypted_content"] == "client_side_encrypted_content"
        assert created_entry["secret_tag_id"] == secret_tag.id
        
        # 3. Server-side tag hash is non-reversible
        assert created_entry["secret_tag_hash"] == "zero_knowledge_hash"
        assert "zero-knowledge-test" not in created_entry["secret_tag_hash"]  # Tag ID not in hash

        # 4. Verify database doesn't contain sensitive data
        db_entry = db.query(JournalEntry).filter(JournalEntry.id == created_entry["id"]).first()
        assert db_entry.content == ""  # No plaintext in DB
        assert db_entry.encrypted_content == "client_side_encrypted_content"
        
        db_tag = db.query(SecretTag).filter(SecretTag.id == secret_tag.id).first()
        # Verify no sensitive fields in secret tag model
        assert not hasattr(db_tag, 'name')  # No tag name in DB
        assert not hasattr(db_tag, 'phrase')  # No phrase in DB
        assert db_tag.tag_hash == "zero_knowledge_hash"  # Only non-reversible hash

        # Clean up
        client.delete(f"/api/journals/{created_entry['id']}", headers=token_headers)
        db.delete(secret_tag)
        db.commit()

    def test_error_handling_integration(self, client: TestClient, token_headers, test_user, db: Session):
        """Test error handling across the complete system"""
        
        # Test 1: Try to activate non-existent secret tag
        response = client.post(
            "/api/speech/secret-tag/activate",
            json={
                "tag_id": "non-existent-tag",
                "action": "activate"
            },
            headers=token_headers
        )
        assert response.status_code == 404
        assert "Secret tag not found" in response.json()["detail"]

        # Test 2: Try to create entry with invalid secret tag reference
        invalid_entry_data = {
            "title": "Invalid Entry",
            "content": "",
            "entry_date": "2024-01-01T10:00:00Z",
            "secret_tag_id": "non-existent-tag",
            "secret_tag_hash": "invalid_hash"
        }
        
        response = client.post("/api/journals", json=invalid_entry_data, headers=token_headers)
        # Should succeed (validation happens client-side)
        assert response.status_code == 200

        # Test 3: Try to access secret tag activation without authentication
        response = client.post(
            "/api/speech/secret-tag/activate",
            json={
                "tag_id": "some-tag",
                "action": "activate"
            }
        )
        assert response.status_code == 401

        # Test 4: Try to transcribe without authentication
        import io
        response = client.post(
            "/api/speech/transcribe",
            files={"file": ("test.wav", io.BytesIO(b"audio"), "audio/wav")}
        )
        assert response.status_code == 401

    def test_performance_with_multiple_secret_tags(self, client: TestClient, token_headers, test_user, db: Session):
        """Test system performance with multiple secret tags and entries"""
        
        # Create multiple secret tags
        secret_tags = []
        for i in range(10):
            tag = SecretTag(
                id=f"perf-tag-{i}",
                user_id=test_user.id,
                tag_hash=f"perf_hash_{i}",
                created_at_client="2024-01-01T10:00:00Z"
            )
            secret_tags.append(tag)
            db.add(tag)
        db.commit()

        # Create multiple entries with different secret tags
        created_entries = []
        for i in range(20):
            tag_index = i % 10
            entry_data = {
                "title": f"Performance Test Entry {i}",
                "content": "" if i % 2 == 0 else f"Public content {i}",
                "entry_date": f"2024-01-01T{10 + i % 14}:00:00Z",
                "secret_tag_id": secret_tags[tag_index].id if i % 2 == 0 else None,
                "secret_tag_hash": secret_tags[tag_index].tag_hash if i % 2 == 0 else None
            }
            
            if i % 2 == 0:  # Add encryption fields for secret entries
                entry_data.update({
                    "encrypted_content": f"encrypted_content_{i}",
                    "encryption_iv": f"iv_{i}",
                    "encryption_salt": f"salt_{i}",
                    "encrypted_key": f"key_{i}",
                    "encryption_algorithm": "AES-GCM"
                })

            response = client.post("/api/journals", json=entry_data, headers=token_headers)
            assert response.status_code == 200
            created_entries.append(response.json())

        # Test retrieval performance
        import time
        start_time = time.time()
        
        response = client.get("/api/journals", headers=token_headers)
        assert response.status_code == 200
        
        end_time = time.time()
        retrieval_time = end_time - start_time
        
        # Should complete within reasonable time (adjust threshold as needed)
        assert retrieval_time < 5.0  # 5 seconds max
        
        entries = response.json()
        assert len(entries) >= 20

        # Test filtering performance with multiple tag hashes
        tag_hashes = [tag.tag_hash for tag in secret_tags[:5]]
        start_time = time.time()
        
        response = client.get(
            f"/api/journals?{'&'.join(f'secret_tag_hashes={h}' for h in tag_hashes)}",
            headers=token_headers
        )
        assert response.status_code == 200
        
        end_time = time.time()
        filter_time = end_time - start_time
        
        # Filtering should also be fast
        assert filter_time < 3.0  # 3 seconds max

        # Clean up
        for entry in created_entries:
            client.delete(f"/api/journals/{entry['id']}", headers=token_headers)
        for tag in secret_tags:
            db.delete(tag)
        db.commit()


class TestSecretTagsBackwardCompatibility:
    """Test backward compatibility with existing system"""

    def test_public_entries_still_work(self, client: TestClient, token_headers, test_user, db: Session):
        """Test that public entries work exactly as before"""
        
        # Create a traditional public entry
        entry_data = {
            "title": "Traditional Public Entry",
            "content": "This is traditional public content",
            "entry_date": "2024-01-01T10:00:00Z",
            "tags": ["public", "traditional"]
        }

        response = client.post("/api/journals", json=entry_data, headers=token_headers)
        assert response.status_code == 200
        created_entry = response.json()

        # Verify it's a public entry
        assert created_entry["secret_tag_id"] is None
        assert created_entry["secret_tag_hash"] is None
        assert created_entry["content"] == "This is traditional public content"
        assert created_entry["encrypted_content"] is None

        # Verify it appears in listings
        response = client.get("/api/journals", headers=token_headers)
        assert response.status_code == 200
        entries = response.json()
        
        public_entry = next((e for e in entries if e["id"] == created_entry["id"]), None)
        assert public_entry is not None
        assert public_entry["content"] == "This is traditional public content"

        # Clean up
        client.delete(f"/api/journals/{created_entry['id']}", headers=token_headers)

    def test_existing_api_endpoints_unchanged(self, client: TestClient, token_headers):
        """Test that existing API endpoints maintain their interface"""
        
        # Test journal endpoints still work
        response = client.get("/api/journals", headers=token_headers)
        assert response.status_code == 200
        
        # Test search still works
        response = client.get("/api/journals/search?q=test", headers=token_headers)
        assert response.status_code == 200
        
        # Test tags endpoint still works
        response = client.get("/api/journals/tags/", headers=token_headers)
        assert response.status_code == 200 