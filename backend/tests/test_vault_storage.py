"""
Tests for Vault Blob Storage Service and API Endpoints

This test suite covers the vault blob storage functionality including:
- Vault access control and authentication
- Blob upload, download, listing, and deletion
- Vault statistics and quota management
- Error handling and security features
"""

import uuid
import base64
import pytest
from datetime import datetime, timedelta, UTC
from unittest.mock import Mock, patch
from sqlalchemy.orm import Session

from app.services.vault_service import (
    VaultService,
    VaultBlobStorageError,
    VaultAccessError,
    VaultQuotaError
)
from app.schemas.vault import (
    VaultBlobUploadRequest,
    VaultBlobUploadResponse,
    VaultBlobDownloadResponse,
    VaultBlobListRequest,
    VaultBlobListResponse,
    VaultStatsResponse,
    VaultBlobDeleteResponse,
    ContentTypeEnum
)
from app.models.secret_tag_opaque import VaultBlob, WrappedKey, SecretTag
from app.models.user import User


class TestVaultBlobSchemas:
    """Test vault blob storage schemas validation."""
    
    def test_upload_request_valid(self):
        """Test valid upload request creation."""
        # Valid base64 data
        ciphertext = base64.b64encode(b"encrypted content").decode()
        iv = base64.b64encode(b"123456789012").decode()  # 12 bytes
        auth_tag = base64.b64encode(b"1234567890123456").decode()  # 16 bytes
        
        request = VaultBlobUploadRequest(
            ciphertext=ciphertext,
            iv=iv,
            auth_tag=auth_tag,
            content_type="text/plain",
            content_size=1024
        )
        
        assert request.ciphertext == ciphertext
        assert request.iv == iv
        assert request.auth_tag == auth_tag
        assert request.content_type == "text/plain"
        assert request.content_size == 1024
    
    def test_upload_request_invalid_base64(self):
        """Test upload request with invalid base64."""
        with pytest.raises(ValueError, match="Invalid base64 encoding"):
            VaultBlobUploadRequest(
                ciphertext="invalid-base64!",
                iv=base64.b64encode(b"123456789012").decode(),
                auth_tag=base64.b64encode(b"1234567890123456").decode(),
                content_type="text/plain",
                content_size=1024
            )
    
    def test_upload_request_invalid_iv_length(self):
        """Test upload request with invalid IV length."""
        with pytest.raises(ValueError, match="IV must be exactly 12 bytes"):
            VaultBlobUploadRequest(
                ciphertext=base64.b64encode(b"encrypted content").decode(),
                iv=base64.b64encode(b"short").decode(),  # Too short
                auth_tag=base64.b64encode(b"1234567890123456").decode(),
                content_type="text/plain",
                content_size=1024
            )
    
    def test_upload_request_invalid_auth_tag_length(self):
        """Test upload request with invalid auth tag length."""
        with pytest.raises(ValueError, match="Auth tag must be exactly 16 bytes"):
            VaultBlobUploadRequest(
                ciphertext=base64.b64encode(b"encrypted content").decode(),
                iv=base64.b64encode(b"123456789012").decode(),
                auth_tag=base64.b64encode(b"short").decode(),  # Too short
                content_type="text/plain",
                content_size=1024
            )
    
    def test_list_request_valid(self):
        """Test valid list request creation."""
        request = VaultBlobListRequest(
            limit=100,
            offset=50,
            content_type_filter="text/*",
            order_by="created_at",
            order_direction="desc"
        )
        
        assert request.limit == 100
        assert request.offset == 50
        assert request.content_type_filter == "text/*"
        assert request.order_by == "created_at"
        assert request.order_direction == "desc"
    
    def test_list_request_invalid_order_by(self):
        """Test list request with invalid order_by field."""
        with pytest.raises(ValueError, match="order_by must be one of"):
            VaultBlobListRequest(order_by="invalid_field")
    
    def test_list_request_invalid_order_direction(self):
        """Test list request with invalid order direction."""
        with pytest.raises(ValueError, match="order_direction must be"):
            VaultBlobListRequest(order_direction="invalid")


