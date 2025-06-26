from typing import List
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import argon2
import uuid
import base64
import secrets

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.secret_tag_service import secret_tag_service
from app.schemas.secret_tag import (
    SecretTagCreate,
    SecretTagResponse,
    SecretTagListResponse,
    SecretTagUpdate,
    PhraseVerificationRequest,
    PhraseVerificationResponse,
    SecretTagStatsResponse
)

logger = logging.getLogger(__name__)
router = APIRouter()

# Argon2 configuration for phrase hashing
ARGON2_HASHER = argon2.PasswordHasher(
    time_cost=3,        # 3 iterations
    memory_cost=65536,  # 64 MiB
    parallelism=1,      # Single thread
    hash_len=32,        # 32-byte hash
    salt_len=32         # 32-byte salt
)


@router.post("/", response_model=SecretTagResponse, status_code=status.HTTP_201_CREATED)
def create_secret_tag(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tag_data: SecretTagCreate
) -> SecretTagResponse:
    """
    Create a new secret tag with server-side hash verification.
    
    The client must provide:
    - tag_name: Display name for the tag
    - phrase: The raw secret phrase (will be hashed server-side)
    - color_code: Optional color for the tag
    """
    try:
        # Hash the phrase server-side using Argon2
        normalized_phrase = tag_data.phrase.strip().lower()
        phrase_hash = ARGON2_HASHER.hash(normalized_phrase)
        
        # Generate a dummy salt for database compatibility
        # The real salt is embedded in the Argon2 encoded hash
        phrase_salt = secrets.token_bytes(32)
        
        # Create the tag data for storage
        storage_data = SecretTagCreate(
            tag_name=tag_data.tag_name,
            phrase_salt=list(phrase_salt),  # Dummy salt for DB compatibility
            phrase_hash=phrase_hash,        # Store the full encoded hash (contains real salt)
            color_code=tag_data.color_code
        )
        
        secret_tag = secret_tag_service.create_secret_tag(
            db=db,
            tag_data=storage_data,
            user_id=current_user.id
        )
        
        logger.info(f"Created secret tag '{tag_data.tag_name}' for user {current_user.id}")
        return SecretTagResponse.from_orm(secret_tag)
        
    except ValueError as e:
        logger.warning(f"Failed to create secret tag: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Unexpected error creating secret tag: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create secret tag"
        )


@router.get("/", response_model=SecretTagListResponse)
def list_secret_tags(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> SecretTagListResponse:
    """
    Get all secret tags for the current user.
    
    Returns tag metadata including salts for client-side phrase verification,
    but never returns the actual phrase hashes for security.
    """
    try:
        tags = secret_tag_service.get_user_secret_tags(db=db, user_id=current_user.id)
        
        logger.debug(f"Retrieved {len(tags)} secret tags for user {current_user.id}")
        return SecretTagListResponse(
            tags=[SecretTagResponse.from_orm(tag) for tag in tags],
            total=len(tags)
        )
        
    except Exception as e:
        logger.error(f"Error retrieving secret tags for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve secret tags"
        )


@router.get("/{tag_id}", response_model=SecretTagResponse)
def get_secret_tag(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tag_id: uuid.UUID
) -> SecretTagResponse:
    """
    Get a specific secret tag by ID.
    """
    try:
        tag = secret_tag_service.get_secret_tag_by_id(
            db=db,
            tag_id=str(tag_id),
            user_id=current_user.id
        )
        
        if not tag:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Secret tag not found"
            )
            
        return SecretTagResponse.from_orm(tag)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving secret tag {tag_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve secret tag"
        )


