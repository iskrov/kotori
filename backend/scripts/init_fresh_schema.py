#!/usr/bin/env python3
"""
Fresh Schema Initialization Script

This script creates all database tables directly from the current SQLAlchemy models,
bypassing the need to run all historical migrations. Perfect for fresh deployments.
"""

import os
import sys
import logging
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.database import get_database_url, create_engine_from_url
from app.models import Base
from app.models.user import User
from app.models.journal import JournalEntry
from app.models.opaque_auth import OpaqueUserAuth
from app.models.session import Session
from app.models.vault import VaultEntry
from app.models.audit import AuditLog

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def init_fresh_schema():
    """Initialize fresh database schema from current models."""
    
    logger.info("🚀 Starting fresh schema initialization...")
    
    # Get database URL
    database_url = get_database_url()
    logger.info(f"📍 Connecting to database: {database_url.split('@')[1] if '@' in database_url else 'hidden'}")
    
    # Create engine
    engine = create_engine_from_url(database_url)
    
    try:
        # Create all tables
        logger.info("🏗️  Creating all tables from current models...")
        Base.metadata.create_all(engine)
        
        logger.info("✅ Schema initialization completed successfully!")
        logger.info("📊 Tables created:")
        
        # List created tables
        inspector = engine.dialect.get_table_names(engine.connect())
        for table_name in sorted(inspector):
            logger.info(f"   - {table_name}")
            
        return True
        
    except Exception as e:
        logger.error(f"❌ Schema initialization failed: {e}")
        return False
    finally:
        engine.dispose()

def stamp_alembic_head():
    """Mark the database as up-to-date with Alembic."""
    logger.info("🏷️  Stamping Alembic as up-to-date...")
    
    try:
        # Import alembic here to avoid issues if not available
        from alembic.config import Config
        from alembic import command
        
        # Load alembic config
        alembic_cfg = Config(str(backend_dir / "alembic.ini"))
        
        # Stamp the database as head
        command.stamp(alembic_cfg, "head")
        
        logger.info("✅ Alembic stamped successfully!")
        return True
        
    except ImportError:
        logger.warning("⚠️  Alembic not available, skipping stamp")
        return True
    except Exception as e:
        logger.error(f"❌ Alembic stamp failed: {e}")
        return False

if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("🎯 KOTORI FRESH SCHEMA INITIALIZATION")
    logger.info("=" * 60)
    
    # Initialize schema
    if init_fresh_schema():
        # Stamp alembic
        if stamp_alembic_head():
            logger.info("🎉 Fresh schema initialization completed successfully!")
            logger.info("💡 Future migrations will work normally with 'alembic upgrade head'")
            sys.exit(0)
    
    logger.error("💥 Schema initialization failed!")
    sys.exit(1)
