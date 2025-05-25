from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import logging

from app.api.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.journal import (
    JournalEntry,
    JournalEntryCreate,
    JournalEntryUpdate,
    HiddenJournalEntry,
    JournalEntryBulkResponse,
    JournalEntrySearchResponse
)
from app.services.journal_service import JournalService

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
        # Validate hidden entry requirements
        if entry.is_hidden:
            if not entry.encrypted_content or not entry.encryption_iv:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Hidden entries must include encrypted_content and encryption_iv"
                )
            if entry.content:
                logger.warning("Hidden entry contains content field - will be ignored")
                entry.content = ""  # Clear content for hidden entries
        
        # Validate regular entry requirements
        elif not entry.content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Regular entries must include content"
            )
        
        db_entry = JournalService.create_journal_entry(
            db=db, 
            entry=entry, 
            user_id=current_user.id
        )
        
        logger.info(f"Created {'hidden' if entry.is_hidden else 'regular'} journal entry for user {current_user.id}")
        return db_entry
        
    except Exception as e:
        logger.error(f"Failed to create journal entry: {str(e)}")
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
        entries = JournalService.get_journal_entries(
            db=db,
            user_id=current_user.id,
            skip=skip,
            limit=limit,
            include_hidden=include_hidden
        )
        
        total_count = JournalService.get_entry_count(
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
        entries = JournalService.get_hidden_entries_only(
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
        
        entries = JournalService.search_journal_entries(
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
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific journal entry by ID."""
    try:
        entry = JournalService.get_journal_entry_by_id(
            db=db,
            entry_id=entry_id,
            user_id=current_user.id
        )
        
        if not entry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Journal entry not found"
            )
        
        return entry
        
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
    entry_id: int,
    entry_update: JournalEntryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a journal entry.
    
    For hidden entries being updated with new content:
    - Provide new encrypted_content, encryption_iv, and optionally encryption_salt
    - Leave content field empty or None
    """
    try:
        # Validate hidden entry updates
        if entry_update.is_hidden is True:
            if entry_update.encrypted_content and not entry_update.encryption_iv:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Hidden entries with new content must include encryption_iv"
                )
        
        updated_entry = JournalService.update_journal_entry(
            db=db,
            entry_id=entry_id,
            user_id=current_user.id,
            entry_update=entry_update
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


@router.delete("/{entry_id}")
async def delete_journal_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a journal entry."""
    try:
        success = JournalService.delete_journal_entry(
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
        return {"message": "Journal entry deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete journal entry {entry_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete journal entry"
        )


@router.get("/stats/count")
async def get_entry_count(
    include_hidden: bool = Query(False, description="Include hidden entries in count"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get total count of journal entries for the current user."""
    try:
        count = JournalService.get_entry_count(
            db=db,
            user_id=current_user.id,
            include_hidden=include_hidden
        )
        
        return {
            "total_entries": count,
            "include_hidden": include_hidden,
            "user_id": current_user.id
        }
        
    except Exception as e:
        logger.error(f"Failed to get entry count: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get entry count"
        ) 