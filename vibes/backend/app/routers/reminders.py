from typing import Any

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import status
from sqlalchemy.orm import Session

from ..core.security import get_current_user
from ..db.session import get_db
from ..models.user import User
from ..schemas.reminder import Reminder
from ..schemas.reminder import ReminderCreate
from ..schemas.reminder import ReminderUpdate
from ..services.reminder_service import reminder_service

router = APIRouter()


@router.get("/", response_model=list[Reminder])
def read_reminders(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve reminders for the current user.
    """
    return reminder_service.get_multi_by_user(
        db=db, user_id=current_user.id, skip=skip, limit=limit
    )


@router.post("/", response_model=Reminder)
def create_reminder(
    *,
    db: Session = Depends(get_db),
    reminder_in: ReminderCreate,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Create new reminder for the current user.
    """
    return reminder_service.create_with_user(
        db=db, obj_in=reminder_in, user_id=current_user.id
    )


@router.get("/{id}", response_model=Reminder)
def read_reminder(
    *,
    db: Session = Depends(get_db),
    id: int,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Get a specific reminder by id.
    """
    reminder = reminder_service.get(db=db, id=id)
    if not reminder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found"
        )
    if reminder.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions"
        )
    return reminder


@router.put("/{id}", response_model=Reminder)
def update_reminder(
    *,
    db: Session = Depends(get_db),
    id: int,
    reminder_in: ReminderUpdate,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Update a reminder.
    """
    reminder = reminder_service.get(db=db, id=id)
    if not reminder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found"
        )
    if reminder.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions"
        )
    return reminder_service.update(db=db, db_obj=reminder, obj_in=reminder_in)


@router.delete("/{id}", response_model=Reminder)
def delete_reminder(
    *,
    db: Session = Depends(get_db),
    id: int,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Delete a reminder.
    """
    reminder = reminder_service.get(db=db, id=id)
    if not reminder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found"
        )
    if reminder.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions"
        )
    return reminder_service.remove(db=db, id=id)