class TestVaultService:
    """Test vault service business logic."""
    
    @pytest.fixture
    def mock_db(self):
        """Mock database session."""
        return Mock(spec=Session)
    
    @pytest.fixture
    def vault_service(self, mock_db):
        """Create vault service instance."""
        return VaultService(mock_db)
    
    @pytest.fixture
    def sample_user(self):
        """Create sample user."""
        return User(id=str(uuid.uuid4()), email="test@example.com")
    
    @pytest.fixture
    def sample_vault_id(self):
        """Create sample vault ID."""
        return str(uuid.uuid4())
    
    @pytest.fixture
    def sample_wrapped_key(self, sample_vault_id):
        """Create sample wrapped key."""
        return WrappedKey(
            id=str(uuid.uuid4()),
            phrase_hash=b"1234567890123456",
            vault_id=sample_vault_id,
            wrapped_key=b"wrapped_key_data_here_32_bytes_long",
            key_purpose="vault_data"
        )
    
    @pytest.fixture
    def sample_upload_request(self):
        """Create sample upload request."""
        return VaultBlobUploadRequest(
            ciphertext=base64.b64encode(b"encrypted content").decode(),
            iv=base64.b64encode(b"123456789012").decode(),
            auth_tag=base64.b64encode(b"1234567890123456").decode(),
            content_type="text/plain",
            content_size=16
        )
    
    def test_service_creation(self, vault_service):
        """Test vault service can be created."""
        assert vault_service is not None
        assert hasattr(vault_service, 'db')
        assert hasattr(vault_service, 'verify_vault_access')
        assert hasattr(vault_service, 'upload_blob')
        assert hasattr(vault_service, 'download_blob')
        assert hasattr(vault_service, 'list_blobs')
        assert hasattr(vault_service, 'delete_blob')
        assert hasattr(vault_service, 'get_vault_stats')
    
    def test_verify_vault_access_success(self, vault_service, sample_user, sample_vault_id, sample_wrapped_key):
        """Test successful vault access verification."""
        # Mock database query
        vault_service.db.query.return_value.join.return_value.filter.return_value.first.return_value = sample_wrapped_key
        
        result = vault_service.verify_vault_access(sample_user.id, sample_vault_id)
        
        assert result == sample_wrapped_key
        vault_service.db.query.assert_called_once()
    
    def test_verify_vault_access_denied(self, vault_service, sample_user, sample_vault_id):
        """Test vault access denied."""
        # Mock database query returning None (no access)
        vault_service.db.query.return_value.join.return_value.filter.return_value.first.return_value = None
        
        with pytest.raises(VaultAccessError, match="Access denied to vault"):
            vault_service.verify_vault_access(sample_user.id, sample_vault_id)
    
    def test_check_vault_quota_within_limits(self, vault_service, sample_vault_id):
        """Test quota check when within limits."""
        # Mock current usage stats
        mock_stats = Mock()
        mock_stats.blob_count = 100
        mock_stats.total_size = 1024 * 1024  # 1MB
        
        vault_service.db.query.return_value.filter.return_value.first.return_value = mock_stats
        
        # Should not raise exception
        vault_service.check_vault_quota(sample_vault_id, 1024)
    
    def test_check_vault_quota_blob_limit_exceeded(self, vault_service, sample_vault_id):
        """Test quota check when blob limit exceeded."""
        # Mock current usage stats at limit
        mock_stats = Mock()
        mock_stats.blob_count = vault_service.MAX_BLOBS_PER_VAULT
        mock_stats.total_size = 0
        
        vault_service.db.query.return_value.filter.return_value.first.return_value = mock_stats
        
        with pytest.raises(VaultQuotaError, match="Vault blob limit exceeded"):
            vault_service.check_vault_quota(sample_vault_id, 1024)
    
    def test_check_vault_quota_size_limit_exceeded(self, vault_service, sample_vault_id):
        """Test quota check when size limit exceeded."""
        # Mock current usage stats at size limit
        mock_stats = Mock()
        mock_stats.blob_count = 0
        mock_stats.total_size = vault_service.MAX_VAULT_SIZE - 100
        
        vault_service.db.query.return_value.filter.return_value.first.return_value = mock_stats
        
        with pytest.raises(VaultQuotaError, match="Vault size limit exceeded"):
            vault_service.check_vault_quota(sample_vault_id, 1024)  # Would exceed limit
    
    def test_upload_blob_success(self, vault_service, sample_user, sample_vault_id, sample_wrapped_key, sample_upload_request):
        """Test successful blob upload."""
        # Mock vault access verification
        vault_service.db.query.return_value.join.return_value.filter.return_value.first.return_value = sample_wrapped_key
        
        # Mock quota check (empty vault)
        mock_stats = Mock()
        mock_stats.blob_count = 0
        mock_stats.total_size = 0
        vault_service.db.query.return_value.filter.return_value.first.return_value = mock_stats
        
        # Mock existing blob check (none exists)
        vault_service.db.query.return_value.filter.return_value.first.return_value = None
        
        # Mock successful commit
        vault_service.db.add = Mock()
        vault_service.db.commit = Mock()
        
        with patch('uuid.uuid4', return_value=Mock(spec=str)) as mock_uuid:
            mock_uuid.return_value = "test-object-id"
            
            response = vault_service.upload_blob(
                user_id=sample_user.id,
                vault_id=sample_vault_id,
                request=sample_upload_request
            )
        
        assert isinstance(response, VaultBlobUploadResponse)
        assert response.vault_id == sample_vault_id
        assert response.content_type == "text/plain"
        vault_service.db.add.assert_called_once()
        vault_service.db.commit.assert_called_once()
    
    def test_upload_blob_access_denied(self, vault_service, sample_user, sample_vault_id, sample_upload_request):
        """Test blob upload with access denied."""
        # Mock vault access verification failure
        vault_service.db.query.return_value.join.return_value.filter.return_value.first.return_value = None
        
        with pytest.raises(VaultAccessError):
            vault_service.upload_blob(
                user_id=sample_user.id,
                vault_id=sample_vault_id,
                request=sample_upload_request
            )
    
    def test_download_blob_success(self, vault_service, sample_user, sample_vault_id, sample_wrapped_key):
        """Test successful blob download."""
        object_id = "test-object-id"
        
        # Mock vault access verification
        vault_service.db.query.return_value.join.return_value.filter.return_value.first.return_value = sample_wrapped_key
        
        # Mock blob retrieval
        mock_blob = Mock(spec=VaultBlob)
        mock_blob.object_id = object_id
        mock_blob.ciphertext = b"encrypted content"
        mock_blob.iv = b"123456789012"
        mock_blob.auth_tag = b"1234567890123456"
        mock_blob.content_type = "text/plain"
        mock_blob.content_size = 16
        mock_blob.created_at = datetime.now(UTC)
        mock_blob.updated_at = datetime.now(UTC)
        
        vault_service.db.query.return_value.filter.return_value.first.return_value = mock_blob
        
        response = vault_service.download_blob(
            user_id=sample_user.id,
            vault_id=sample_vault_id,
            object_id=object_id
        )
        
        assert isinstance(response, VaultBlobDownloadResponse)
        assert response.object_id == object_id
        assert response.content_type == "text/plain"
        assert response.content_size == 16
        # Verify base64 encoding
        assert base64.b64decode(response.ciphertext) == b"encrypted content"
        assert base64.b64decode(response.iv) == b"123456789012"
        assert base64.b64decode(response.auth_tag) == b"1234567890123456"
    
    def test_download_blob_not_found(self, vault_service, sample_user, sample_vault_id, sample_wrapped_key):
        """Test blob download when blob not found."""
        object_id = "nonexistent-object-id"
        
        # Mock vault access verification
        vault_service.db.query.return_value.join.return_value.filter.return_value.first.return_value = sample_wrapped_key
        
        # Mock blob not found
        vault_service.db.query.return_value.filter.return_value.first.return_value = None
        
        with pytest.raises(VaultBlobStorageError, match="not found"):
            vault_service.download_blob(
                user_id=sample_user.id,
                vault_id=sample_vault_id,
                object_id=object_id
            )
    
    def test_list_blobs_success(self, vault_service, sample_user, sample_vault_id, sample_wrapped_key):
        """Test successful blob listing."""
        # Mock vault access verification
        vault_service.db.query.return_value.join.return_value.filter.return_value.first.return_value = sample_wrapped_key
        
        # Mock blob listing
        mock_blob1 = Mock(spec=VaultBlob)
        mock_blob1.object_id = "blob-1"
        mock_blob1.content_type = "text/plain"
        mock_blob1.content_size = 100
        mock_blob1.ciphertext = b"encrypted_content_1"
        mock_blob1.created_at = datetime.now(UTC)
        mock_blob1.updated_at = datetime.now(UTC)
        
        mock_blob2 = Mock(spec=VaultBlob)
        mock_blob2.object_id = "blob-2"
        mock_blob2.content_type = "application/json"
        mock_blob2.content_size = 200
        mock_blob2.ciphertext = b"encrypted_content_2"
        mock_blob2.created_at = datetime.now(UTC)
        mock_blob2.updated_at = datetime.now(UTC)
        
        # Mock query chain
        mock_query = Mock()
        mock_query.filter.return_value = mock_query
        mock_query.count.return_value = 2
        mock_query.order_by.return_value = mock_query
        mock_query.offset.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.all.return_value = [mock_blob1, mock_blob2]
        
        vault_service.db.query.return_value = mock_query
        
        list_request = VaultBlobListRequest(limit=10, offset=0)
        response = vault_service.list_blobs(
            user_id=sample_user.id,
            vault_id=sample_vault_id,
            request=list_request
        )
        
        assert isinstance(response, VaultBlobListResponse)
        assert len(response.blobs) == 2
        assert response.total_count == 2
        assert response.filtered_count == 2
        assert not response.has_more
        assert response.next_offset is None
    
    def test_delete_blob_success(self, vault_service, sample_user, sample_vault_id, sample_wrapped_key):
        """Test successful blob deletion."""
        object_id = "test-object-id"
        
        # Mock vault access verification
        vault_service.db.query.return_value.join.return_value.filter.return_value.first.return_value = sample_wrapped_key
        
        # Mock blob retrieval for deletion
        mock_blob = Mock(spec=VaultBlob)
        mock_blob.object_id = object_id
        vault_service.db.query.return_value.filter.return_value.first.return_value = mock_blob
        
        # Mock deletion
        vault_service.db.delete = Mock()
        vault_service.db.commit = Mock()
        
        response = vault_service.delete_blob(
            user_id=sample_user.id,
            vault_id=sample_vault_id,
            object_id=object_id
        )
        
        assert isinstance(response, VaultBlobDeleteResponse)
        assert response.object_id == object_id
        assert response.vault_id == sample_vault_id
        vault_service.db.delete.assert_called_once_with(mock_blob)
        vault_service.db.commit.assert_called_once()
    
    def test_get_vault_stats_success(self, vault_service, sample_user, sample_vault_id, sample_wrapped_key):
        """Test successful vault statistics retrieval."""
        # Mock vault access verification
        vault_service.db.query.return_value.join.return_value.filter.return_value.first.return_value = sample_wrapped_key
        
        # Mock basic stats
        mock_basic_stats = Mock()
        mock_basic_stats.total_blobs = 5
        mock_basic_stats.total_size = 1024
        mock_basic_stats.total_original_size = 800
        mock_basic_stats.oldest_blob = datetime.now(UTC) - timedelta(days=7)
        mock_basic_stats.newest_blob = datetime.now(UTC)
        mock_basic_stats.last_activity = datetime.now(UTC)
        
        # Mock content type stats
        mock_content_stats = [
            Mock(content_type="text/plain", count=3, size=600),
            Mock(content_type="application/json", count=2, size=200)
        ]
        
        vault_service.db.query.return_value.filter.return_value.first.return_value = mock_basic_stats
        vault_service.db.query.return_value.filter.return_value.group_by.return_value.all.return_value = mock_content_stats
        
        response = vault_service.get_vault_stats(
            user_id=sample_user.id,
            vault_id=sample_vault_id
        )
        
        assert isinstance(response, VaultStatsResponse)
        assert response.vault_id == sample_vault_id
        assert response.total_blobs == 5
        assert response.total_size == 1024
        assert response.total_original_size == 800
        assert response.content_type_breakdown == {"text/plain": 3, "application/json": 2}
        assert response.size_breakdown == {"text/plain": 600, "application/json": 200}


