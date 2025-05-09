from datetime import datetime, date, timedelta
from typing import Any, List

from sqlalchemy.orm import Session
from sqlalchemy import func, select

from ..core.security import get_password_hash
from ..core.security import verify_password
from ..models.user import User
from ..models.journal_entry import JournalEntry
from ..schemas.user import UserCreate, UserUpdate, UserStats
from .base import BaseService
import logging

logger = logging.getLogger(__name__)


class UserService(BaseService[User, UserCreate, UserUpdate]):
    def get_by_email(self, db: Session, *, email: str) -> User | None:
        """Get a user by email"""
        return db.query(User).filter(User.email == email).first()

    def get_by_google_id(self, db: Session, *, google_id: str) -> User | None:
        """Get a user by Google ID"""
        return db.query(User).filter(User.google_id == google_id).first()

    def create(self, db: Session, *, obj_in: UserCreate) -> User:
        """Create new user with hashed password"""
        db_obj = User(
            email=obj_in.email,
            full_name=obj_in.full_name,
            hashed_password=get_password_hash(obj_in.password)
            if obj_in.password
            else None,
            google_id=obj_in.google_id,
            is_superuser=obj_in.is_superuser,
            is_active=True,
            profile_picture=obj_in.profile_picture,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(
        self, db: Session, *, db_obj: User, obj_in: UserUpdate | dict[str, Any]
    ) -> User:
        """Update a user, hashing the password if it's being updated"""
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.dict(exclude_unset=True)

        if "password" in update_data and update_data["password"]:
            update_data["hashed_password"] = get_password_hash(update_data["password"])
            del update_data["password"]

        update_data["updated_at"] = datetime.utcnow()

        for field in update_data:
            setattr(db_obj, field, update_data[field])

        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def authenticate(self, db: Session, *, email: str, password: str) -> User | None:
        """Authenticate a user with email and password"""
        user = self.get_by_email(db, email=email)
        if not user or not user.hashed_password:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user

    def get_multi(self, db: Session, *, skip: int = 0, limit: int = 100) -> list[User]:
        """Get multiple users"""
        return db.query(User).offset(skip).limit(limit).all()

    def create_test_user(self, db: Session) -> User:
        """Create a test user for development purposes"""
        test_user = self.get_by_email(db, email="test@example.com")
        if not test_user:
            test_user = User(
                email="test@example.com",
                full_name="Test User",
                hashed_password=get_password_hash("testpassword"),
                is_active=True,
                is_superuser=False,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(test_user)
            db.commit()
            db.refresh(test_user)
        return test_user

    def is_active(self, user: User) -> bool:
        """Check if a user is active"""
        return user.is_active

    def is_superuser(self, user: User) -> bool:
        """Check if a user is a superuser"""
        return user.is_superuser

    def _calculate_current_streak(self, unique_entry_days: List[date], today_reference_date: date) -> int:
        """Calculates the current streak of consecutive entry days ending today or yesterday."""
        current_streak = 0
        # Start expecting today_reference_date or yesterday if today has no entry yet.
        expected_date = today_reference_date

        for entry_day in unique_entry_days: # unique_entry_days is sorted reverse chronological
            logger.debug(f"Current streak check: entry_day {entry_day} vs expected_date {expected_date}")
            if entry_day == expected_date:
                current_streak += 1
                logger.debug(f"  Match! Current streak is now {current_streak}. Expecting {expected_date - timedelta(days=1)}")
                expected_date -= timedelta(days=1)
            elif entry_day == today_reference_date - timedelta(days=1) and current_streak == 0:
                # If the first entry checked is yesterday, and today has no entry, it can start a streak of 1 for yesterday.
                current_streak +=1
                logger.debug(f"  First entry is yesterday. Current streak is {current_streak}. Expecting {entry_day - timedelta(days=1)}")
                expected_date = entry_day - timedelta(days=1)
            elif entry_day < expected_date:
                # A gap in dates means the streak is broken.
                logger.debug(f"  Streak broken. Entry date {entry_day} is older than expected {expected_date}.")
                break
            # If entry_day > expected_date (should not happen with sorted list) or other unhandled cases, continue.
            # This also handles if the most recent entry is older than yesterday, so no streak is formed.
        logger.info(f"Calculated current_streak: {current_streak}")
        return current_streak

    def _calculate_longest_streak(self, unique_entry_days: List[date]) -> int:
        """Calculates the longest streak of consecutive entry days."""
        if not unique_entry_days:
            return 0

        longest_streak = 1
        current_run = 1
        for i in range(len(unique_entry_days) - 1):
            date_curr = unique_entry_days[i] # More recent
            date_prev = unique_entry_days[i+1] # Less recent (further in past)
            logger.debug(f"Longest streak check: Comparing {date_curr} and {date_prev}")
            if date_prev == date_curr - timedelta(days=1):
                current_run += 1
                logger.debug(f"  Consecutive day found. Current run: {current_run}")
            else:
                longest_streak = max(longest_streak, current_run)
                current_run = 1 # Reset for the new potential streak starting at date_prev
                logger.debug(f"  Non-consecutive. Max streak was {longest_streak}. Resetting run to 1.")
        longest_streak = max(longest_streak, current_run) # Final check for the last run
        logger.info(f"Calculated longest_streak: {longest_streak}")
        return longest_streak

    def _get_entries_this_week(self, unique_entry_days: List[date], today_reference_date: date) -> int:
        """Calculates the number of unique entry days this week (Monday to Sunday)."""
        start_of_week = today_reference_date - timedelta(days=today_reference_date.weekday()) # Monday
        end_of_week = start_of_week + timedelta(days=6) # Sunday
        logger.info(f"Calculating entries this week ({start_of_week} to {end_of_week}) using reference {today_reference_date}")
        entries_this_week = sum(
            1 for entry_day in unique_entry_days if start_of_week <= entry_day <= end_of_week
        )
        logger.info(f"Calculated entries_this_week: {entries_this_week}")
        return entries_this_week

    def get_user_stats(self, db: Session, user_id: int) -> UserStats:
        """Calculate and return statistics for a given user."""
        logger.info(f"Calculating stats for user_id: {user_id}")

        # Fetch all entry dates for the user, ordered most recent first
        # Assuming JournalEntry.entry_date stores UTC datetimes
        entry_datetime_stamps = db.scalars(
            select(JournalEntry.entry_date)
            .where(JournalEntry.user_id == user_id)
            .order_by(JournalEntry.entry_date.desc())
        ).all()
        logger.debug(f"Fetched entry_datetime_stamps ({len(entry_datetime_stamps)}): {entry_datetime_stamps}")

        total_entries = len(entry_datetime_stamps)

        if not entry_datetime_stamps:
            logger.info("No entries found, returning zero stats.")
            return UserStats(total_entries=0, current_streak=0, longest_streak=0, entries_this_week=0)

        try:
            # Convert datetime objects to UTC date objects for consistent comparison
            unique_entry_days_utc = sorted(list(set(entry_dt.date() for entry_dt in entry_datetime_stamps)), reverse=True)
            logger.debug(f"Unique entry days UTC (YYYY-MM-DD): {unique_entry_days_utc}")
        except Exception as e:
            logger.error(f"Error converting entry_datetime_stamps to date objects: {e}", exc_info=True)
            # Fallback to empty list to avoid crashing, will result in zero stats for streaks/week
            unique_entry_days_utc = []

        if not unique_entry_days_utc: # Could be empty if conversion failed
             logger.warning("Unique entry days list is empty after conversion, returning zero for streak/week stats.")
             return UserStats(total_entries=total_entries, current_streak=0, longest_streak=0, entries_this_week=0)

        # Use current UTC date as the reference for calculations
        today_utc = datetime.utcnow().date()
        logger.debug(f"Today (UTC): {today_utc} for stat calculations.")

        current_streak = self._calculate_current_streak(unique_entry_days_utc, today_utc)
        longest_streak = self._calculate_longest_streak(unique_entry_days_utc)
        entries_this_week = self._get_entries_this_week(unique_entry_days_utc, today_utc)

        stats_result = UserStats(
            total_entries=total_entries,
            current_streak=current_streak,
            longest_streak=longest_streak,
            entries_this_week=entries_this_week
        )
        logger.info(f"Returning stats for user {user_id}: {stats_result}")
        return stats_result


# Create singleton instance
user_service = UserService(User)
