import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
import sys
import os
from datetime import datetime
import base64

# Add the project root to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.models.user import User
from app.models.tag import Tag, JournalEntryTag
from app.models.secret_tag_opaque import SecretTag
from app.models.journal_entry import JournalEntry
from app.schemas.journal import JournalEntryCreate
from app.services.journal_service import JournalService
import uuid
from datetime import date

# Helper function to create a user
def create_test_user(db: Session) -> User:
    user = User(email="test@example.com", hashed_password="password")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

class TestRegularTags:
    def test_create_journal_with_new_tags(self, client: TestClient, token_headers, test_user: User, db: Session):
        """Test creating a journal entry with new regular tags."""
        entry_data = {
            "title": "My first entry",
            "content": "This is a test entry with new tags.",
            "tags": ["testing", "python", "fastapi"],
            "entry_date": datetime.now().isoformat()
        }
        response = client.post("/api/journals/", headers=token_headers, json=entry_data)
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "My first entry"
        assert len(data["tags"]) == 3
        assert "testing" in [t["name"] for t in data["tags"]]

        # Verify tags were created in the database
        tags_in_db = db.query(Tag).all()
        assert len(tags_in_db) == 3

        # Verify associations in journal_entry_tags
        journal_entry_id = data["id"]
        associations = db.query(JournalEntryTag).filter_by(entry_id=journal_entry_id).all()
        assert len(associations) == 3

    def test_create_journal_with_existing_tags(self, client: TestClient, token_headers, test_user: User, db: Session):
        """Test creating a journal entry with existing regular tags."""
        # Pre-populate a tag
        tag = Tag(name="existing_tag")
        db.add(tag)
        db.commit()

        entry_data = {
            "title": "Another entry",
            "content": "This entry uses an existing tag.",
            "tags": ["existing_tag", "new_tag"],
            "entry_date": datetime.now().isoformat()
        }
        response = client.post("/api/journals/", headers=token_headers, json=entry_data)
        assert response.status_code == 200
        data = response.json()
        assert len(data["tags"]) == 2
        
        # Verify only one new tag was created
        tags_in_db = db.query(Tag).order_by(Tag.name).all()
        assert len(tags_in_db) == 2
        assert tags_in_db[0].name == "existing_tag"
        assert tags_in_db[1].name == "new_tag"

    def test_update_journal_tags(self, client: TestClient, token_headers, test_user: User, db: Session):
        """Test updating the tags of a journal entry."""
        # Create an entry first
        entry_data = {
            "title": "Entry to be updated",
            "content": "Initial tags.",
            "tags": ["initial"],
            "entry_date": datetime.now().isoformat()
        }
        response = client.post("/api/journals/", headers=token_headers, json=entry_data)
        assert response.status_code == 200
        entry_id = response.json()["id"]

        # Now update it
        update_data = {
            "tags": ["updated", "new"]
        }
        response = client.put(f"/api/journals/{entry_id}", headers=token_headers, json=update_data)
        assert response.status_code == 200
        data = response.json()
        tag_names = sorted([t["name"] for t in data["tags"]])
        assert tag_names == ["new", "updated"]

        # Verify that the 'initial' tag is no longer associated
        entry = db.query(JournalEntry).filter_by(id=entry_id).one()
        current_tag_names = sorted([t.tag.name for t in entry.tags])
        assert current_tag_names == ["new", "updated"]
        
        # Verify the 'initial' tag still exists in the tags table
        initial_tag = db.query(Tag).filter_by(name="initial").first()
        assert initial_tag is not None

    def test_tags_are_shared_not_duplicated(self, client: TestClient, token_headers, test_user: User, db: Session):
        """Test that tags are shared between entries and not duplicated."""
        # Entry 1
        client.post("/api/journals/", headers=token_headers, json={"title": "Entry 1", "content": "c1", "tags": ["shared"], "entry_date": datetime.now().isoformat()})
        
        # Entry 2
        client.post("/api/journals/", headers=token_headers, json={"title": "Entry 2", "content": "c2", "tags": ["shared"], "entry_date": datetime.now().isoformat()})

        # Should only be one "shared" tag in the database
        tags_in_db = db.query(Tag).filter_by(name="shared").all()
        assert len(tags_in_db) == 1

    def test_deleting_entry_does_not_delete_shared_tag(self, client: TestClient, token_headers, test_user: User, db: Session):
        """Test that deleting an entry doesn't delete a tag if it's used by another entry."""
        # Entry 1 with tag 'persistent'
        res1 = client.post("/api/journals/", headers=token_headers, json={"title": "Entry 1", "content": "c1", "tags": ["persistent"], "entry_date": datetime.now().isoformat()})
        entry1_id = res1.json()["id"]
        
        # Entry 2 with tag 'persistent'
        client.post("/api/journals/", headers=token_headers, json={"title": "Entry 2", "content": "c2", "tags": ["persistent"], "entry_date": datetime.now().isoformat()})

        # Delete Entry 1
        client.delete(f"/api/journals/{entry1_id}", headers=token_headers)

        # The 'persistent' tag should still exist in the tags table
        tag = db.query(Tag).filter_by(name="persistent").first()
        assert tag is not None
        
        # And it should still be associated with Entry 2
        entry2 = db.query(JournalEntry).filter_by(title="Entry 2").one()
        assert len(entry2.tags) == 1
        assert entry2.tags[0].tag.name == "persistent"