class TestVaultAPIEndpoints:
    """Test vault API endpoints integration."""
    
    def test_health_endpoint_accessible(self):
        """Test that health endpoint can be accessed."""
        # This is a basic test to ensure the endpoint structure is correct
        from app.api.v1.endpoints.vault import health_check
        
        # Test that the function exists and is callable
        assert callable(health_check)
    
    def test_upload_endpoint_exists(self):
        """Test that upload endpoint function exists."""
        from app.api.v1.endpoints.vault import upload_blob
        
        assert callable(upload_blob)
    
    def test_download_endpoint_exists(self):
        """Test that download endpoint function exists."""
        from app.api.v1.endpoints.vault import download_blob
        
        assert callable(download_blob)
    
    def test_list_endpoint_exists(self):
        """Test that list endpoint function exists."""
        from app.api.v1.endpoints.vault import list_blobs
        
        assert callable(list_blobs)
    
    def test_delete_endpoint_exists(self):
        """Test that delete endpoint function exists."""
        from app.api.v1.endpoints.vault import delete_blob
        
        assert callable(delete_blob)
    
    def test_stats_endpoint_exists(self):
        """Test that stats endpoint function exists."""
        from app.api.v1.endpoints.vault import get_vault_stats
        
        assert callable(get_vault_stats)


