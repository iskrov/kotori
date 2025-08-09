"""
Journal routes for the Kotori application.

This module provides endpoints for journal management including creating,
retrieving, updating, and deleting journal entries.
"""

from datetime import date
from typing import Any, Union, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session

from ..dependencies import get_db, get_current_user
from ..models.user import User
from ..schemas.journal import JournalEntry
from ..schemas.journal import JournalEntryCreate
from ..schemas.journal import JournalEntryUpdate
from ..schemas.journal import SecretPhraseAuthResponse
from ..schemas.journal import SecretTagJournalEntry
from ..schemas.journal import JournalEntryCreateResponse
from ..services.journal_service import journal_service
from ..services.session_service import session_service
from ..services.phrase_processor import create_phrase_processor
from ..services.entry_processor import create_entry_processor, EntryProcessingError
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


def _read_journal_entries_impl(
    *,
    db: Session,
    current_user: User,
    skip: int = 0,
    limit: int = 100,
    start_date: date | None = None,
    end_date: date | None = None,
    tags: list[str] | None = None,
    include_hidden: bool = False,
) -> Any:
    """Implementation for reading journal entries."""
    return journal_service.get_multi_by_user(
        db=db,
        user_id=current_user.id,
        skip=skip,
        limit=limit,
        start_date=start_date,
        end_date=end_date,
        tags=tags,
        include_hidden=include_hidden,
    )


@router.get("", response_model=list[JournalEntry])
def read_journal_entries(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
    start_date: date | None = None,
    end_date: date | None = None,
    tags: list[str] | None = Query(None),
    include_hidden: bool = False,
) -> Any:
    """
    Retrieve journal entries for the current user.
    Optional filtering by date range and tags.
    Automatically filters hidden entries based on session state.
    """
    return _read_journal_entries_impl(
        db=db,
        current_user=current_user,
        skip=skip,
        limit=limit,
        start_date=start_date,
        end_date=end_date,
        tags=tags,
        include_hidden=include_hidden,
    )


@router.get("/", response_model=list[JournalEntry])
def read_journal_entries_with_slash(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
    start_date: date | None = None,
    end_date: date | None = None,
    tags: list[str] | None = Query(None),
    include_hidden: bool = False,
) -> Any:
    """
    Retrieve journal entries for the current user (with trailing slash).
    Optional filtering by date range and tags.
    Automatically filters hidden entries based on session state.
    """
    return _read_journal_entries_impl(
        db=db,
        current_user=current_user,
        skip=skip,
        limit=limit,
        start_date=start_date,
        end_date=end_date,
        tags=tags,
        include_hidden=include_hidden,
    )