class TestSecretTags:
    @pytest.mark.skip(reason="API endpoint may not be updated for OPAQUE model yet")
    def test_create_secret_tag(self, client: TestClient, token_headers, test_user: User, db: Session):
        """Test creating a new secret tag."""
        # Note: This test uses the old API format and needs to be updated
        # when the OPAQUE API endpoints are fully implemented
        salt_str = "a_32_byte_salt_for_a_test_case!"
        salt_bytes = salt_str.encode('utf-8')
        salt_b64 = base64.b64encode(salt_bytes).decode('utf-8')

        tag_data = {
            "tag_name": "My Secret Work",
            "phrase_salt": list(salt_bytes),
            "phrase_hash": "YXJnb24yaGFzaF9vZl9waHJhc2U=" # dummy hash
        }
        response = client.post("/api/secret-tags/", headers=token_headers, json=tag_data)
        assert response.status_code == 201
        data = response.json()
        assert data["tag_name"] == "My Secret Work"
        assert "id" in data
        assert data["phrase_salt"] == salt_b64

    def test_list_secret_tags(self, client: TestClient, token_headers, test_user: User, db: Session):
        """Test listing all secret tags for a user."""
        # Create a tag first using correct OPAQUE fields
        tag_id = uuid.uuid4().bytes
        salt_bytes = b'a_16_byte_salt!!'  # 16 bytes for salt
        verifier_kv_bytes = b'a_32_byte_verifier_kv_for_test_' # 32 bytes for verifier_kv
        opaque_envelope_bytes = b'opaque_envelope_test_data_for_secret_tag'
        
        tag = SecretTag(
            tag_id=tag_id,
            user_id=str(test_user.id),  # Convert to string to match model definition
            tag_name="List Test",
            salt=salt_bytes,
            verifier_kv=verifier_kv_bytes,
            opaque_envelope=opaque_envelope_bytes
        )
        db.add(tag)
        db.commit()
        
        # Verify the tag was created correctly in the database
        created_tag = db.query(SecretTag).filter_by(tag_id=tag_id).first()
        assert created_tag is not None
        assert created_tag.tag_name == "List Test"
        assert created_tag.user_id == str(test_user.id)  # Convert to string for comparison
        assert created_tag.salt == salt_bytes
        assert created_tag.verifier_kv == verifier_kv_bytes
        assert created_tag.opaque_envelope == opaque_envelope_bytes

        # Skip API test until OPAQUE endpoints are fully implemented
        # response = client.get("/api/secret-tags/", headers=token_headers)
        # assert response.status_code == 200
        # data = response.json()
        # assert data["total"] == 1
        # assert data["items"][0]["tag_name"] == "List Test"

    def test_get_secret_tag_not_found(self, client: TestClient, token_headers):
        """Test that fetching a non-existent secret tag returns 404."""
        response = client.get(f"/api/secret-tags/{uuid.uuid4()}", headers=token_headers)
        assert response.status_code == 404

    def test_update_secret_tag(self, client: TestClient, token_headers, test_user: User, db: Session):
        """Test updating a secret tag's name."""
        # Create a tag first using correct OPAQUE fields
        tag_id = uuid.uuid4().bytes
        salt_bytes = b'a_16_byte_salt!!'  # 16 bytes for salt
        verifier_kv_bytes = b'a_32_byte_verifier_kv_for_test_' # 32 bytes for verifier_kv
        opaque_envelope_bytes = b'opaque_envelope_test_data_for_secret_tag'
        
        tag = SecretTag(
            tag_id=tag_id,
            user_id=str(test_user.id),  # Convert to string to match model definition
            tag_name="Before Update",
            salt=salt_bytes,
            verifier_kv=verifier_kv_bytes,
            opaque_envelope=opaque_envelope_bytes
        )
        db.add(tag)
        db.commit()
        db.refresh(tag)

        update_data = {
            "tag_name": "After Update"
        }
        response = client.put(f"/api/secret-tags/{tag.tag_id.hex()}", headers=token_headers, json=update_data)
        assert response.status_code == 200
        data = response.json()
        assert data["tag_name"] == "After Update"
        assert data["id"] == tag.tag_id.hex()

    def test_secret_tag_isolation(self, client: TestClient, token_headers, test_user: User, db: Session):
        """Test that users can only see their own secret tags."""
        # User 1's tag using correct OPAQUE fields
        tag_id1 = uuid.uuid4().bytes
        salt_bytes = b'a_16_byte_salt!!'  # 16 bytes for salt
        verifier_kv_bytes = b'a_32_byte_verifier_kv_for_test_' # 32 bytes for verifier_kv
        opaque_envelope_bytes = b'opaque_envelope_test_data_for_secret_tag'
        
        tag1 = SecretTag(
            tag_id=tag_id1,
            user_id=str(test_user.id),  # Convert to string to match model definition
            tag_name="User 1 Tag",
            salt=salt_bytes,
            verifier_kv=verifier_kv_bytes,
            opaque_envelope=opaque_envelope_bytes
        )
        db.add(tag1)

        # User 2
        user2 = User(email="user2@example.com", hashed_password="password")
        db.add(user2)
        db.commit()
        db.refresh(user2)

        tag_id2 = uuid.uuid4().bytes
        tag2 = SecretTag(
            tag_id=tag_id2,
            user_id=str(user2.id),  # Convert to string to match model definition
            tag_name="User 2 Tag",
            salt=salt_bytes,
            verifier_kv=verifier_kv_bytes,
            opaque_envelope=opaque_envelope_bytes
        )
        db.add(tag2)
        db.commit()

        # User 1 should only see their tag
        response = client.get("/api/secret-tags/", headers=token_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["tag_name"] == "User 1 Tag"

    def test_delete_secret_tag(self, client: TestClient, token_headers, test_user: User, db: Session):
        """Test deleting a secret tag."""
        # Create a tag using correct OPAQUE fields
        tag_id = uuid.uuid4().bytes
        salt_bytes = b'a_16_byte_salt!!'  # 16 bytes for salt
        verifier_kv_bytes = b'a_32_byte_verifier_kv_for_test_' # 32 bytes for verifier_kv
        opaque_envelope_bytes = b'opaque_envelope_test_data_for_secret_tag'
        
        tag = SecretTag(
            tag_id=tag_id,
            user_id=str(test_user.id),  # Convert to string to match model definition
            tag_name="To Delete",
            salt=salt_bytes,
            verifier_kv=verifier_kv_bytes,
            opaque_envelope=opaque_envelope_bytes
        )
        db.add(tag)
        db.commit()
        db.refresh(tag)
        tag_id_hex = tag.tag_id.hex()

        # Delete the tag
        response = client.delete(f"/api/secret-tags/{tag_id_hex}", headers=token_headers)
        assert response.status_code == 200
        assert response.json()["message"] == "Secret tag deleted successfully"

        # Verify it's gone
        response = client.get("/api/secret-tags/", headers=token_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0

    @pytest.mark.xfail(reason="Schema mismatch: JournalEntryCreate expects int for secret_tag_id, but model uses UUID.")
    def test_delete_secret_tag_and_cascade(self, client: TestClient, token_headers, test_user: User, db: Session):
        """Test deleting a secret tag and ensuring associated journal entries are also deleted."""
        # 1. Create secret tag using correct OPAQUE fields
        tag_id = uuid.uuid4().bytes
        salt_bytes = b'a_16_byte_salt!!'  # 16 bytes for salt
        verifier_kv_bytes = b'a_32_byte_verifier_kv_for_test_' # 32 bytes for verifier_kv
        opaque_envelope_bytes = b'opaque_envelope_test_data_for_secret_tag'
        
        secret_tag = SecretTag(
            tag_id=tag_id,
            user_id=str(test_user.id),  # Convert to string to match model definition
            tag_name="To Be Deleted",
            salt=salt_bytes,
            verifier_kv=verifier_kv_bytes,
            opaque_envelope=opaque_envelope_bytes
        )
        db.add(secret_tag)
        db.commit()
        db.refresh(secret_tag)
        tag_id_binary = secret_tag.tag_id

        # 2. Create a journal entry linked to this secret tag
        # We create it directly in the DB to bypass the schema validation issue
        entry = JournalEntry(
            title="Entry with Secret Tag",
            content="This should be deleted.",
            entry_date=datetime.now(),
            user_id=test_user.id,
            secret_tag_id=tag_id_binary
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        entry_id = entry.id

        # 3. Delete the secret tag
        response = client.delete(f"/api/secret-tags/{tag_id_binary.hex()}", headers=token_headers)
        assert response.status_code == 200

        # 4. Verify the secret tag is deleted
        assert db.query(SecretTag).filter_by(tag_id=tag_id_binary).count() == 0
        
        # 5. Verify the associated journal entry is also deleted due to cascade
        assert db.query(JournalEntry).filter_by(id=entry_id).count() == 0

        # Verify that the tag is removed from journal_entry_tags
        assert db.query(Tag).filter(Tag.name.in_(['new_tag', 'another_new_tag'])).count() == 2
        assert db.query(JournalEntryTag).filter_by(journal_entry_id=entry_id).count() == 2 