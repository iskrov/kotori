# Standard library imports
import logging
from datetime import datetime
from datetime import timezone

# Third-party imports
from sqlalchemy.orm import Session

from ..models.reminder import Reminder
from ..schemas.reminder import ReminderCreate
from ..schemas.reminder import ReminderUpdate

# First-party/local application imports (sorted alphabetically by path)
from .base import BaseService

# Add logger for this service
logger = logging.getLogger(__name__)

class ReminderService(BaseService[Reminder, ReminderCreate, ReminderUpdate]):
    def get_multi_by_user(
        self, db: Session, *, user_id: int, skip: int = 0, limit: int = 100
    ) -> list[Reminder]:
        """
        Get multiple reminders by user_id
        """
        return (
            db.query(Reminder)
            .filter(Reminder.user_id == user_id)
            .order_by(Reminder.time)
            .offset(skip)
            .limit(limit)
            .all()
        )

    def create_with_user(
        self, db: Session, *, obj_in: ReminderCreate, user_id: int
    ) -> Reminder:
        """
        Create a new reminder with user_id
        """
        obj_in_data = obj_in.dict()
        db_obj = Reminder(**obj_in_data, user_id=user_id)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def get_active_by_user(self, db: Session, *, user_id: int) -> list[Reminder]:
        """
        Get active reminders for a user
        """
        return (
            db.query(Reminder)
            .filter(
                Reminder.user_id == user_id,
                Reminder.is_active
            )
            .order_by(Reminder.time)
            .all()
        )

    def get_upcoming_reminders(self, db: Session, user_id: int) -> list[Reminder]:
        """Get upcoming active reminders for a user."""
        now = datetime.now(timezone.utc)
        try:
            return (
                db.query(Reminder)
                .filter(
                    Reminder.user_id == user_id,
                    Reminder.reminder_time > now,
                    Reminder.is_active
                )
                .order_by(Reminder.reminder_time)
                .all()
            )
        except Exception as e:
            # Explicitly use the module-level logger
            logger.error(f"Error fetching upcoming reminders for user {user_id}: {e}", exc_info=True)
            raise


# Create singleton instance
reminder_service = ReminderService(Reminder)
