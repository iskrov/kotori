"""
User routes for the Vibes application.

This module provides endpoints for user management including profile management,
user settings, user information retrieval, subscription management, security features,
and referral system for mobile app users.
"""

import logging
from typing import Any
from uuid import UUID

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import status
from sqlalchemy.orm import Session
from typing import List

from ..dependencies import get_db, get_current_user
from ..models.user import User
from ..schemas.user import (
    User as UserSchema, UserUpdate, UserStats, UserProfile, UserPreferences,
    UserSubscription, UserSecurity, ReferralInfo, OnboardingUpdate,
    EmailVerificationRequest, PhoneVerificationRequest, VerificationResponse,
    TermsAcceptanceRequest, ProfilePictureUploadResponse
)
from ..services.user_service import user_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/", response_model=list[UserSchema])
def read_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve users. Only superusers can retrieve all users.
    """
    if current_user.is_superuser:
        return user_service.get_multi(db, skip=skip, limit=limit)
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions"
    )


@router.get("/me", response_model=UserSchema)
def read_user_me(
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Get current user with all profile information.
    """
    return current_user


@router.put("/me", response_model=UserSchema)
def update_user_me(
    *,
    db: Session = Depends(get_db),
    user_in: UserUpdate,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Update current user.
    """
    return user_service.update(db, db_obj=current_user, obj_in=user_in)


# Profile Management Endpoints
@router.get("/me/profile", response_model=UserProfile)
def get_user_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Get current user's profile information.
    """
    try:
        return user_service.get_user_profile(db=db, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.put("/me/profile", response_model=UserProfile)
def update_user_profile(
    *,
    db: Session = Depends(get_db),
    profile_data: UserProfile,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Update current user's profile information.
    """
    try:
        user_service.update_profile(db, db_obj=current_user, profile_data=profile_data)
        return user_service.get_user_profile(db=db, user_id=current_user.id)
    except Exception as e:
        logger.error(f"Error updating profile for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not update profile"
        )


# User Preferences Endpoints
@router.get("/me/preferences", response_model=UserPreferences)
def get_user_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Get current user's preferences.
    """
    try:
        return user_service.get_user_preferences(db=db, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.put("/me/preferences", response_model=UserPreferences)
def update_user_preferences(
    *,
    db: Session = Depends(get_db),
    preferences: UserPreferences,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Update current user's preferences.
    """
    try:
        user_service.update_preferences(db, db_obj=current_user, preferences=preferences)
        return user_service.get_user_preferences(db=db, user_id=current_user.id)
    except Exception as e:
        logger.error(f"Error updating preferences for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not update preferences"
        )


# Subscription Management Endpoints
@router.get("/me/subscription", response_model=UserSubscription)
def get_user_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Get current user's subscription information.
    """
    try:
        return user_service.get_user_subscription(db=db, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get("/me/subscription/status")
def get_subscription_status(
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Get current user's subscription status and tier access.
    """
    return {
        "account_tier": current_user.account_tier,
        "subscription_status": current_user.subscription_status,
        "subscription_expires_at": current_user.subscription_expires_at,
        "is_subscription_active": user_service.is_subscription_active(current_user),
        "has_premium_access": user_service.has_tier_access(current_user, "premium"),
        "has_enterprise_access": user_service.has_tier_access(current_user, "enterprise"),
    }


# Security Management Endpoints
@router.get("/me/security", response_model=UserSecurity)
def get_user_security(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Get current user's security information.
    """
    try:
        return user_service.get_user_security(db=db, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/me/verify-email", response_model=VerificationResponse)
def verify_email(
    *,
    db: Session = Depends(get_db),
    request: EmailVerificationRequest,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Verify user's email address.
    """
    try:
        # In a real implementation, this would send a verification email
        # For now, we'll just mark as verified if the email matches
        if request.email == current_user.email:
            user_service.verify_email(db, db_obj=current_user)
            return VerificationResponse(
                success=True,
                message="Email verified successfully"
            )
        else:
            return VerificationResponse(
                success=False,
                message="Email does not match current user"
            )
    except Exception as e:
        logger.error(f"Error verifying email for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not verify email"
        )


@router.post("/me/verify-phone", response_model=VerificationResponse)
def verify_phone(
    *,
    db: Session = Depends(get_db),
    request: PhoneVerificationRequest,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Verify user's phone number.
    """
    try:
        # In a real implementation, this would send a verification SMS
        # For now, we'll just mark as verified if the phone matches
        if request.phone == current_user.phone:
            user_service.verify_phone(db, db_obj=current_user)
            return VerificationResponse(
                success=True,
                message="Phone verified successfully"
            )
        else:
            return VerificationResponse(
                success=False,
                message="Phone does not match current user"
            )
    except Exception as e:
        logger.error(f"Error verifying phone for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not verify phone"
        )


@router.post("/me/enable-2fa")
def enable_two_factor_auth(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Enable two-factor authentication for the current user.
    """
    try:
        user_service.enable_two_factor(db, db_obj=current_user)
        return {"message": "Two-factor authentication enabled successfully"}
    except Exception as e:
        logger.error(f"Error enabling 2FA for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not enable two-factor authentication"
        )


@router.post("/me/disable-2fa")
def disable_two_factor_auth(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Disable two-factor authentication for the current user.
    """
    try:
        user_service.disable_two_factor(db, db_obj=current_user)
        return {"message": "Two-factor authentication disabled successfully"}
    except Exception as e:
        logger.error(f"Error disabling 2FA for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not disable two-factor authentication"
        )


@router.post("/me/accept-terms")
def accept_terms_and_privacy(
    *,
    db: Session = Depends(get_db),
    request: TermsAcceptanceRequest,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Accept terms of service and privacy policy.
    """
    try:
        from datetime import datetime, UTC
        update_data = {}
        
        if request.terms_accepted:
            update_data["terms_accepted_at"] = datetime.now(UTC)
        
        if request.privacy_policy_accepted:
            update_data["privacy_policy_accepted_at"] = datetime.now(UTC)
        
        user_service.update(db, db_obj=current_user, obj_in=update_data)
        return {"message": "Terms and privacy policy accepted successfully"}
    except Exception as e:
        logger.error(f"Error accepting terms for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not accept terms"
        )


# Onboarding Endpoints
@router.post("/me/onboarding", response_model=UserSchema)
def update_onboarding(
    *,
    db: Session = Depends(get_db),
    onboarding_data: OnboardingUpdate,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Update user onboarding status.
    """
    try:
        return user_service.update_onboarding(db, db_obj=current_user, onboarding_data=onboarding_data)
    except Exception as e:
        logger.error(f"Error updating onboarding for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not update onboarding status"
        )


@router.get("/me/onboarding/status")
def get_onboarding_status(
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Get current user's onboarding status.
    """
    onboarding_info = current_user.tier_metadata.get("onboarding", {}) if current_user.tier_metadata else {}
    
    return {
        "onboarding_completed": current_user.onboarding_completed,
        "current_step": onboarding_info.get("step"),
        "step_data": onboarding_info.get("data", {}),
        "completed_at": onboarding_info.get("completed_at")
    }


# Referral System Endpoints
@router.get("/me/referral", response_model=ReferralInfo)
def get_referral_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Get current user's referral information.
    """
    try:
        return user_service.get_referral_info(db=db, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


# Enhanced Statistics Endpoint
@router.get("/me/stats", response_model=UserStats)
async def read_user_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve enhanced statistics for the current authenticated user."""
    try:
        stats = user_service.get_user_stats(db=db, user_id=current_user.id)
        return stats
    except Exception as e:
        logger.error(f"Error calculating stats for user {current_user.id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not calculate user statistics."
        ) from e


# Legacy endpoint for backward compatibility
@router.get("/{user_id}", response_model=UserSchema)
def read_user_by_id(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Get a specific user by user_id.
    """
    # Check if user is superuser or requesting their own profile
    if not current_user.is_superuser and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    user = user_service.get(db, id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return user