class TestVaultSecurityProperties:
    """Test security properties of vault storage."""
    
    def test_timing_protection_function_exists(self):
        """Test that timing protection function exists."""
        from app.api.v1.endpoints.vault import _ensure_constant_timing
        
        assert callable(_ensure_constant_timing)
    
    def test_constant_timing_minimum(self):
        """Test that timing protection enforces minimum time."""
        from app.api.v1.endpoints.vault import _ensure_constant_timing, MIN_RESPONSE_TIME_MS
        import time
        
        start_time = time.time()
        _ensure_constant_timing(start_time)
        elapsed_ms = (time.time() - start_time) * 1000
        
        # Should take at least the minimum response time
        assert elapsed_ms >= MIN_RESPONSE_TIME_MS - 1  # Allow 1ms tolerance
    
    def test_vault_service_constants_defined(self):
        """Test that security constants are properly defined."""
        assert hasattr(VaultService, 'MAX_BLOB_SIZE')
        assert hasattr(VaultService, 'MAX_VAULT_SIZE')
        assert hasattr(VaultService, 'MAX_BLOBS_PER_VAULT')
        
        # Verify reasonable limits
        assert VaultService.MAX_BLOB_SIZE == 100 * 1024 * 1024  # 100MB
        assert VaultService.MAX_VAULT_SIZE == 1024 * 1024 * 1024  # 1GB
        assert VaultService.MAX_BLOBS_PER_VAULT == 10000


class TestVaultErrorHandling:
    """Test error handling in vault operations."""
    
    def test_vault_access_error_inheritance(self):
        """Test that VaultAccessError inherits properly."""
        error = VaultAccessError("Test error")
        assert isinstance(error, VaultBlobStorageError)
        assert isinstance(error, Exception)
    
    def test_vault_quota_error_inheritance(self):
        """Test that VaultQuotaError inherits properly."""
        error = VaultQuotaError("Test error")
        assert isinstance(error, VaultBlobStorageError)
        assert isinstance(error, Exception)
    
    def test_vault_blob_storage_error_inheritance(self):
        """Test that VaultBlobStorageError inherits properly."""
        error = VaultBlobStorageError("Test error")
        assert isinstance(error, Exception) 