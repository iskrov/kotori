# Standard library imports
import logging
from datetime import datetime, timedelta, UTC
from typing import List
from uuid import UUID

# Third-party imports
from sqlalchemy.orm import Session
from sqlalchemy import and_

from ..models.reminder import Reminder
from ..schemas.reminder import ReminderCreate, ReminderUpdate

# First-party/local application imports (sorted alphabetically by path)
from .base import BaseService

# Add logger for this service
logger = logging.getLogger(__name__)

class ReminderService(BaseService[Reminder, ReminderCreate, ReminderUpdate]):
    def get_by_user(
        self, db: Session, *, user_id: UUID, skip: int = 0, limit: int = 100
    ) -> List[Reminder]:
        """Get reminders for a specific user."""
        return (
            db.query(Reminder)
            .filter(Reminder.user_id == user_id)
            .offset(skip)
            .limit(limit)
            .all()
        )

    def create_with_user(
        self, db: Session, *, obj_in: ReminderCreate, user_id: UUID
    ) -> Reminder:
        """Create a new reminder for a user."""
        db_obj = Reminder(
            **obj_in.dict(),
            user_id=user_id,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC)
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def get_active_by_user(self, db: Session, *, user_id: UUID) -> list[Reminder]:
        """Get active reminders for a user."""
        return (
            db.query(Reminder)
            .filter(
                and_(
                    Reminder.user_id == user_id,
                    Reminder.is_active == True  # noqa: E712
                )
            )
            .all()
        )

    def get_upcoming_reminders(self, db: Session, user_id: UUID) -> list[Reminder]:
        """Get upcoming reminders for a user within the next 24 hours."""
        now = datetime.now(UTC)
        tomorrow = now + timedelta(days=1)
        
        return (
            db.query(Reminder)
            .filter(
                and_(
                    Reminder.user_id == user_id,
                    Reminder.is_active == True,  # noqa: E712
                    Reminder.time >= now,
                    Reminder.time <= tomorrow
                )
            )
            .order_by(Reminder.time)
            .all()
        )


# Create singleton instance
reminder_service = ReminderService(Reminder)
