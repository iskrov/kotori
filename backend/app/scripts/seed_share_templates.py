#!/usr/bin/env python3
"""
Seed script to populate the database with default share templates
"""

import sys
import os
from pathlib import Path

# Add the parent directory to the path so we can import from app
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from app.dependencies import get_db
from app.services.share_template_service import share_template_service
try:
    # Prefer updated templates if available
    from app.services.share_template_seed_data_v2 import SEED_TEMPLATES
except Exception:  # pragma: no cover
    from app.services.share_template_seed_data import SEED_TEMPLATES
from app.schemas.share_template import ShareTemplateCreate
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def seed_templates(reset: bool = False):
    """
    Seed the database with default share templates.
    If reset=True, remove existing shares and templates before seeding (dev-only safe).
    """
    
    # Get database session
    db_gen = get_db()
    db: Session = next(db_gen)
    
    try:
        created_count = 0
        skipped_count = 0

        if reset:
            # Remove all shares (dev environment convenience)
            db.execute("DELETE FROM shares")
            # Remove all existing templates to avoid conflicts
            db.execute("DELETE FROM share_templates")
            db.commit()
        
        for template_data in SEED_TEMPLATES:
            template_id = template_data['template_id']
            
            # Check if template already exists
            existing = share_template_service.get_by_template_id(db, template_id=template_id)
            if existing:
                logger.info(f"Template {template_id} already exists, skipping")
                skipped_count += 1
                continue
            
            # Create template
            try:
                template_create = ShareTemplateCreate(**template_data)
                created_template = share_template_service.create_template(db, obj_in=template_create)
                logger.info(f"Created template: {created_template.template_id} - {created_template.name}")
                created_count += 1
                
            except Exception as e:
                logger.error(f"Failed to create template {template_id}: {e}")
                continue
        
        logger.info(f"Seeding completed: {created_count} created, {skipped_count} skipped")
        
    except Exception as e:
        logger.error(f"Seeding failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    logger.info("Starting share template seeding...")
    seed_templates()
    logger.info("Share template seeding completed!")
