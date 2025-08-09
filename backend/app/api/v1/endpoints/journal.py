from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from typing import List, Optional, Union
from uuid import UUID
import logging

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.journal import (
    JournalEntry,
    JournalEntryCreate,
    JournalEntryUpdate,
    HiddenJournalEntry,
    JournalEntryBulkResponse,
    JournalEntrySearchResponse,
    SecretPhraseAuthResponse,
    JournalEntryCreateResponse,
    JournalEntryDeleteResponse,
    JournalEntryCountResponse
)
from app.services.journal_service import journal_service
from app.core.config import settings
from app.services.entry_processor import EntryProcessingError

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/", response_model=JournalEntry)
async def create_journal_entry(
    entry: JournalEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new journal entry (regular or hidden with client-side encryption).
    
    For hidden entries:
    - Set is_hidden=True
    - Provide encrypted_content, encryption_iv, and encryption_salt
    - Leave content field empty (content should be encrypted client-side)
    """
    try:
        # Validate encrypted vs plaintext payload
        if entry.encrypted_content:
            if not entry.encryption_iv:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Encrypted entries must include encryption_iv"
                )
            # Ensure server never stores plaintext when encrypted payload provided
            entry.content = ""
        else:
            # For plaintext entries ensure content present
            if not entry.content:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Entry must include content or encrypted_content"
                )
        
        db_entry = journal_service.create_with_user(
            db=db, 
            obj_in=entry, 
            user_id=current_user.id
        )
        
        logger.info(f"Created journal entry for user {current_user.id}")
        return db_entry
        
    except Exception as e:
        logger.error(f"Failed to create journal entry: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create journal entry"
        )


@router.post("/with-phrase-detection", response_model=JournalEntryCreateResponse)
async def create_journal_entry_with_phrase_detection(
    entry: JournalEntryCreate,
    request: Request,
    detect_phrases: bool = Query(True, description="Enable secret phrase detection"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new journal entry with optional secret phrase detection.
    
    This endpoint provides:
    - Real-time secret phrase detection during entry creation
    - Automatic OPAQUE authentication for detected phrases
    - Encrypted storage for entries with authenticated secret phrases
    - Regular storage for entries without secret phrases
    
    Args:
        entry: Journal entry creation request
        detect_phrases: Whether to enable phrase detection (default: True)
        
    Returns:
        Either a regular JournalEntry or SecretPhraseAuthResponse with encrypted entries
    """
    try:
        # If secret tags are disabled globally, bypass phrase detection regardless of query param
        if not settings.ENABLE_SECRET_TAGS:
            detect_phrases = False
        # Get client IP address for rate limiting
        client_ip = getattr(request.client, 'host', None) if request.client else None
        
        # Create entry with phrase detection
        result = await journal_service.create_with_phrase_detection(
            db=db,
            obj_in=entry,
            user_id=current_user.id,
            detect_phrases=detect_phrases,
            ip_address=client_ip,
            session_id=None  # Could be extracted from request headers if needed
        )
        
        logger.info(f"Entry created with phrase detection for user {current_user.id}")
        return result
        
    except EntryProcessingError as e:
        logger.error(f"Entry processing failed for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Entry processing failed: {e.message}"
        )
    except ValueError as e:
        logger.error(f"Invalid entry data: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Unexpected error creating entry: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create journal entry"
        )


@router.get("/", response_model=JournalEntryBulkResponse)
async def get_journal_entries(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    include_hidden: bool = Query(False, description="Include hidden entries (encrypted content)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get journal entries for the current user.
    
    Args:
        skip: Number of entries to skip (pagination)
        limit: Maximum number of entries to return
        include_hidden: Whether to include hidden entries (content will be encrypted)
    """
    try:
        entries = journal_service.get_journal_entries(
            db=db,
            user_id=current_user.id,
            skip=skip,
            limit=limit,
            include_hidden=include_hidden
        )
        
        total_count = journal_service.get_entry_count(
            db=db,
            user_id=current_user.id,
            include_hidden=include_hidden
        )
        
        has_more = (skip + len(entries)) < total_count
        
        logger.info(f"Retrieved {len(entries)} entries for user {current_user.id} (include_hidden: {include_hidden})")
        
        return JournalEntryBulkResponse(
            entries=entries,
            total_count=total_count,
            has_more=has_more
        )
        
    except Exception as e:
        logger.error(f"Failed to retrieve journal entries: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve journal entries"
        )


@router.get("/hidden", response_model=List[HiddenJournalEntry])
async def get_hidden_entries(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get only hidden entries for the current user.
    
    Returns encrypted content that requires client-side decryption.
    """
    try:
        entries = journal_service.get_hidden_entries_only(
            db=db,
            user_id=current_user.id,
            skip=skip,
            limit=limit
        )
        
        logger.info(f"Retrieved {len(entries)} hidden entries for user {current_user.id}")
        return entries
        
    except Exception as e:
        logger.error(f"Failed to retrieve hidden entries: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve hidden entries"
        )


@router.get("/search", response_model=JournalEntrySearchResponse)
async def search_journal_entries(
    q: str = Query(..., description="Search term"),
    include_hidden: bool = Query(False, description="Include hidden entries in search"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Search journal entries by title, content, and tags.
    
    Note: Hidden entries can only be searched by title and tags since content is encrypted.
    """
    try:
        if not q.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Search term cannot be empty"
            )
        
        entries = journal_service.search_journal_entries(
            db=db,
            user_id=current_user.id,
            search_term=q.strip(),
            include_hidden=include_hidden
        )
        
        logger.info(f"Search for '{q}' returned {len(entries)} results for user {current_user.id}")
        
        return JournalEntrySearchResponse(
            entries=entries,
            search_term=q,
            total_matches=len(entries)
        )
        
    except Exception as e:
        logger.error(f"Failed to search journal entries: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search journal entries"
        )


@router.get("/{entry_id}", response_model=JournalEntry)
async def get_journal_entry(
    entry_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific journal entry by ID."""
    try:
        # Load DB entry and verify ownership
        db_entry = journal_service.get(db, id=entry_id)
        if not db_entry or db_entry.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Journal entry not found"
            )

        # Return as schema with encrypted fields encoded for client
        entry_schema = journal_service.get_schema(db, id=entry_id)
        if not entry_schema:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Journal entry not found"
            )
        return entry_schema

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve journal entry {entry_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve journal entry"
        )


@router.put("/{entry_id}", response_model=JournalEntry)
async def update_journal_entry(
    entry_id: UUID,
    entry_update: JournalEntryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a journal entry.
    
    For encrypted entries being updated with new content:
    - Provide encrypted_content, encryption_iv, and optional wrapped_key/wrap_iv
    - Leave content empty or None
    """
    try:
        # Validate encrypted entry updates
        if entry_update.encrypted_content and not entry_update.encryption_iv:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Encrypted entries with new content must include encryption_iv"
            )
        
        # Load the existing entry and verify ownership
        db_entry = journal_service.get(db, id=entry_id)
        if not db_entry or db_entry.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Journal entry not found"
            )

        # Perform the update using the service's update method
        updated_entry = journal_service.update(
            db=db,
            db_obj=db_entry,
            obj_in=entry_update
        )
        
        if not updated_entry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Journal entry not found"
            )
        
        logger.info(f"Updated journal entry {entry_id} for user {current_user.id}")
        return updated_entry
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update journal entry {entry_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update journal entry"
        )


@router.delete("/{entry_id}", response_model=JournalEntryDeleteResponse)
async def delete_journal_entry(
    entry_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a journal entry."""
    try:
        success = journal_service.delete_journal_entry(
            db=db,
            entry_id=entry_id,
            user_id=current_user.id
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Journal entry not found"
            )
        
        logger.info(f"Deleted journal entry {entry_id} for user {current_user.id}")
        return JournalEntryDeleteResponse(
            message="Journal entry deleted successfully",
            deleted_entry_id=entry_id
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete journal entry {entry_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete journal entry"
        )


@router.get("/stats/count", response_model=JournalEntryCountResponse)
async def get_entry_count(
    include_hidden: bool = Query(False, description="Include hidden entries in count"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get total count of journal entries for the current user."""
    try:
        count = journal_service.get_entry_count(
            db=db,
            user_id=current_user.id,
            include_hidden=include_hidden
        )
        
        return JournalEntryCountResponse(
            total_entries=count,
            include_hidden=include_hidden,
            user_id=current_user.id
        )
        
    except Exception as e:
        logger.error(f"Failed to get entry count: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get entry count"
        ) 