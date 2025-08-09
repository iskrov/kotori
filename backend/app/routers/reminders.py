"""
Reminder routes for the Kotori application.

This module provides endpoints for reminder management including creating,
retrieving, updating, and deleting reminders.
"""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi import status
from sqlalchemy.orm import Session
from typing import List

from ..dependencies import get_db, get_current_user
from ..models.user import User
from ..schemas.reminder import ReminderCreate, ReminderUpdate, Reminder
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
    return reminder_service.get_by_user(
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
    Create new reminder.
    """
    reminder_in.user_id = current_user.id
    return reminder_service.create(db=db, obj_in=reminder_in)


@router.get("/{id}", response_model=Reminder)
def read_reminder(
    *,
    db: Session = Depends(get_db),
    id: UUID,
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
    id: UUID,
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
    id: UUID,
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
