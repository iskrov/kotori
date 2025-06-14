"""
Tests for Secret Tags functionality.

This module tests the complete secret tags system including:
- SecretTag model operations
- Database relationships and constraints
- API endpoints for secret tag management
- Speech service integration
- Zero-knowledge encryption compliance
"""

import pytest
from datetime import datetime
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from app.models.user import User
from app.models.secret_tag import SecretTag
from app.models.journal_entry import JournalEntry
from app.services.speech_service import speech_service


class TestSecretTagModel:
    """Test SecretTag model functionality"""

    def test_secret_tag_creation(self, db: Session):
        """Test creating a secret tag"""
        # Create a user first
        user = User(
            email="secret_test@example.com",
            full_name="Secret Test User",
            hashed_password="password",
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create a secret tag
        secret_tag = SecretTag(
            id="test-tag-uuid-123",
            user_id=user.id,
            color_code="#FF5733",
            created_at_client="2024-01-01T10:00:00Z",
            is_active=True,
            tag_hash="test_hash_123456789"
        )

        db.add(secret_tag)
        db.commit()
        db.refresh(secret_tag)

        # Assert values
        assert secret_tag.id == "test-tag-uuid-123"
        assert secret_tag.user_id == user.id
        assert secret_tag.color_code == "#FF5733"
        assert secret_tag.created_at_client == "2024-01-01T10:00:00Z"
        assert secret_tag.is_active is True
        assert secret_tag.tag_hash == "test_hash_123456789"
        assert secret_tag.created_at is not None
        assert secret_tag.updated_at is not None

        # Clean up
        db.delete(secret_tag)
        db.delete(user)
        db.commit()

    def test_secret_tag_default_values(self, db: Session):
        """Test secret tag default values"""
        # Create a user first
        user = User(
            email="default_test@example.com",
            full_name="Default Test User",
            hashed_password="password",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create a secret tag with minimal data
        secret_tag = SecretTag(
            id="test-tag-uuid-456",
            user_id=user.id,
            created_at_client="2024-01-01T10:00:00Z",
            tag_hash="test_hash_456789123"
        )

        db.add(secret_tag)
        db.commit()
        db.refresh(secret_tag)

        # Assert default values
        assert secret_tag.color_code == "#007AFF"  # Default color
        assert secret_tag.is_active is True  # Default active state

        # Clean up
        db.delete(secret_tag)
        db.delete(user)
        db.commit()

    def test_secret_tag_unique_hash_constraint(self, db: Session):
        """Test that tag_hash must be unique"""
        # Create a user
        user = User(
            email="unique_test@example.com",
            full_name="Unique Test User",
            hashed_password="password",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create first secret tag
        secret_tag1 = SecretTag(
            id="test-tag-uuid-789",
            user_id=user.id,
            created_at_client="2024-01-01T10:00:00Z",
            tag_hash="duplicate_hash_123"
        )
        db.add(secret_tag1)
        db.commit()

        # Try to create second secret tag with same hash
        secret_tag2 = SecretTag(
            id="test-tag-uuid-101",
            user_id=user.id,
            created_at_client="2024-01-01T11:00:00Z",
            tag_hash="duplicate_hash_123"  # Same hash
        )
        db.add(secret_tag2)

        # Should raise integrity error
        with pytest.raises(Exception):  # SQLAlchemy will raise IntegrityError
            db.commit()

        # Clean up
        db.rollback()
        db.delete(secret_tag1)
        db.delete(user)
        db.commit()

    def test_secret_tag_user_relationship(self, db: Session):
        """Test relationship between SecretTag and User"""
        # Create a user
        user = User(
            email="relationship_test@example.com",
            full_name="Relationship Test User",
            hashed_password="password",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create multiple secret tags for the user
        tag1 = SecretTag(
            id="tag-1-uuid",
            user_id=user.id,
            created_at_client="2024-01-01T10:00:00Z",
            tag_hash="hash_1"
        )
        tag2 = SecretTag(
            id="tag-2-uuid",
            user_id=user.id,
            created_at_client="2024-01-01T11:00:00Z",
            tag_hash="hash_2"
        )

        db.add(tag1)
        db.add(tag2)
        db.commit()
        db.refresh(user)

        # Test relationship
        assert len(user.secret_tags) == 2
        assert tag1 in user.secret_tags
        assert tag2 in user.secret_tags

        # Test back reference
        assert tag1.user == user
        assert tag2.user == user

        # Clean up
        db.delete(tag1)
        db.delete(tag2)
        db.delete(user)
        db.commit()


class TestSecretTagJournalIntegration:
    """Test integration between SecretTag and JournalEntry"""

    def test_journal_entry_with_secret_tag(self, db: Session):
        """Test creating journal entry with secret tag"""
        # Create user and secret tag
        user = User(
            email="journal_secret@example.com",
            full_name="Journal Secret User",
            hashed_password="password",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        secret_tag = SecretTag(
            id="journal-tag-uuid",
            user_id=user.id,
            created_at_client="2024-01-01T10:00:00Z",
            tag_hash="journal_hash_123"
        )
        db.add(secret_tag)
        db.commit()
        db.refresh(secret_tag)

        # Create journal entry with secret tag
        entry = JournalEntry(
            title="Secret Entry",
            content="",  # Empty for secret entries
            entry_date=datetime.utcnow(),
            user_id=user.id,
            encrypted_content="encrypted_content_base64",
            encryption_iv="iv_base64",
            encryption_salt="salt_base64",
            encrypted_key="key_base64",
            encryption_algorithm="AES-GCM",
            secret_tag_id=secret_tag.id,
            secret_tag_hash=secret_tag.tag_hash
        )

        db.add(entry)
        db.commit()
        db.refresh(entry)

        # Assert secret tag fields
        assert entry.secret_tag_id == secret_tag.id
        assert entry.secret_tag_hash == secret_tag.tag_hash
        assert entry.encrypted_content == "encrypted_content_base64"
        assert entry.content == ""  # Should be empty for secret entries

        # Test relationship
        assert entry.secret_tag == secret_tag

        # Clean up
        db.delete(entry)
        db.delete(secret_tag)
        db.delete(user)
        db.commit()

    def test_public_journal_entry(self, db: Session):
        """Test creating public journal entry (no secret tag)"""
        # Create user
        user = User(
            email="public_journal@example.com",
            full_name="Public Journal User",
            hashed_password="password",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create public journal entry
        entry = JournalEntry(
            title="Public Entry",
            content="This is public content",
            entry_date=datetime.utcnow(),
            user_id=user.id,
            secret_tag_id=None,
            secret_tag_hash=None
        )

        db.add(entry)
        db.commit()
        db.refresh(entry)

        # Assert public entry fields
        assert entry.secret_tag_id is None
        assert entry.secret_tag_hash is None
        assert entry.encrypted_content is None
        assert entry.content == "This is public content"
        assert entry.secret_tag is None

        # Clean up
        db.delete(entry)
        db.delete(user)
        db.commit()


class TestSecretTagAPI:
    """Test Secret Tag API endpoints"""

    def test_secret_tag_activation_endpoint_success(self, client: TestClient, token_headers, test_user, db: Session):
        """Test successful secret tag activation"""
        # Create a secret tag for the test user
        secret_tag = SecretTag(
            id="api-test-tag-uuid",
            user_id=test_user.id,
            created_at_client="2024-01-01T10:00:00Z",
            tag_hash="api_test_hash_123",
            is_active=True
        )
        db.add(secret_tag)
        db.commit()
        db.refresh(secret_tag)  # Ensure the object is refreshed from DB

        # Verify the secret tag exists in the database
        found_tag = db.query(SecretTag).filter(
            SecretTag.id == "api-test-tag-uuid",
            SecretTag.user_id == test_user.id,
            SecretTag.is_active == True
        ).first()
        assert found_tag is not None, "Secret tag should exist in database"

        # Test activation request
        response = client.post(
            "/api/speech/secret-tag/activate",
            json={
                "tag_id": "api-test-tag-uuid",
                "action": "activate"
            },
            headers=token_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["tag_id"] == "api-test-tag-uuid"
        assert data["action"] == "activate"
        assert "message" in data

        # Clean up
        db.delete(secret_tag)
        db.commit()

    def test_secret_tag_activation_endpoint_not_found(self, client: TestClient, token_headers):
        """Test secret tag activation with non-existent tag"""
        response = client.post(
            "/api/speech/secret-tag/activate",
            json={
                "tag_id": "non-existent-tag-uuid",
                "action": "activate"
            },
            headers=token_headers
        )

        assert response.status_code == 404
        data = response.json()
        assert data["detail"] == "Secret tag not found"

    def test_secret_tag_activation_endpoint_unauthorized(self, client: TestClient):
        """Test secret tag activation without authentication"""
        response = client.post(
            "/api/speech/secret-tag/activate",
            json={
                "tag_id": "some-tag-uuid",
                "action": "activate"
            }
        )

        assert response.status_code == 401

    def test_secret_tag_activation_endpoint_invalid_data(self, client: TestClient, token_headers):
        """Test secret tag activation with invalid data"""
        # Test with missing required fields
        response = client.post(
            "/api/speech/secret-tag/activate",
            json={},  # Missing required fields
            headers=token_headers
        )

        assert response.status_code == 422  # Validation error

    def test_transcription_endpoint_with_secret_tags(self, client: TestClient, token_headers):
        """Test transcription endpoint returns secret tag detection field"""
        # Create a minimal audio file for testing
        import io
        audio_content = b"fake_audio_data"
        
        # Mock the speech service to avoid actual API calls
        import unittest.mock
        with unittest.mock.patch.object(speech_service, 'transcribe_audio_with_user_context') as mock_transcribe:
            mock_transcribe.return_value = {
                "transcript": "test transcript",
                "detected_language_code": "en-US",
                "secret_tag_detected": None
            }
            
            response = client.post(
                "/api/speech/transcribe",
                files={"file": ("test.wav", io.BytesIO(audio_content), "audio/wav")},
                headers=token_headers
            )

            assert response.status_code == 200
            data = response.json()
            assert "transcript" in data
            assert "detected_language_code" in data
            assert "secret_tag_detected" in data


class TestSpeechServiceSecretTags:
    """Test Speech Service integration with Secret Tags"""

    def test_check_secret_tag_phrases_method_exists(self):
        """Test that the secret tag phrase checking method exists"""
        assert hasattr(speech_service, '_check_secret_tag_phrases')
        
        # Test method signature
        import inspect
        sig = inspect.signature(speech_service._check_secret_tag_phrases)
        params = list(sig.parameters.keys())
        assert 'transcript' in params
        assert 'user_id' in params
        assert 'db' in params

    def test_transcribe_audio_with_user_context_signature(self):
        """Test that transcribe_audio_with_user_context has correct signature"""
        assert hasattr(speech_service, 'transcribe_audio_with_user_context')
        
        import inspect
        sig = inspect.signature(speech_service.transcribe_audio_with_user_context)
        params = list(sig.parameters.keys())
        assert 'audio_content' in params
        assert 'user_id' in params
        assert 'db' in params
        assert 'language_codes' in params

    @pytest.mark.asyncio
    async def test_secret_tag_phrase_detection_placeholder(self, db: Session, test_user):
        """Test secret tag phrase detection returns None (placeholder implementation)"""
        # Test the placeholder implementation
        result = speech_service._check_secret_tag_phrases(
            transcript="test transcript",
            user_id=test_user.id,
            db=db
        )
        
        # Should return None as it's a placeholder
        assert result is None


class TestSecretTagDataIntegrity:
    """Test data integrity and constraints for Secret Tags"""

    def test_secret_tag_soft_delete(self, db: Session):
        """Test soft delete functionality with is_active flag"""
        # Create user and secret tag
        user = User(
            email="soft_delete@example.com",
            full_name="Soft Delete User",
            hashed_password="password",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        secret_tag = SecretTag(
            id="soft-delete-tag-uuid",
            user_id=user.id,
            created_at_client="2024-01-01T10:00:00Z",
            tag_hash="soft_delete_hash",
            is_active=True
        )
        db.add(secret_tag)
        db.commit()

        # Soft delete by setting is_active to False
        secret_tag.is_active = False
        db.commit()
        db.refresh(secret_tag)

        # Tag should still exist but be inactive
        assert secret_tag.is_active is False
        assert db.query(SecretTag).filter(SecretTag.id == "soft-delete-tag-uuid").first() is not None

        # Clean up
        db.delete(secret_tag)
        db.delete(user)
        db.commit()

    def test_secret_tag_cascade_behavior(self, db: Session):
        """Test cascade behavior when user is deleted"""
        # Create user with secret tags
        user = User(
            email="cascade_test@example.com",
            full_name="Cascade Test User",
            hashed_password="password",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        secret_tag = SecretTag(
            id="cascade-tag-uuid",
            user_id=user.id,
            created_at_client="2024-01-01T10:00:00Z",
            tag_hash="cascade_hash"
        )
        db.add(secret_tag)
        db.commit()

        # Delete user
        db.delete(user)
        db.commit()

        # Secret tag should be deleted due to foreign key constraint
        remaining_tag = db.query(SecretTag).filter(SecretTag.id == "cascade-tag-uuid").first()
        assert remaining_tag is None

    def test_secret_tag_color_code_validation(self, db: Session):
        """Test color code format validation"""
        user = User(
            email="color_test@example.com",
            full_name="Color Test User",
            hashed_password="password",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        # Test valid color codes
        valid_colors = ["#FF5733", "#007AFF", "#000000", "#FFFFFF"]
        
        for i, color in enumerate(valid_colors):
            secret_tag = SecretTag(
                id=f"color-tag-{i}",
                user_id=user.id,
                created_at_client="2024-01-01T10:00:00Z",
                tag_hash=f"color_hash_{i}",
                color_code=color
            )
            db.add(secret_tag)
            db.commit()
            db.refresh(secret_tag)
            
            assert secret_tag.color_code == color
            
            # Clean up
            db.delete(secret_tag)
            db.commit()

        # Clean up user
        db.delete(user)
        db.commit()


class TestSecretTagZeroKnowledgeCompliance:
    """Test that Secret Tags maintain zero-knowledge principles"""

    def test_no_sensitive_data_in_database(self, db: Session):
        """Test that no sensitive data is stored in the database"""
        user = User(
            email="zero_knowledge@example.com",
            full_name="Zero Knowledge User",
            hashed_password="password",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        secret_tag = SecretTag(
            id="zero-knowledge-tag",
            user_id=user.id,
            created_at_client="2024-01-01T10:00:00Z",
            tag_hash="non_reversible_hash_123",
            color_code="#FF5733"
        )
        db.add(secret_tag)
        db.commit()
        db.refresh(secret_tag)

        # Verify only non-sensitive metadata is stored
        assert secret_tag.id is not None  # UUID is fine
        assert secret_tag.user_id is not None  # User reference is fine
        assert secret_tag.color_code is not None  # UI color is fine
        assert secret_tag.created_at_client is not None  # Timestamp is fine
        assert secret_tag.tag_hash is not None  # Non-reversible hash is fine
        
        # Verify no sensitive fields exist in the model
        assert not hasattr(secret_tag, 'name')  # No tag name
        assert not hasattr(secret_tag, 'phrase')  # No activation phrase
        assert not hasattr(secret_tag, 'phrase_hash')  # No phrase hash

        # Clean up
        db.delete(secret_tag)
        db.delete(user)
        db.commit()

    def test_journal_entry_encryption_fields(self, db: Session):
        """Test that journal entries have proper encryption fields for secret tags"""
        user = User(
            email="encryption_test@example.com",
            full_name="Encryption Test User",
            hashed_password="password",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create encrypted journal entry
        entry = JournalEntry(
            title="Encrypted Entry",
            content="",  # Empty for encrypted entries
            entry_date=datetime.utcnow(),
            user_id=user.id,
            # Encryption fields
            encrypted_content="base64_encrypted_content",
            encryption_iv="base64_iv",
            encryption_salt="base64_salt",
            encrypted_key="base64_wrapped_key",
            key_derivation_iterations=100000,
            encryption_algorithm="AES-GCM",
            encryption_wrap_iv="base64_wrap_iv",
            # Secret tag fields
            secret_tag_id="test-tag-uuid",
            secret_tag_hash="test_tag_hash"
        )

        db.add(entry)
        db.commit()
        db.refresh(entry)

        # Verify all encryption fields are present
        assert entry.encrypted_content is not None
        assert entry.encryption_iv is not None
        assert entry.encryption_salt is not None
        assert entry.encrypted_key is not None
        assert entry.key_derivation_iterations == 100000
        assert entry.encryption_algorithm == "AES-GCM"
        assert entry.encryption_wrap_iv is not None
        assert entry.secret_tag_id is not None
        assert entry.secret_tag_hash is not None
        
        # Verify plaintext content is empty
        assert entry.content == ""

        # Clean up
        db.delete(entry)
        db.delete(user)
        db.commit() 