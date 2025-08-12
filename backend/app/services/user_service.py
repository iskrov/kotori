from datetime import datetime, date, timedelta, timezone
from typing import Any, List, Dict, Optional
from uuid import UUID
import secrets
import hashlib

from sqlalchemy.orm import Session
from sqlalchemy import func, select

from ..core.security import get_password_hash
from ..core.security import verify_password
from ..models.user import User
from ..models.journal_entry import JournalEntry
from ..schemas.user import (
    UserCreate, UserUpdate, UserStats, UserProfile, UserPreferences,
    UserSubscription, UserSecurity, ReferralInfo, OnboardingUpdate
)
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

    def get_by_referral_code(self, db: Session, *, referral_code: str) -> User | None:
        """Get a user by referral code"""
        return db.query(User).filter(User.referral_code == referral_code).first()

    def create(self, db: Session, *, obj_in: UserCreate) -> User:
        """Create new user with hashed password and enhanced mobile app fields"""
        # Generate unique referral code
        referral_code = self._generate_referral_code(db)

        # Hash IP address for privacy
        ip_hash = None
        if hasattr(obj_in, 'user_agent') and obj_in.user_agent:
            # Extract IP from user agent or use a placeholder
            ip_hash = self._hash_ip_address("127.0.0.1")  # Placeholder - should be passed from request

        db_obj = User(
            email=obj_in.email,

            # Personal Information
            first_name=obj_in.first_name,
            last_name=obj_in.last_name,
            full_name=obj_in.full_name,
            display_name=obj_in.display_name,
            bio=obj_in.bio,
            phone=obj_in.phone,
            date_of_birth=obj_in.date_of_birth,

            # User Preferences & Localization
            timezone=obj_in.timezone,
            language_code=obj_in.language_code,
            theme_preference=obj_in.theme_preference,
            notification_preferences=obj_in.notification_preferences,
            privacy_settings=obj_in.privacy_settings,

            # Authentication
            hashed_password=get_password_hash(obj_in.password) if obj_in.password else None,
            google_id=obj_in.google_id,

            # Enhanced User Experience
            avatar_url=obj_in.avatar_url,
            cover_image_url=obj_in.cover_image_url,
            login_count=0,

            # Security & Compliance
            terms_accepted_at=obj_in.terms_accepted_at,
            privacy_policy_accepted_at=obj_in.privacy_policy_accepted_at,

            # Analytics & Insights
            registration_source=obj_in.registration_source,
            referral_code=referral_code,
            referred_by_user_id=obj_in.referred_by_user_id,
            user_agent=obj_in.user_agent,
            ip_address_hash=ip_hash,

            # Legacy fields
            is_superuser=obj_in.is_superuser,
            is_active=True,

            # Timestamps
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)

        # Update login count for new user
        self._update_login_activity(db, db_obj)

        return db_obj

    def update(
        self, db: Session, *, db_obj: User, obj_in: UserUpdate | dict[str, Any]
    ) -> User:
        """Update a user, hashing the password if it's being updated"""
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)

        if "password" in update_data and update_data["password"]:
            update_data["hashed_password"] = get_password_hash(update_data["password"])
            del update_data["password"]

        update_data["updated_at"] = datetime.now(timezone.utc)

        for field in update_data:
            setattr(db_obj, field, update_data[field])

        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update_profile(self, db: Session, *, db_obj: User, profile_data: UserProfile) -> User:
        """Update user profile information"""
        profile_dict = profile_data.model_dump(exclude_unset=True)
        return self.update(db, db_obj=db_obj, obj_in=profile_dict)

    def update_preferences(self, db: Session, *, db_obj: User, preferences: UserPreferences) -> User:
        """Update user preferences"""
        preferences_dict = preferences.model_dump(exclude_unset=True)
        return self.update(db, db_obj=db_obj, obj_in=preferences_dict)

    def update_onboarding(self, db: Session, *, db_obj: User, onboarding_data: OnboardingUpdate) -> User:
        """Update user onboarding status"""
        update_data = {
            "onboarding_completed": onboarding_data.onboarding_completed,
            "updated_at": datetime.now(timezone.utc)
        }

        # Store onboarding step data in tier_metadata if provided
        if onboarding_data.onboarding_step or onboarding_data.onboarding_data:
            tier_metadata = db_obj.tier_metadata.copy() if db_obj.tier_metadata else {}
            tier_metadata["onboarding"] = {
                "step": onboarding_data.onboarding_step,
                "data": onboarding_data.onboarding_data,
                "completed_at": datetime.now(timezone.utc).isoformat()
            }
            update_data["tier_metadata"] = tier_metadata

        return self.update(db, db_obj=db_obj, obj_in=update_data)

    def verify_email(self, db: Session, *, db_obj: User) -> User:
        """Mark user email as verified"""
        return self.update(db, db_obj=db_obj, obj_in={"email_verified": True})

    def verify_phone(self, db: Session, *, db_obj: User) -> User:
        """Mark user phone as verified"""
        return self.update(db, db_obj=db_obj, obj_in={"phone_verified": True})

    def enable_two_factor(self, db: Session, *, db_obj: User) -> User:
        """Enable two-factor authentication for user"""
        return self.update(db, db_obj=db_obj, obj_in={"two_factor_enabled": True})

    def disable_two_factor(self, db: Session, *, db_obj: User) -> User:
        """Disable two-factor authentication for user"""
        return self.update(db, db_obj=db_obj, obj_in={"two_factor_enabled": False})

    def update_subscription(self, db: Session, *, db_obj: User, tier: str, status: str,
                          expires_at: Optional[datetime] = None, metadata: Optional[Dict] = None) -> User:
        """Update user subscription information"""
        update_data = {
            "account_tier": tier,
            "subscription_status": status,
            "subscription_expires_at": expires_at,
        }

        if metadata:
            current_metadata = db_obj.tier_metadata.copy() if db_obj.tier_metadata else {}
            current_metadata.update(metadata)
            update_data["tier_metadata"] = current_metadata

        return self.update(db, db_obj=db_obj, obj_in=update_data)

    def record_login(self, db: Session, *, db_obj: User) -> User:
        """Record a user login event"""
        return self._update_login_activity(db, db_obj)

    def _update_login_activity(self, db: Session, db_obj: User) -> User:
        """Update login count and last seen timestamp"""
        return self.update(db, db_obj=db_obj, obj_in={
            "login_count": db_obj.login_count + 1,
            "last_seen_at": datetime.now(timezone.utc)
        })

    def _generate_referral_code(self, db: Session) -> str:
        """Generate a unique referral code"""
        while True:
            code = secrets.token_urlsafe(8)[:8].upper()
            if not self.get_by_referral_code(db, referral_code=code):
                return code

    def _hash_ip_address(self, ip_address: str) -> str:
        """Hash IP address for privacy-conscious analytics"""
        return hashlib.sha256(ip_address.encode()).hexdigest()

    def get_referral_info(self, db: Session, *, user_id: UUID) -> ReferralInfo:
        """Get referral information for a user"""
        user = self.get(db, id=user_id)
        if not user:
            raise ValueError("User not found")

        # Count users referred by this user
        referred_count = db.query(User).filter(User.referred_by_user_id == user_id).count()

        return ReferralInfo(
            referral_code=user.referral_code or "",
            referred_users_count=referred_count,
            total_referrals=referred_count  # Could be enhanced with more complex logic
        )

    def get_user_profile(self, db: Session, *, user_id: UUID) -> UserProfile:
        """Get user profile information"""
        user = self.get(db, id=user_id)
        if not user:
            raise ValueError("User not found")

        return UserProfile(
            first_name=user.first_name,
            last_name=user.last_name,
            display_name=user.display_name,
            bio=user.bio,
            phone=user.phone,
            date_of_birth=user.date_of_birth,
            avatar_url=user.avatar_url,
            cover_image_url=user.cover_image_url
        )

    def get_user_preferences(self, db: Session, *, user_id: UUID) -> UserPreferences:
        """Get user preferences"""
        user = self.get(db, id=user_id)
        if not user:
            raise ValueError("User not found")

        return UserPreferences(
            timezone=user.timezone,
            language_code=user.language_code,
            theme_preference=user.theme_preference,
            notification_preferences=user.notification_preferences,
            privacy_settings=user.privacy_settings
        )

    def get_user_subscription(self, db: Session, *, user_id: UUID) -> UserSubscription:
        """Get user subscription information"""
        user = self.get(db, id=user_id)
        if not user:
            raise ValueError("User not found")

        return UserSubscription(
            account_tier=user.account_tier,
            tier_metadata=user.tier_metadata,
            subscription_status=user.subscription_status,
            subscription_expires_at=user.subscription_expires_at
        )

    def get_user_security(self, db: Session, *, user_id: UUID) -> UserSecurity:
        """Get user security information"""
        user = self.get(db, id=user_id)
        if not user:
            raise ValueError("User not found")

        return UserSecurity(
            email_verified=user.email_verified,
            phone_verified=user.phone_verified,
            two_factor_enabled=user.two_factor_enabled,
            terms_accepted_at=user.terms_accepted_at,
            privacy_policy_accepted_at=user.privacy_policy_accepted_at
        )

    def authenticate(self, db: Session, *, email: str, password: str) -> User | None:
        """Authenticate a user with email and password"""
        user = self.get_by_email(db, email=email)
        if not user or not user.hashed_password:
            return None
        if not verify_password(password, user.hashed_password):
            return None

        # Record login activity
        self._update_login_activity(db, user)
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
                first_name="Test",
                last_name="User",
                full_name="Test User",
                display_name="Test User",
                hashed_password=get_password_hash("testpassword"),
                is_active=True,
                is_superuser=False,
                referral_code=self._generate_referral_code(db),
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
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

    def has_tier_access(self, user: User, required_tier: str) -> bool:
        """Check if user has access to a specific tier"""
        tier_hierarchy = {"free": 0, "premium": 1, "enterprise": 2, "admin": 3}
        user_tier_level = tier_hierarchy.get(user.account_tier, 0)
        required_tier_level = tier_hierarchy.get(required_tier, 0)
        return user_tier_level >= required_tier_level

    def is_subscription_active(self, user: User) -> bool:
        """Check if user has an active subscription"""
        if user.subscription_status != "active":
            return False

        if user.subscription_expires_at and user.subscription_expires_at < datetime.now(timezone.utc):
            return False

        return True

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

    def _get_entries_today(self, unique_entry_days: List[date], today_reference_date: date) -> int:
        """Calculates the number of entries today."""
        entries_today = sum(
            1 for entry_day in unique_entry_days if entry_day == today_reference_date
        )
        logger.info(f"Calculated entries_today: {entries_today}")
        return entries_today

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

    def get_user_stats(self, db: Session, user_id: UUID) -> UserStats:
        """Calculate and return enhanced statistics for a given user."""
        logger.info(f"Calculating enhanced stats for user_id: {user_id}")

        # Get user for enhanced stats
        user = self.get(db, id=user_id)
        if not user:
            raise ValueError("User not found")

        # Fetch all entry dates for the user, ordered most recent first
        # Assuming JournalEntry.entry_date stores timezone.utc datetimes
        entry_datetime_stamps = db.scalars(
            select(JournalEntry.entry_date)
            .where(JournalEntry.user_id == user_id)
            .order_by(JournalEntry.entry_date.desc())
        ).all()
        logger.debug(f"Fetched entry_datetime_stamps ({len(entry_datetime_stamps)}): {entry_datetime_stamps}")

        total_entries = len(entry_datetime_stamps)

        # Calculate days since registration
        days_since_registration = (datetime.now(timezone.utc).date() - user.created_at.date()).days

        if not entry_datetime_stamps:
            logger.info("No entries found, returning zero stats.")
            return UserStats(
                total_entries=0,
                current_streak=0,
                longest_streak=0,
                entries_today=0,
                entries_this_week=0,
                login_count=user.login_count,
                last_seen_at=user.last_seen_at,
                account_tier=user.account_tier,
                onboarding_completed=user.onboarding_completed,
                days_since_registration=days_since_registration
            )

        try:
            # Convert datetime objects to timezone.utc date objects for consistent comparison
            unique_entry_days_utc = sorted(list(set(entry_dt.date() for entry_dt in entry_datetime_stamps)), reverse=True)
            logger.debug(f"Unique entry days timezone.utc (YYYY-MM-DD): {unique_entry_days_utc}")
        except Exception as e:
            logger.error(f"Error converting entry_datetime_stamps to date objects: {e}", exc_info=True)
            # Fallback to empty list to avoid crashing, will result in zero stats for streaks/week
            unique_entry_days_utc = []

        if not unique_entry_days_utc: # Could be empty if conversion failed
            logger.warning("Unique entry days list is empty after conversion, returning zero for streak/week stats.")
            return UserStats(
                 total_entries=total_entries,
                 current_streak=0,
                 longest_streak=0,
                 entries_today=0,
                 entries_this_week=0,
                 login_count=user.login_count,
                 last_seen_at=user.last_seen_at,
                 account_tier=user.account_tier,
                 onboarding_completed=user.onboarding_completed,
                 days_since_registration=days_since_registration
             )

        # Use current timezone.utc date as the reference for calculations
        today_utc = datetime.now(timezone.utc).date()
        logger.debug(f"Today (timezone.utc): {today_utc} for stat calculations.")

        current_streak = self._calculate_current_streak(unique_entry_days_utc, today_utc)
        longest_streak = self._calculate_longest_streak(unique_entry_days_utc)
        entries_today = self._get_entries_today(unique_entry_days_utc, today_utc)
        entries_this_week = self._get_entries_this_week(unique_entry_days_utc, today_utc)

        stats_result = UserStats(
            total_entries=total_entries,
            current_streak=current_streak,
            longest_streak=longest_streak,
            entries_today=entries_today,
            entries_this_week=entries_this_week,
            login_count=user.login_count,
            last_seen_at=user.last_seen_at,
            account_tier=user.account_tier,
            onboarding_completed=user.onboarding_completed,
            days_since_registration=days_since_registration
        )
        logger.info(f"Returning enhanced stats for user {user_id}: {stats_result}")
        return stats_result


# Create singleton instance
user_service = UserService(User)
