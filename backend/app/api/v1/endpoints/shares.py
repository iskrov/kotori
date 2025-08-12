from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session
import logging

from ....dependencies import get_db, get_current_user
from ....models.user import User
from ....schemas.share import (
    ShareCreateRequest,
    ShareResponse,
    ShareDetailResponse,
    ShareListResponse,
    SharePublicResponse,
    ShareUpdate,
    ShareStats
)
from ....services.share_service import share_service
from ....services.pdf_service import pdf_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/", response_model=ShareResponse)
async def create_share(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: ShareCreateRequest
) -> Any:
    """
    Create a new share from journal entries using AI processing.
    
    This endpoint:
    1. Validates the template and journal entries
    2. Processes entries with Gemini to generate Q&A pairs
    3. Creates a shareable artifact with a public token
    4. Returns share details including the access token
    """
    try:
        share = await share_service.create_share(
            db=db,
            user_id=current_user.id,
            request=request
        )
        
        logger.info(f"Created share {share.id} for user {current_user.id}")
        
        # Return share response without sensitive content
        return ShareResponse(
            id=share.id,
            share_token=share.share_token,
            title=share.title,
            template_id=share.template_id,
            target_language=share.target_language,
            entry_count=share.entry_count,
            question_count=share.question_count,
            created_at=share.created_at,
            expires_at=share.expires_at,
            access_count=share.access_count,
            is_active=share.is_active
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating share: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create share"
        )


@router.get("/", response_model=ShareListResponse)
def get_user_shares(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
    active_only: bool = True
) -> Any:
    """
    Get all shares for the current user.
    """
    try:
        shares = share_service.get_user_shares(
            db=db,
            user_id=current_user.id,
            skip=skip,
            limit=limit,
            active_only=active_only
        )
        
        # Convert to response format
        share_responses = [
            ShareResponse(
                id=share.id,
                share_token=share.share_token,
                title=share.title,
                template_id=share.template_id,
                target_language=share.target_language,
                entry_count=share.entry_count,
                question_count=share.question_count,
                created_at=share.created_at,
                expires_at=share.expires_at,
                access_count=share.access_count,
                is_active=share.is_active
            )
            for share in shares
        ]
        
        return ShareListResponse(
            shares=share_responses,
            total=len(share_responses),
            page=skip // limit + 1 if limit > 0 else 1,
            per_page=limit
        )
        
    except Exception as e:
        logger.error(f"Error retrieving shares for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve shares"
        )


@router.get("/{share_id}", response_model=ShareDetailResponse)
def get_share_detail(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    share_id: str
) -> Any:
    """
    Get detailed information about a specific share (owner only).
    """
    try:
        # Parse UUID
        from uuid import UUID
        share_uuid = UUID(share_id)
        
        share = share_service.get(db, id=share_uuid)
        if not share:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Share not found"
            )
        
        # Check ownership
        if share.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        return ShareDetailResponse(
            id=share.id,
            share_token=share.share_token,
            title=share.title,
            template_id=share.template_id,
            target_language=share.target_language,
            entry_count=share.entry_count,
            question_count=share.question_count,
            created_at=share.created_at,
            expires_at=share.expires_at,
            access_count=share.access_count,
            is_active=share.is_active,
            content=share.content,  # Include full content for owner
            last_accessed_at=share.last_accessed_at
        )
        
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid share ID format"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving share detail: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve share details"
        )


@router.put("/{share_id}", response_model=ShareResponse)
def update_share(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    share_id: str,
    update_data: ShareUpdate
) -> Any:
    """
    Update share settings (owner only).
    """
    try:
        from uuid import UUID
        share_uuid = UUID(share_id)
        
        share = share_service.get(db, id=share_uuid)
        if not share:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Share not found"
            )
        
        if share.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Update share
        updated_share = share_service.update(db, db_obj=share, obj_in=update_data.dict(exclude_unset=True))
        
        return ShareResponse(
            id=updated_share.id,
            share_token=updated_share.share_token,
            title=updated_share.title,
            template_id=updated_share.template_id,
            target_language=updated_share.target_language,
            entry_count=updated_share.entry_count,
            question_count=updated_share.question_count,
            created_at=updated_share.created_at,
            expires_at=updated_share.expires_at,
            access_count=updated_share.access_count,
            is_active=updated_share.is_active
        )
        
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid share ID format"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating share: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update share"
        )


