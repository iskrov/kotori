from typing import Any

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import status
from sqlalchemy.orm import Session

from ..core.security import get_current_user
from ..db.session import get_db
from ..models.user import User
from ..schemas.user import User as UserSchema
from ..schemas.user import UserUpdate
from ..schemas.user import UserStats
from ..services.user_service import user_service

router = APIRouter()


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
    Get current user.
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


@router.get("/{user_id}", response_model=UserSchema)
def read_user_by_id(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Get a specific user by id.
    """
    user = user_service.get(db, id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    if user.id == current_user.id or current_user.is_superuser:
        return user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions"
    )


@router.get("/me/stats", response_model=UserStats)
async def read_user_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve statistics for the current authenticated user."""
    try:
        stats = user_service.get_user_stats(db=db, user_id=current_user.id)
        return stats
    except Exception as e:
        # Log the exception
        # logger.error(f"Error calculating stats for user {current_user.id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not calculate user statistics."
        ) from e
