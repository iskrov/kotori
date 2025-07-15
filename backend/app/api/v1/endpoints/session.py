"""
Session Management API Endpoints

This module provides FastAPI routes for OPAQUE session management operations.
"""

import asyncio
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, status, Request
from sqlalchemy.orm import Session
from typing import Optional
import logging

from app.dependencies import get_db, get_current_active_user_from_session, get_opaque_session
from app.models.user import User
from app.models.secret_tag_opaque import OpaqueSession
from app.services.session_service import session_service, SessionTokenError, SessionValidationError
from app.schemas.session import (
    SessionCreateRequest,
    SessionCreateResponse,
    SessionValidateRequest,
    SessionValidateResponse,
    SessionRefreshRequest,
    SessionRefreshResponse,
    SessionInvalidateRequest,
    SessionInvalidateResponse,
    SessionListRequest,
    SessionListResponse,
    SessionStatsResponse,
    SessionCleanupResponse,
    SessionErrorResponse,
    SessionInfo
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/create", response_model=SessionCreateResponse)
async def create_session(
    request: SessionCreateRequest,
    http_request: Request,
    db: Session = Depends(get_db)
):
    """
    Create a new OPAQUE session
    
    Creates a secure session for authenticated users with proper fingerprinting
    and security features.
    """
    start_time = asyncio.get_event_loop().time()
    
    try:
        # Extract client information for session fingerprinting
        user_agent = http_request.headers.get("user-agent", "")
        ip_address = http_request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        if not ip_address:
            ip_address = http_request.headers.get("x-real-ip", "")
        if not ip_address:
            ip_address = getattr(http_request.client, "host", "")
        
        # Create session
        session_token, session = session_service.create_session(
            db=db,
            user_id=request.user_id,
            tag_id=request.tag_id.encode('utf-8') if request.tag_id else None,
            user_agent=user_agent,
            ip_address=ip_address,
            session_data=request.session_data
        )
        
        # Timing attack protection
        elapsed = (asyncio.get_event_loop().time() - start_time) * 1000
        if elapsed < session_service.MIN_RESPONSE_TIME_MS:
            await asyncio.sleep((session_service.MIN_RESPONSE_TIME_MS - elapsed) / 1000)
        
        return SessionCreateResponse(
            success=True,
            session_token=session_token,
            expires_at=session.expires_at,
            message="Session created successfully"
        )
        
    except SessionTokenError as e:
        logger.error(f"Session creation error: {str(e)}")
        
        # Timing attack protection
        elapsed = (asyncio.get_event_loop().time() - start_time) * 1000
        if elapsed < session_service.MIN_RESPONSE_TIME_MS:
            await asyncio.sleep((session_service.MIN_RESPONSE_TIME_MS - elapsed) / 1000)
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Session creation failed"
        )
    except Exception as e:
        logger.error(f"Unexpected error creating session: {str(e)}")
        
        # Timing attack protection
        elapsed = (asyncio.get_event_loop().time() - start_time) * 1000
        if elapsed < session_service.MIN_RESPONSE_TIME_MS:
            await asyncio.sleep((session_service.MIN_RESPONSE_TIME_MS - elapsed) / 1000)
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.post("/validate", response_model=SessionValidateResponse)
async def validate_session(
    request: SessionValidateRequest,
    http_request: Request,
    db: Session = Depends(get_db)
):
    """
    Validate a session token
    
    Checks if a session token is valid and returns session information.
    """
    start_time = asyncio.get_event_loop().time()
    
    try:
        # Extract client information
        user_agent = http_request.headers.get("user-agent", "")
        ip_address = http_request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        if not ip_address:
            ip_address = http_request.headers.get("x-real-ip", "")
        if not ip_address:
            ip_address = getattr(http_request.client, "host", "")
        
        # Validate session
        session = session_service.validate_session_token(
            db=db,
            token=request.session_token,
            user_agent=user_agent,
            ip_address=ip_address
        )
        
        # Timing attack protection
        elapsed = (asyncio.get_event_loop().time() - start_time) * 1000
        if elapsed < session_service.MIN_RESPONSE_TIME_MS:
            await asyncio.sleep((session_service.MIN_RESPONSE_TIME_MS - elapsed) / 1000)
        
        if session:
            return SessionValidateResponse(
                valid=True,
                user_id=session.user_id,
                expires_at=session.expires_at,
                last_activity=session.last_activity,
                message="Session is valid"
            )
        else:
            return SessionValidateResponse(
                valid=False,
                user_id=None,
                expires_at=None,
                last_activity=None,
                message="Session is invalid or expired"
            )
        
    except SessionValidationError as e:
        logger.error(f"Session validation error: {str(e)}")
        
        # Timing attack protection
        elapsed = (asyncio.get_event_loop().time() - start_time) * 1000
        if elapsed < session_service.MIN_RESPONSE_TIME_MS:
            await asyncio.sleep((session_service.MIN_RESPONSE_TIME_MS - elapsed) / 1000)
        
        return SessionValidateResponse(
            valid=False,
            user_id=None,
            expires_at=None,
            last_activity=None,
            message="Session validation failed"
        )
    except Exception as e:
        logger.error(f"Unexpected error validating session: {str(e)}")
        
        # Timing attack protection
        elapsed = (asyncio.get_event_loop().time() - start_time) * 1000
        if elapsed < session_service.MIN_RESPONSE_TIME_MS:
            await asyncio.sleep((session_service.MIN_RESPONSE_TIME_MS - elapsed) / 1000)
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.post("/refresh", response_model=SessionRefreshResponse)
async def refresh_session(
    request: SessionRefreshRequest,
    http_request: Request,
    db: Session = Depends(get_db)
):
    """
    Refresh a JWT session token
    
    Generates a new JWT token for the session, blacklisting the old token.
    """
    start_time = asyncio.get_event_loop().time()
    
    try:
        # Extract client information
        user_agent = http_request.headers.get("user-agent", "")
        ip_address = http_request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        if not ip_address:
            ip_address = http_request.headers.get("x-real-ip", "")
        if not ip_address:
            ip_address = getattr(http_request.client, "host", "")
        
        # Refresh the JWT session token
        new_token = session_service.refresh_session_token(
            db=db,
            session_token=request.session_token,
            user_agent=user_agent,
            ip_address=ip_address
        )
        
        # Timing attack protection
        elapsed = (asyncio.get_event_loop().time() - start_time) * 1000
        if elapsed < session_service.MIN_RESPONSE_TIME_MS:
            await asyncio.sleep((session_service.MIN_RESPONSE_TIME_MS - elapsed) / 1000)
        
        if new_token:
            return SessionRefreshResponse(
                success=True,
                new_session_token=new_token,
                message="Session token refreshed successfully"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid session token"
            )
        
    except SessionTokenError as e:
        logger.error(f"Session refresh error: {str(e)}")
        
        # Timing attack protection
        elapsed = (asyncio.get_event_loop().time() - start_time) * 1000
        if elapsed < session_service.MIN_RESPONSE_TIME_MS:
            await asyncio.sleep((session_service.MIN_RESPONSE_TIME_MS - elapsed) / 1000)
        
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session refresh failed"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error refreshing session: {str(e)}")
        
        # Timing attack protection
        elapsed = (asyncio.get_event_loop().time() - start_time) * 1000
        if elapsed < session_service.MIN_RESPONSE_TIME_MS:
            await asyncio.sleep((session_service.MIN_RESPONSE_TIME_MS - elapsed) / 1000)
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.post("/invalidate", response_model=SessionInvalidateResponse)
async def invalidate_session(
    request: SessionInvalidateRequest,
    db: Session = Depends(get_db)
):
    """
    Invalidate a session
    
    Marks a session as invalid, preventing further use.
    """
    start_time = asyncio.get_event_loop().time()
    
    try:
        success = session_service.invalidate_session(db, request.session_token)
        
        # Timing attack protection
        elapsed = (asyncio.get_event_loop().time() - start_time) * 1000
        if elapsed < session_service.MIN_RESPONSE_TIME_MS:
            await asyncio.sleep((session_service.MIN_RESPONSE_TIME_MS - elapsed) / 1000)
        
        return SessionInvalidateResponse(
            success=success,
            message="Session invalidated successfully" if success else "Session not found"
        )
        
    except SessionTokenError as e:
        logger.error(f"Session invalidation error: {str(e)}")
        
        # Timing attack protection
        elapsed = (asyncio.get_event_loop().time() - start_time) * 1000
        if elapsed < session_service.MIN_RESPONSE_TIME_MS:
            await asyncio.sleep((session_service.MIN_RESPONSE_TIME_MS - elapsed) / 1000)
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Session invalidation failed"
        )
    except Exception as e:
        logger.error(f"Unexpected error invalidating session: {str(e)}")
        
        # Timing attack protection
        elapsed = (asyncio.get_event_loop().time() - start_time) * 1000
        if elapsed < session_service.MIN_RESPONSE_TIME_MS:
            await asyncio.sleep((session_service.MIN_RESPONSE_TIME_MS - elapsed) / 1000)
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/list", response_model=SessionListResponse)
async def list_sessions(
    user_id: Optional[str] = None,
    active_only: bool = True,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_active_user_from_session),
    db: Session = Depends(get_db)
):
    """
    List sessions for a user
    
    Returns a list of sessions for the authenticated user.
    """
    try:
        # Use current user if no user_id specified
        target_user_id = user_id or str(current_user.id)
        
        # Security check: users can only list their own sessions
        if target_user_id != str(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot access other users' sessions"
            )
        
        sessions = session_service.get_user_sessions(db, target_user_id, active_only)
        
        # Apply pagination
        total_count = len(sessions)
        paginated_sessions = sessions[offset:offset + limit]
        has_more = offset + limit < total_count
        
        # Convert to response format
        session_infos = []
        for session in paginated_sessions:
            session_infos.append(SessionInfo(
                session_id=session.session_id[:16] + "...",  # Truncate for security
                user_id=session.user_id,
                tag_id=session.tag_id.hex() if session.tag_id else None,
                state=session.session_state,
                created_at=session.created_at,
                expires_at=session.expires_at,
                last_activity=session.last_activity
            ))
        
        return SessionListResponse(
            sessions=session_infos,
            total_count=total_count,
            has_more=has_more
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing sessions: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/stats", response_model=SessionStatsResponse)
async def get_session_stats(
    current_user: User = Depends(get_current_active_user_from_session),
    db: Session = Depends(get_db)
):
    """
    Get session statistics
    
    Returns statistics about sessions for the authenticated user.
    """
    try:
        user_id = str(current_user.id)
        
        # Get all sessions for user
        all_sessions = session_service.get_user_sessions(db, user_id, active_only=False)
        active_sessions = session_service.get_user_sessions(db, user_id, active_only=True)
        
        total_sessions = len(all_sessions)
        active_count = len(active_sessions)
        expired_count = total_sessions - active_count
        
        return SessionStatsResponse(
            total_sessions=total_sessions,
            active_sessions=active_count,
            expired_sessions=expired_count,
            sessions_by_user={user_id: total_sessions}
        )
        
    except Exception as e:
        logger.error(f"Error getting session stats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.post("/cleanup", response_model=SessionCleanupResponse)
async def cleanup_expired_sessions(
    current_user: User = Depends(get_current_active_user_from_session),
    db: Session = Depends(get_db)
):
    """
    Clean up expired sessions
    
    Removes expired sessions from the database. Requires authentication.
    """
    try:
        cleaned_count = session_service.cleanup_expired_sessions(db)
        
        return SessionCleanupResponse(
            success=True,
            cleaned_sessions=cleaned_count,
            message=f"Cleaned up {cleaned_count} expired sessions"
        )
        
    except Exception as e:
        logger.error(f"Error cleaning up sessions: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Session cleanup failed"
        )


@router.get("/current", response_model=SessionInfo)
async def get_current_session(
    current_user: User = Depends(get_current_active_user_from_session),
    opaque_session: Optional[OpaqueSession] = Depends(get_opaque_session)
):
    """
    Get information about the current session
    
    Returns details about the session used for authentication.
    """
    try:
        if not opaque_session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active session found"
            )
        
        return SessionInfo(
            session_id=opaque_session.session_id[:16] + "...",  # Truncate for security
            user_id=opaque_session.user_id,
            tag_id=opaque_session.tag_id.hex() if opaque_session.tag_id else None,
            state=opaque_session.session_state,
            created_at=opaque_session.created_at,
            expires_at=opaque_session.expires_at,
            last_activity=opaque_session.last_activity
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting current session: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/token/info")
async def get_token_info(
    session_token: str,
    current_user: User = Depends(get_current_active_user_from_session)
):
    """
    Get information about a JWT session token
    
    Returns token information for debugging and monitoring.
    """
    try:
        token_info = session_service.get_session_info(session_token)
        
        if not token_info:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid token"
            )
        
        return {
            "token_info": token_info,
            "service": "session_service",
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting token info: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/health")
async def session_health_check():
    """
    Health check endpoint for session management
    
    Returns the health status of the session management system.
    """
    return {
        "status": "healthy",
        "service": "session_management",
        "features": {
            "session_creation": True,
            "session_validation": True,
            "session_refresh": True,
            "session_invalidation": True,
            "session_cleanup": True,
            "timing_protection": True,
            "fingerprinting": True,
            "jwt_tokens": True
        }
    } 