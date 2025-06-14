from datetime import date
from typing import Any

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Query
from fastapi import status
from sqlalchemy.orm import Session

from ..core.security import get_current_user
from ..db.session import get_db
from ..models.user import User
from ..schemas.journal import JournalEntry
from ..schemas.journal import JournalEntryCreate
from ..schemas.journal import JournalEntryUpdate
from ..schemas.journal import Tag
from ..services.journal_service import journal_service
from ..services.session_service import session_service

router = APIRouter()


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


def _create_journal_entry_impl(
    *,
    db: Session,
    entry_in: JournalEntryCreate,
    current_user: User,
) -> Any:
    """Implementation for creating journal entries."""
    return journal_service.create_with_user(
        db=db, obj_in=entry_in, user_id=current_user.id
    )


@router.post("", response_model=JournalEntry)
def create_journal_entry(
    *,
    db: Session = Depends(get_db),
    entry_in: JournalEntryCreate,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Create new journal entry for the current user.
    """
    return _create_journal_entry_impl(
        db=db, entry_in=entry_in, current_user=current_user
    )


@router.post("/", response_model=JournalEntry)
def create_journal_entry_with_slash(
    *,
    db: Session = Depends(get_db),
    entry_in: JournalEntryCreate,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Create new journal entry for the current user (with trailing slash).
    """
    return _create_journal_entry_impl(
        db=db, entry_in=entry_in, current_user=current_user
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


@router.get("/{id}", response_model=JournalEntry)
def read_journal_entry(
    *,
    db: Session = Depends(get_db),
    id: int,
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
    id: int,
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
    id: int,
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


@router.get("/tags", response_model=list[Tag])
def read_tags(
    *, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> Any:
    """
    Get all tags used by the current user.
    """
    return journal_service.get_tags_by_user(db=db, user_id=current_user.id)
