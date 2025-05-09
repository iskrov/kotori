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

router = APIRouter()


@router.get("/", response_model=list[JournalEntry])
def read_journal_entries(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
    start_date: date | None = None,
    end_date: date | None = None,
    tags: list[str] | None = Query(None),
) -> Any:
    """
    Retrieve journal entries for the current user.
    Optional filtering by date range and tags.
    """
    return journal_service.get_multi_by_user(
        db=db,
        user_id=current_user.id,
        skip=skip,
        limit=limit,
        start_date=start_date,
        end_date=end_date,
        tags=tags,
    )


@router.post("/", response_model=JournalEntry)
def create_journal_entry(
    *,
    db: Session = Depends(get_db),
    entry_in: JournalEntryCreate,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Create new journal entry for the current user.
    """
    return journal_service.create_with_user(
        db=db, obj_in=entry_in, user_id=current_user.id
    )


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
    journal_entry = journal_service.get(db=db, id=id)
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


@router.delete("/{id}", response_model=JournalEntry)
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
    return journal_service.remove(db=db, id=id)


@router.get("/tags/", response_model=list[Tag])
def read_tags(
    *, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> Any:
    """
    Get all tags used by the current user.
    """
    return journal_service.get_tags_by_user(db=db, user_id=current_user.id)