@router.post("/test", response_model=dict)
async def test_journal_entry(
    entry: JournalEntryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Test endpoint to isolate the issue"""
    try:
        # Just try to create a journal entry without phrase processing
        created_entry = journal_service.create_with_user(
            db=db,
            obj_in=entry,
            user_id=current_user.id
        )
        return {"success": True, "id": created_entry.id, "message": "Test successful"}
    except Exception as e:
        return {"success": False, "error": str(e), "type": str(type(e))}


@router.post("/with-phrase-detection", response_model=Union[JournalEntry, SecretPhraseAuthResponse])
async def create_journal_entry_with_phrase_detection(
    entry: JournalEntryCreate,
    request: Request,
    detect_phrases: bool = Query(True, description="Enable secret phrase detection"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Create a new journal entry with advanced phrase detection.
    
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
        # Get client IP address for rate limiting
        client_ip = getattr(request.client, 'host', None) if request.client else None
        
        # Create entry processor
        entry_processor = create_entry_processor(db)
        
        # Process entry with phrase detection
        result = await entry_processor.process_entry_submission(
            entry_request=entry,
            user_id=current_user.id,
            detect_phrases=detect_phrases,
            ip_address=client_ip
        )
        
        logger.info(f"Entry processed with phrase detection for user {current_user.id}")
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

@router.post("/", response_model=Union[JournalEntryCreateResponse, SecretPhraseAuthResponse])
async def create_journal_entry(
    entry: JournalEntryCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Create a new journal entry and check for secret phrases.
    
    If secret phrases are detected and authenticated, returns encrypted entries
    for the authenticated secret tag. Otherwise returns standard entry creation response.
    """
    try:
        # Extract client IP for security logging
        client_ip = request.client.host if request.client else None
        
        logger.info(f"Creating journal entry for user {current_user.id} from IP {client_ip}")
        
        # Create the phrase processor
        phrase_processor = create_phrase_processor(db)
        
        # Process the entry content for secret phrases with IP for rate limiting
        auth_success, authenticated_tag, encrypted_entries, encryption_key = phrase_processor.process_entry_for_secret_phrases(
            entry.content, 
            current_user.id,
            ip_address=client_ip
        )
        
        if auth_success and authenticated_tag and encryption_key:
            logger.info(f"Secret phrase authentication successful for tag: {authenticated_tag.tag_handle.hex()}")
            
            # Decrypt entries for response
            decrypted_entries = []
            for encrypted_entry in encrypted_entries:
                try:
                    # Decrypt content
                    decrypted_content = phrase_processor.decrypt_entry_content(encrypted_entry, encryption_key)
                    
                    if decrypted_content:
                        # Create decrypted entry response
                        decrypted_entry = SecretTagJournalEntry(
                            id=encrypted_entry.id,
                            title=encrypted_entry.title,
                            content=decrypted_content,  # Decrypted content
                            audio_url=encrypted_entry.audio_url,
                            entry_date=encrypted_entry.entry_date,
                            user_id=encrypted_entry.user_id,
                            created_at=encrypted_entry.created_at,
                            updated_at=encrypted_entry.updated_at,
                            secret_tag_id=authenticated_tag.tag_handle.hex(),
                            tag_name=authenticated_tag.tag_name
                        )
                        decrypted_entries.append(decrypted_entry)
                    else:
                        logger.warning(f"Failed to decrypt entry {encrypted_entry.id}")
                        
                except Exception as e:
                    logger.error(f"Error decrypting entry {encrypted_entry.id}: {e}")
                    continue
            
            # Return secret phrase authentication response
            return SecretPhraseAuthResponse(
                authentication_successful=True,
                secret_tag_id=authenticated_tag.tag_handle.hex(),
                tag_name=authenticated_tag.tag_name,
                encrypted_entries=decrypted_entries,
                total_entries=len(decrypted_entries),
                message=f"Successfully authenticated secret tag '{authenticated_tag.tag_name}' and retrieved {len(decrypted_entries)} entries"
            )
        
        else:
            # No secret phrase detected, create normal journal entry
            logger.info("No secret phrase detected, creating normal journal entry")
            

            # Create standard journal entry
            created_entry = journal_service.create_with_user(
                db=db,
                obj_in=entry,
                user_id=current_user.id
            )
            
            # Return standard entry creation response
            # created_entry is already a schema with properly formatted tags
            return JournalEntryCreateResponse(
                id=created_entry.id,
                title=created_entry.title,
                content=created_entry.content,
                audio_url=created_entry.audio_url,
                entry_date=created_entry.entry_date,
                user_id=created_entry.user_id,
                tags=created_entry.tags,  # Tags are already in the correct format
                created_at=created_entry.created_at,
                updated_at=created_entry.updated_at,
                message="Journal entry created successfully"
            )
    
    except Exception as e:
        logger.error(f"Error creating journal entry: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create journal entry: {str(e)}"
        )


@router.post("/hidden", response_model=JournalEntry)
def create_hidden_journal_entry(
    *,
    db: Session = Depends(get_db),
    entry_in: JournalEntryCreate,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Create new hidden/encrypted journal entry for the current user.
    Legacy endpoint - use secret tags instead.
    """
    # Legacy support - just create a regular entry
    # Client should use secret tags for privacy
    return journal_service.create_with_user(
        db=db, obj_in=entry_in, user_id=current_user.id
    )


@router.post("/hidden-mode/activate")
def activate_hidden_mode(
    *,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Manually activate hidden mode for the current user.
    Typically triggered by code phrase detection.
    """
    session_service.activate_hidden_mode(current_user.id)
    return {"message": "Hidden mode activated", "user_id": current_user.id}


@router.post("/hidden-mode/deactivate")
def deactivate_hidden_mode(
    *,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Manually deactivate hidden mode for the current user.
    """
    session_service.deactivate_hidden_mode(current_user.id)
    return {"message": "Hidden mode deactivated", "user_id": current_user.id}


@router.get("/hidden-mode/status")
def get_hidden_mode_status(
    *,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Get the current hidden mode status for the user.
    """
    is_active = session_service.is_hidden_mode_active(current_user.id)
    session_info = session_service.get_session_info(current_user.id) if is_active else None
    
    return {
        "hidden_mode_active": is_active,
        "user_id": current_user.id,
        "session_info": session_info
    }





@router.get("/search", response_model=list[JournalEntry])
def search_journal_entries(
    *,
    db: Session = Depends(get_db),
    q: str = Query(..., min_length=3, description="Search query"),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Search for journal entries for the current user.
    """
    return journal_service.search(db=db, user_id=current_user.id, query=q)


@router.get("/{id}", response_model=JournalEntry)
def read_journal_entry(
    *,
    db: Session = Depends(get_db),
    id: UUID,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Get a specific journal entry by id.
    """
    journal_entry = journal_service.get_schema(db=db, id=id)
    if not journal_entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Journal entry not found"
        )
    if journal_entry.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions"
        )
    return journal_entry


@router.put("/{id}", response_model=JournalEntry)
def update_journal_entry(
    *,
    db: Session = Depends(get_db),
    id: UUID,
    entry_in: JournalEntryUpdate,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Update a journal entry.
    """
    journal_entry = journal_service.get(db=db, id=id)
    if not journal_entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Journal entry not found"
        )
    if journal_entry.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions"
        )
    return journal_service.update(db=db, db_obj=journal_entry, obj_in=entry_in)


@router.delete("/{id}")
def delete_journal_entry(
    *,
    db: Session = Depends(get_db),
    id: UUID,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Delete a journal entry.
    """
    journal_entry = journal_service.get(db=db, id=id)
    if not journal_entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Journal entry not found"
        )
    if journal_entry.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions"
        )
    
    # Delete the entry
    journal_service.remove(db=db, id=id)
    
    # Return a simple success response
    return {"message": "Journal entry deleted successfully", "id": id}