@router.delete("/{share_id}", response_model=ShareResponse)
def deactivate_share(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    share_id: str
) -> Any:
    """
    Deactivate a share (soft delete).
    """
    try:
        from uuid import UUID
        share_uuid = UUID(share_id)
        
        updated_share = share_service.deactivate_share(
            db=db,
            share_id=share_uuid,
            user_id=current_user.id
        )
        
        if not updated_share:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Share not found"
            )
        
        return ShareResponse(
            id=updated_share.id,
            share_token=updated_share.share_token,
            title=updated_share.title,
            template_id=updated_share.template_id,
            target_language=updated_share.target_language,
            entry_count=updated_share.entry_count,
            question_count=updated_share.question_count,
            created_at=updated_share.created_at,
            expires_at=updated_share.expires_at,
            access_count=updated_share.access_count,
            is_active=updated_share.is_active
        )
        
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid share ID format"
        )
    except Exception as e:
        logger.error(f"Error deactivating share: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to deactivate share"
        )


@router.get("/stats/summary", response_model=ShareStats)
def get_share_stats(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Get share statistics for the current user.
    """
    try:
        stats = share_service.get_share_stats(db=db, user_id=current_user.id)
        return ShareStats(**stats)
        
    except Exception as e:
        logger.error(f"Error retrieving share stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve share statistics"
        )


# Public endpoint for accessing shares via token
@router.get("/public/{token}", response_model=SharePublicResponse)
def get_public_share(
    *,
    db: Session = Depends(get_db),
    request: Request,
    token: str
) -> Any:
    """
    Access a share via public token (no authentication required).
    
    This endpoint is used by recipients to view shared summaries.
    """
    try:
        share = share_service.get_by_token(db, token=token)
        if not share:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Share not found"
            )
        
        # Record access
        client_ip = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")
        referrer = request.headers.get("referer")
        
        share = share_service.access_share(
            db=db,
            share=share,
            ip_address=client_ip,
            user_agent=user_agent,
            referrer=referrer,
            access_type="view"
        )
        
        return SharePublicResponse(
            title=share.title,
            content=share.content,
            created_at=share.created_at,
            expires_at=share.expires_at,
            is_expired=share.is_expired
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error accessing public share: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to access share"
        )


@router.get("/{share_id}/pdf")
def download_share_pdf(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    share_id: str
) -> Response:
    """
    Download a share as PDF (owner only).
    """
    try:
        from uuid import UUID
        share_uuid = UUID(share_id)
        
        share = share_service.get(db, id=share_uuid)
        if not share:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Share not found"
            )
        
        # Check ownership
        if share.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Generate PDF
        pdf_bytes = pdf_service.generate_share_pdf(
            share_content=share.content,
            title=share.title,
            created_at=share.created_at,
            expires_at=share.expires_at
        )
        
        # Record download access
        share_service.access_share(
            db=db,
            share=share,
            access_type="download"
        )
        
        # Return PDF response
        filename = f"kotori_summary_{share.created_at.strftime('%Y%m%d')}_{share_id[:8]}.pdf"
        
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid share ID format"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating PDF: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate PDF"
        )


@router.get("/public/{token}/pdf")
def download_public_share_pdf(
    *,
    db: Session = Depends(get_db),
    request: Request,
    token: str
) -> Response:
    """
    Download a public share as PDF (no authentication required).
    """
    try:
        share = share_service.get_by_token(db, token=token)
        if not share:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Share not found"
            )
        
        # Record access with client info
        client_ip = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")
        referrer = request.headers.get("referer")
        
        share = share_service.access_share(
            db=db,
            share=share,
            ip_address=client_ip,
            user_agent=user_agent,
            referrer=referrer,
            access_type="download"
        )
        
        # Generate PDF
        pdf_bytes = pdf_service.generate_share_pdf(
            share_content=share.content,
            title=share.title,
            created_at=share.created_at,
            expires_at=share.expires_at
        )
        
        # Return PDF response
        filename = f"kotori_summary_{share.created_at.strftime('%Y%m%d')}.pdf"
        
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error generating public PDF: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate PDF"
        )
