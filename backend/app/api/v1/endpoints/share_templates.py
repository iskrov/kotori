from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import logging

from ....dependencies import get_db, get_current_user
from ....models.user import User
from ....models.share_template import ShareTemplate
from ....schemas.share_template import (
    ShareTemplate as ShareTemplateSchema,
    ShareTemplateCreate,
    ShareTemplateUpdate,
    ShareTemplateList,
    ShareTemplateSummary
)
from ....services.share_template_service import share_template_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/", response_model=List[ShareTemplateSummary])
def get_active_templates(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100
) -> Any:
    """
    Get all active share templates (summaries for UI dropdowns).
    """
    try:
        summaries = share_template_service.get_template_summaries(
            db, active_only=True
        )
        
        # Apply pagination manually since we're returning summaries
        paginated = summaries[skip:skip + limit]
        
        logger.info(f"Retrieved {len(paginated)} template summaries for user {current_user.id}")
        return paginated
        
    except Exception as e:
        logger.error(f"Error retrieving template summaries: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve templates"
        )


@router.get("/{template_id}", response_model=ShareTemplateSchema)
def get_template(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    template_id: str
) -> Any:
    """
    Get a specific template by template_id.
    """
    template = share_template_service.get_by_template_id(db, template_id=template_id)
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template '{template_id}' not found"
        )
    
    if not template.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template '{template_id}' is not available"
        )
    
    logger.info(f"Retrieved template {template_id} for user {current_user.id}")
    return template


@router.get("/category/{category}", response_model=List[ShareTemplateSummary])
def get_templates_by_category(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    category: str
) -> Any:
    """
    Get templates by category.
    """
    try:
        templates = share_template_service.get_by_category(
            db, category=category, active_only=True
        )
        
        summaries = [
            {
                "id": template.id,
                "template_id": template.template_id,
                "name": template.name,
                "description": template.description,
                "category": template.category,
                "question_count": template.question_count
            }
            for template in templates
        ]
        
        logger.info(f"Retrieved {len(summaries)} templates for category '{category}'")
        return summaries
        
    except Exception as e:
        logger.error(f"Error retrieving templates for category '{category}': {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve templates"
        )


# Admin-only endpoints for template management
@router.post("/", response_model=ShareTemplateSchema)
def create_template(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    template_in: ShareTemplateCreate
) -> Any:
    """
    Create a new share template.
    
    Note: In production, this should be restricted to admin users only.
    For now, any authenticated user can create templates.
    """
    try:
        template = share_template_service.create_template(db, obj_in=template_in)
        logger.info(f"Created template {template.template_id} by user {current_user.id}")
        return template
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating template: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create template"
        )


@router.put("/{template_id}", response_model=ShareTemplateSchema)
def update_template(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    template_id: str,
    template_in: ShareTemplateUpdate
) -> Any:
    """
    Update an existing share template.
    
    Note: In production, this should be restricted to admin users only.
    """
    template = share_template_service.get_by_template_id(db, template_id=template_id)
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template '{template_id}' not found"
        )
    
    try:
        updated_template = share_template_service.update_template(
            db, db_obj=template, obj_in=template_in
        )
        logger.info(f"Updated template {template_id} by user {current_user.id}")
        return updated_template
        
    except Exception as e:
        logger.error(f"Error updating template {template_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update template"
        )


@router.delete("/{template_id}", response_model=ShareTemplateSchema)
def deactivate_template(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    template_id: str
) -> Any:
    """
    Soft delete (deactivate) a share template.
    
    Note: In production, this should be restricted to admin users only.
    """
    template = share_template_service.deactivate_template(db, template_id=template_id)
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template '{template_id}' not found"
        )
    
    logger.info(f"Deactivated template {template_id} by user {current_user.id}")
    return template
