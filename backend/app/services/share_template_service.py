import logging
from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import and_

from ..models.share_template import ShareTemplate
from ..schemas.share_template import ShareTemplateCreate, ShareTemplateUpdate
from .base import BaseService

logger = logging.getLogger(__name__)


class ShareTemplateService(BaseService[ShareTemplate, ShareTemplateCreate, ShareTemplateUpdate]):
    """Service for managing share templates"""

    def get_active_templates(
        self, db: Session, *, skip: int = 0, limit: int = 100
    ) -> List[ShareTemplate]:
        """Get all active templates"""
        return (
            db.query(ShareTemplate)
            .filter(ShareTemplate.is_active == True)
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_by_template_id(
        self, db: Session, *, template_id: str
    ) -> Optional[ShareTemplate]:
        """Get template by template_id"""
        return (
            db.query(ShareTemplate)
            .filter(ShareTemplate.template_id == template_id)
            .first()
        )

    def get_by_category(
        self, db: Session, *, category: str, active_only: bool = True
    ) -> List[ShareTemplate]:
        """Get templates by category"""
        query = db.query(ShareTemplate).filter(ShareTemplate.category == category)
        
        if active_only:
            query = query.filter(ShareTemplate.is_active == True)
            
        return query.all()

    def create_template(
        self, db: Session, *, obj_in: ShareTemplateCreate
    ) -> ShareTemplate:
        """Create a new share template"""
        # Check if template_id already exists
        existing = self.get_by_template_id(db, template_id=obj_in.template_id)
        if existing:
            raise ValueError(f"Template with ID '{obj_in.template_id}' already exists")

        db_obj = ShareTemplate(**obj_in.dict())
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        
        logger.info(f"Created share template: {obj_in.template_id}")
        return db_obj

    def update_template(
        self, db: Session, *, db_obj: ShareTemplate, obj_in: ShareTemplateUpdate
    ) -> ShareTemplate:
        """Update an existing share template"""
        update_data = obj_in.dict(exclude_unset=True)
        
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        
        db.commit()
        db.refresh(db_obj)
        
        logger.info(f"Updated share template: {db_obj.template_id}")
        return db_obj

    def deactivate_template(
        self, db: Session, *, template_id: str
    ) -> Optional[ShareTemplate]:
        """Soft delete a template by setting is_active=False"""
        template = self.get_by_template_id(db, template_id=template_id)
        if not template:
            return None
            
        template.is_active = False
        db.commit()
        db.refresh(template)
        
        logger.info(f"Deactivated share template: {template_id}")
        return template

    def get_template_summaries(
        self, db: Session, *, active_only: bool = True
    ) -> List[dict]:
        """Get lightweight template summaries for UI dropdowns"""
        query = db.query(ShareTemplate)
        
        if active_only:
            query = query.filter(ShareTemplate.is_active == True)
            
        templates = query.all()
        
        return [
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


# Create service instance
share_template_service = ShareTemplateService(ShareTemplate)