@router.post("/verify-phrase", response_model=PhraseVerificationResponse)
def verify_secret_phrase(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    verification_data: PhraseVerificationRequest
) -> PhraseVerificationResponse:
    """
    Verify a secret phrase against a stored hash.
    
    This endpoint allows the client to check if a spoken phrase
    matches any of the user's secret tags without the server
    ever knowing the actual phrases.
    """
    try:
        tag = secret_tag_service.get_secret_tag_by_id(
            db=db,
            tag_id=str(verification_data.tag_id),
            user_id=current_user.id
        )
        
        if not tag:
            # Return false rather than 404 to avoid leaking tag existence
            return PhraseVerificationResponse(
                is_valid=False,
                tag_name=""
            )
        
        # Verify the phrase using Argon2
        try:
            # Use the stored salt and hash to verify the phrase
            stored_hash = tag.phrase_hash
            phrase_to_verify = verification_data.phrase.strip().lower()
            
            # Verify using Argon2
            ARGON2_HASHER.verify(stored_hash, phrase_to_verify)
            
            logger.info(f"Successful phrase verification for tag '{tag.tag_name}' by user {current_user.id}")
            return PhraseVerificationResponse(
                is_valid=True,
                tag_name=tag.tag_name
            )
            
        except argon2.exceptions.VerifyMismatchError:
            logger.debug(f"Failed phrase verification for tag {verification_data.tag_id} by user {current_user.id}")
            return PhraseVerificationResponse(
                is_valid=False,
                tag_name=""
            )
            
    except Exception as e:
        logger.error(f"Error verifying phrase for tag {verification_data.tag_id}: {e}")
        # Return false rather than error to avoid leaking information
        return PhraseVerificationResponse(
            is_valid=False,
            tag_name=""
        )


@router.put("/{tag_id}", response_model=SecretTagResponse)
def update_secret_tag(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tag_id: uuid.UUID,
    tag_update: SecretTagUpdate
) -> SecretTagResponse:
    """
    Update a secret tag (phrase hash/salt only).
    """
    try:
        updated_tag = secret_tag_service.update_secret_tag(
            db=db,
            tag_id=str(tag_id),
            tag_update=tag_update,
            user_id=current_user.id
        )
        
        if not updated_tag:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Secret tag not found"
            )
            
        logger.info(f"Updated secret tag {tag_id} for user {current_user.id}")
        return SecretTagResponse.from_orm(updated_tag)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating secret tag {tag_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update secret tag"
        )


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_secret_tag(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tag_id: uuid.UUID
):
    """
    Delete a secret tag and all associated journal entries.
    
    This is a destructive operation that cannot be undone.
    All encrypted journal entries associated with this tag will be deleted.
    """
    try:
        success = secret_tag_service.delete_secret_tag(
            db=db,
            tag_id=str(tag_id),
            user_id=current_user.id
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Secret tag not found or you do not have permission to delete it"
            )
            
        logger.info(f"Deleted secret tag {tag_id} for user {current_user.id}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting secret tag {tag_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete secret tag"
        )


@router.get("/{tag_id}/stats", response_model=SecretTagStatsResponse)
def get_secret_tag_stats(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tag_id: uuid.UUID
) -> SecretTagStatsResponse:
    """
    Get statistics for a secret tag (entry count, last used, etc.).
    """
    try:
        tag = secret_tag_service.get_secret_tag_by_id(
            db=db,
            tag_id=str(tag_id),
            user_id=current_user.id
        )
        
        if not tag:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Secret tag not found"
            )
        
        # Get entry count and last used date
        entries = secret_tag_service.get_tag_entries(
            db=db,
            tag_id=str(tag_id),
            user_id=current_user.id,
            limit=1  # Just need the most recent
        )
        
        entry_count = len(secret_tag_service.get_tag_entries(
            db=db,
            tag_id=str(tag_id),
            user_id=current_user.id,
            limit=1000  # Get all for count
        ))
        
        last_used = entries[0].entry_date if entries else None
        
        return SecretTagStatsResponse(
            tag_id=tag.id,
            tag_name=tag.tag_name,
            entry_count=entry_count,
            created_at=tag.created_at,
            last_used=last_used
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting stats for secret tag {tag_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get secret tag statistics"
        ) 