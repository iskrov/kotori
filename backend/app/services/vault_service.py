"""
Vault Blob Storage Service

This service provides secure blob storage and retrieval for encrypted vault content.
All content is stored encrypted using AES-GCM with keys derived from OPAQUE authentication.
"""

import uuid
import base64
from datetime import datetime, timedelta, UTC
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc, asc
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from ..models.secret_tag_opaque import VaultBlob, WrappedKey, SecretTag
from ..models.user import User
from ..schemas.vault import (
    VaultBlobUploadRequest,
    VaultBlobUploadResponse,
    VaultBlobDownloadResponse,
    VaultBlobMetadata,
    VaultBlobListRequest,
    VaultBlobListResponse,
    VaultStatsResponse,
    VaultBlobDeleteResponse,
    VaultErrorResponse,
    ContentTypeEnum
)
import logging

logger = logging.getLogger(__name__)


class VaultBlobStorageError(Exception):
    """Base exception for vault blob storage operations"""
    pass


class VaultAccessError(VaultBlobStorageError):
    """Exception for vault access and authorization errors"""
    pass


class VaultQuotaError(VaultBlobStorageError):
    """Exception for vault storage quota exceeded"""
    pass


class VaultService:
    """
    Service for managing encrypted vault blob storage operations.
    
    Provides secure storage, retrieval, and management of encrypted content
    using vault keys obtained through OPAQUE authentication.
    """
    
    # Storage limits
    MAX_BLOB_SIZE = 100 * 1024 * 1024  # 100MB
    MAX_VAULT_SIZE = 1024 * 1024 * 1024  # 1GB per vault
    MAX_BLOBS_PER_VAULT = 10000
    
    def __init__(self, db: Session):
        """Initialize vault service with database session."""
        self.db = db
    
    def verify_vault_access(self, user_id: str, vault_id: str) -> WrappedKey:
        """
        Verify that a user has access to a vault and return the wrapped key.
        
        Args:
            user_id: ID of the user requesting access
            vault_id: ID of the vault being accessed
            
        Returns:
            WrappedKey: The wrapped key for the vault
            
        Raises:
            VaultAccessError: If user doesn't have access to the vault
        """
        try:
            # Find the wrapped key for this user and vault
            wrapped_key = (
                self.db.query(WrappedKey)
                .join(SecretTag)
                .filter(
                    and_(
                        WrappedKey.vault_id == vault_id,
                        SecretTag.user_id == user_id
                    )
                )
                .first()
            )
            
            if not wrapped_key:
                logger.warning(f"Vault access denied: user {user_id} to vault {vault_id}")
                raise VaultAccessError(f"Access denied to vault {vault_id}")
            
            return wrapped_key
            
        except SQLAlchemyError as e:
            logger.error(f"Database error verifying vault access: {e}")
            raise VaultBlobStorageError("Failed to verify vault access")
    
    def check_vault_quota(self, vault_id: str, additional_size: int = 0) -> None:
        """
        Check if vault has space for additional content.
        
        Args:
            vault_id: ID of the vault to check
            additional_size: Size of content to be added
            
        Raises:
            VaultQuotaError: If quota would be exceeded
        """
        try:
            # Get current vault usage
            current_stats = (
                self.db.query(
                    func.count(VaultBlob.object_id).label('blob_count'),
                    func.coalesce(func.sum(VaultBlob.content_size), 0).label('total_size')
                )
                .filter(VaultBlob.vault_id == vault_id)
                .first()
            )
            
            blob_count = current_stats.blob_count or 0
            total_size = current_stats.total_size or 0
            
            # Check blob count limit
            if blob_count >= self.MAX_BLOBS_PER_VAULT:
                raise VaultQuotaError(f"Vault blob limit exceeded ({self.MAX_BLOBS_PER_VAULT})")
            
            # Check size limit
            if total_size + additional_size > self.MAX_VAULT_SIZE:
                raise VaultQuotaError(f"Vault size limit exceeded ({self.MAX_VAULT_SIZE} bytes)")
                
        except SQLAlchemyError as e:
            logger.error(f"Database error checking vault quota: {e}")
            raise VaultBlobStorageError("Failed to check vault quota")
    
    def upload_blob(
        self,
        user_id: str,
        vault_id: str,
        request: VaultBlobUploadRequest
    ) -> VaultBlobUploadResponse:
        """
        Upload an encrypted blob to a vault.
        
        Args:
            user_id: ID of the user uploading the blob
            vault_id: ID of the target vault
            request: Upload request with encrypted content
            
        Returns:
            VaultBlobUploadResponse: Upload confirmation with object details
            
        Raises:
            VaultAccessError: If user doesn't have access to vault
            VaultQuotaError: If vault quota would be exceeded
            VaultBlobStorageError: For other storage errors
        """
        try:
            # Verify vault access
            wrapped_key = self.verify_vault_access(user_id, vault_id)
            
            # Decode and validate encrypted content
            try:
                ciphertext_bytes = base64.b64decode(request.ciphertext)
                iv_bytes = base64.b64decode(request.iv)
                auth_tag_bytes = base64.b64decode(request.auth_tag)
            except Exception as e:
                raise VaultBlobStorageError(f"Invalid base64 encoding: {e}")
            
            # Check vault quota
            encrypted_size = len(ciphertext_bytes)
            self.check_vault_quota(vault_id, request.content_size)
            
            # Generate object ID if not provided
            object_id = request.object_id or str(uuid.uuid4())
            
            # Check if object ID already exists
            existing_blob = (
                self.db.query(VaultBlob)
                .filter(
                    and_(
                        VaultBlob.vault_id == vault_id,
                        VaultBlob.object_id == object_id
                    )
                )
                .first()
            )
            
            if existing_blob:
                raise VaultBlobStorageError(f"Object ID {object_id} already exists in vault")
            
            # Create vault blob record
            vault_blob = VaultBlob(
                vault_id=vault_id,
                object_id=object_id,
                wrapped_key_id=wrapped_key.id,
                iv=iv_bytes,
                ciphertext=ciphertext_bytes,
                auth_tag=auth_tag_bytes,
                content_type=request.content_type,
                content_size=request.content_size
            )
            
            self.db.add(vault_blob)
            self.db.commit()
            
            logger.info(f"Blob uploaded: vault {vault_id}, object {object_id}, size {encrypted_size}")
            
            return VaultBlobUploadResponse(
                object_id=object_id,
                vault_id=vault_id,
                content_size=encrypted_size,
                content_type=request.content_type,
                created_at=vault_blob.created_at
            )
            
        except (VaultAccessError, VaultQuotaError, VaultBlobStorageError):
            self.db.rollback()
            raise
        except Exception as e:
            self.db.rollback()
            logger.error(f"Unexpected error uploading blob: {e}")
            raise VaultBlobStorageError("Failed to upload blob")
    
    def download_blob(
        self,
        user_id: str,
        vault_id: str,
        object_id: str
    ) -> VaultBlobDownloadResponse:
        """
        Download an encrypted blob from a vault.
        
        Args:
            user_id: ID of the user downloading the blob
            vault_id: ID of the vault containing the blob
            object_id: ID of the blob object
            
        Returns:
            VaultBlobDownloadResponse: Encrypted blob content and metadata
            
        Raises:
            VaultAccessError: If user doesn't have access to vault
            VaultBlobStorageError: If blob not found or other errors
        """
        try:
            # Verify vault access
            self.verify_vault_access(user_id, vault_id)
            
            # Find the blob
            vault_blob = (
                self.db.query(VaultBlob)
                .filter(
                    and_(
                        VaultBlob.vault_id == vault_id,
                        VaultBlob.object_id == object_id
                    )
                )
                .first()
            )
            
            if not vault_blob:
                raise VaultBlobStorageError(f"Blob {object_id} not found in vault {vault_id}")
            
            # Encode binary data as base64
            ciphertext_b64 = base64.b64encode(vault_blob.ciphertext).decode('utf-8')
            iv_b64 = base64.b64encode(vault_blob.iv).decode('utf-8')
            auth_tag_b64 = base64.b64encode(vault_blob.auth_tag).decode('utf-8')
            
            logger.info(f"Blob downloaded: vault {vault_id}, object {object_id}")
            
            return VaultBlobDownloadResponse(
                object_id=object_id,
                ciphertext=ciphertext_b64,
                iv=iv_b64,
                auth_tag=auth_tag_b64,
                content_type=vault_blob.content_type,
                content_size=vault_blob.content_size,
                created_at=vault_blob.created_at,
                updated_at=vault_blob.updated_at
            )
            
        except VaultAccessError:
            raise
        except Exception as e:
            logger.error(f"Error downloading blob: {e}")
            raise VaultBlobStorageError("Failed to download blob")
    
    def list_blobs(
        self,
        user_id: str,
        vault_id: str,
        request: VaultBlobListRequest
    ) -> VaultBlobListResponse:
        """
        List blobs in a vault with filtering and pagination.
        
        Args:
            user_id: ID of the user requesting the list
            vault_id: ID of the vault to list
            request: List request with filtering and pagination options
            
        Returns:
            VaultBlobListResponse: Paginated list of blob metadata
            
        Raises:
            VaultAccessError: If user doesn't have access to vault
        """
        try:
            # Verify vault access
            self.verify_vault_access(user_id, vault_id)
            
            # Build base query
            query = self.db.query(VaultBlob).filter(VaultBlob.vault_id == vault_id)
            
            # Apply filters
            if request.content_type_filter:
                if request.content_type_filter.endswith('*'):
                    # Wildcard filter (e.g., 'text/*')
                    prefix = request.content_type_filter[:-1]
                    query = query.filter(VaultBlob.content_type.like(f"{prefix}%"))
                else:
                    # Exact match
                    query = query.filter(VaultBlob.content_type == request.content_type_filter)
            
            if request.created_after:
                query = query.filter(VaultBlob.created_at >= request.created_after)
            
            if request.created_before:
                query = query.filter(VaultBlob.created_at <= request.created_before)
            
            # Get total counts
            total_count = self.db.query(VaultBlob).filter(VaultBlob.vault_id == vault_id).count()
            filtered_count = query.count()
            
            # Apply ordering
            order_column = getattr(VaultBlob, request.order_by)
            if request.order_direction == 'desc':
                query = query.order_by(desc(order_column))
            else:
                query = query.order_by(asc(order_column))
            
            # Apply pagination
            query = query.offset(request.offset).limit(request.limit)
            
            # Execute query
            blobs = query.all()
            
            # Convert to metadata objects
            blob_metadata = []
            for blob in blobs:
                metadata = VaultBlobMetadata(
                    object_id=blob.object_id,
                    content_type=blob.content_type,
                    content_size=blob.content_size,
                    encrypted_size=len(blob.ciphertext),
                    created_at=blob.created_at,
                    updated_at=blob.updated_at
                )
                blob_metadata.append(metadata)
            
            # Calculate pagination info
            has_more = (request.offset + len(blobs)) < filtered_count
            next_offset = request.offset + request.limit if has_more else None
            
            logger.info(f"Listed {len(blobs)} blobs from vault {vault_id}")
            
            return VaultBlobListResponse(
                blobs=blob_metadata,
                total_count=total_count,
                filtered_count=filtered_count,
                has_more=has_more,
                next_offset=next_offset
            )
            
        except VaultAccessError:
            raise
        except Exception as e:
            logger.error(f"Error listing blobs: {e}")
            raise VaultBlobStorageError("Failed to list blobs")
    
    def delete_blob(
        self,
        user_id: str,
        vault_id: str,
        object_id: str
    ) -> VaultBlobDeleteResponse:
        """
        Delete a blob from a vault.
        
        Args:
            user_id: ID of the user deleting the blob
            vault_id: ID of the vault containing the blob
            object_id: ID of the blob to delete
            
        Returns:
            VaultBlobDeleteResponse: Deletion confirmation
            
        Raises:
            VaultAccessError: If user doesn't have access to vault
            VaultBlobStorageError: If blob not found or deletion fails
        """
        try:
            # Verify vault access
            self.verify_vault_access(user_id, vault_id)
            
            # Find and delete the blob
            vault_blob = (
                self.db.query(VaultBlob)
                .filter(
                    and_(
                        VaultBlob.vault_id == vault_id,
                        VaultBlob.object_id == object_id
                    )
                )
                .first()
            )
            
            if not vault_blob:
                raise VaultBlobStorageError(f"Blob {object_id} not found in vault {vault_id}")
            
            self.db.delete(vault_blob)
            self.db.commit()
            
            logger.info(f"Blob deleted: vault {vault_id}, object {object_id}")
            
            return VaultBlobDeleteResponse(
                object_id=object_id,
                vault_id=vault_id,
                deleted_at=datetime.now(UTC)
            )
            
        except VaultAccessError:
            raise
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error deleting blob: {e}")
            raise VaultBlobStorageError("Failed to delete blob")
    
    def get_vault_stats(
        self,
        user_id: str,
        vault_id: str
    ) -> VaultStatsResponse:
        """
        Get comprehensive statistics for a vault.
        
        Args:
            user_id: ID of the user requesting stats
            vault_id: ID of the vault
            
        Returns:
            VaultStatsResponse: Vault usage statistics
            
        Raises:
            VaultAccessError: If user doesn't have access to vault
        """
        try:
            # Verify vault access
            self.verify_vault_access(user_id, vault_id)
            
            # Get basic stats
            basic_stats = (
                self.db.query(
                    func.count(VaultBlob.object_id).label('total_blobs'),
                    func.coalesce(func.sum(func.length(VaultBlob.ciphertext)), 0).label('total_size'),
                    func.coalesce(func.sum(VaultBlob.content_size), 0).label('total_original_size'),
                    func.min(VaultBlob.created_at).label('oldest_blob'),
                    func.max(VaultBlob.created_at).label('newest_blob'),
                    func.max(VaultBlob.updated_at).label('last_activity')
                )
                .filter(VaultBlob.vault_id == vault_id)
                .first()
            )
            
            # Get content type breakdown
            content_type_stats = (
                self.db.query(
                    VaultBlob.content_type,
                    func.count(VaultBlob.object_id).label('count'),
                    func.coalesce(func.sum(VaultBlob.content_size), 0).label('size')
                )
                .filter(VaultBlob.vault_id == vault_id)
                .group_by(VaultBlob.content_type)
                .all()
            )
            
            # Build breakdown dictionaries
            content_type_breakdown = {}
            size_breakdown = {}
            
            for stat in content_type_stats:
                content_type_breakdown[stat.content_type] = stat.count
                size_breakdown[stat.content_type] = stat.size
            
            logger.info(f"Generated stats for vault {vault_id}")
            
            return VaultStatsResponse(
                vault_id=vault_id,
                total_blobs=basic_stats.total_blobs or 0,
                total_size=basic_stats.total_size or 0,
                total_original_size=basic_stats.total_original_size or 0,
                content_type_breakdown=content_type_breakdown,
                size_breakdown=size_breakdown,
                oldest_blob=basic_stats.oldest_blob,
                newest_blob=basic_stats.newest_blob,
                last_activity=basic_stats.last_activity
            )
            
        except VaultAccessError:
            raise
        except Exception as e:
            logger.error(f"Error getting vault stats: {e}")
            raise VaultBlobStorageError("Failed to get vault statistics")
    
    def cleanup_orphaned_blobs(self) -> int:
        """
        Clean up orphaned blobs that have no valid wrapped key.
        
        Returns:
            int: Number of blobs cleaned up
        """
        try:
            # Find blobs with invalid wrapped key references
            orphaned_blobs = (
                self.db.query(VaultBlob)
                .outerjoin(WrappedKey, VaultBlob.wrapped_key_id == WrappedKey.id)
                .filter(WrappedKey.id.is_(None))
                .all()
            )
            
            count = len(orphaned_blobs)
            
            if count > 0:
                for blob in orphaned_blobs:
                    self.db.delete(blob)
                
                self.db.commit()
                logger.info(f"Cleaned up {count} orphaned vault blobs")
            
            return count
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error cleaning up orphaned blobs: {e}")
            raise VaultBlobStorageError("Failed to cleanup orphaned blobs") 