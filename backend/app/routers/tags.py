from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..dependencies import get_db, get_current_user
from ..models.user import User
from ..schemas.journal import Tag, TagCreate
from ..services.journal_service import journal_service

router = APIRouter()


@router.get("/", response_model=list[Tag])
def read_tags_with_slash(
    *, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> Any:
    """Get all tags for the current user."""
    return journal_service.get_tags_by_user(db=db, user_id=current_user.id)


@router.get("", response_model=list[Tag])
def read_tags(
    *, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> Any:
    """Get all tags for the current user."""
    return journal_service.get_tags_by_user(db=db, user_id=current_user.id)


@router.post("", response_model=Tag)
def create_tag(
    *,
    db: Session = Depends(get_db),
    tag_in: TagCreate,
    current_user: User = Depends(get_current_user),
) -> Any:
    """Create a new tag."""
    return journal_service.create_tag(db=db, tag_in=tag_in, user_id=current_user.id)


@router.put("/{tag_id}", response_model=Tag)
def update_tag(
    *,
    db: Session = Depends(get_db),
    tag_id: UUID,
    tag_in: Tag,
    current_user: User = Depends(get_current_user),
) -> Any:
    """Update a tag."""
    return journal_service.update_tag(
        db=db, tag_id=tag_id, tag_in=tag_in, user_id=current_user.id
    )


@router.delete("/{tag_id}", response_model=Tag)
def delete_tag(
    *,
    db: Session = Depends(get_db),
    tag_id: UUID,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Delete a tag.
    """
    try:
        return journal_service.delete_tag(db=db, tag_id=tag_id, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/recent", response_model=list[dict])
def get_recent_tags(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(5, ge=1, le=20, description="Number of recent tags to return")
) -> Any:
    """
    Get recently used tags for the current user, ordered by last usage date.
    Returns tags with usage statistics.
    """
    return journal_service.get_recent_tags_by_user(db=db, user_id=current_user.id, limit=limit) 