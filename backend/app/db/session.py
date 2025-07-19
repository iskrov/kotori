"""
Database Session Configuration

This module provides database session configuration using the factory pattern
for proper test isolation and GCP Cloud SQL support.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from typing import Generator

from ..core.config import settings
from .session_factory import get_session_factory, get_db as factory_get_db

# Backward compatibility: Create engine and SessionLocal using factory
def _get_legacy_session_components():
    """Get legacy session components for backward compatibility."""
    factory = get_session_factory()
    return factory.get_engine(), factory._session_factory

# Legacy global instances (for backward compatibility)
engine, SessionLocal = _get_legacy_session_components()


def get_db() -> Generator:
    """
    Database dependency for FastAPI.
    
    This function now uses the session factory pattern for proper
    test isolation while maintaining backward compatibility.
    """
    # Use the factory-based get_db function - yield from the generator
    yield from factory_get_db()


# Backward compatibility functions
def get_database_session():
    """Get a database session (backward compatibility)."""
    factory = get_session_factory()
    return factory.get_session()


def refresh_session_components():
    """Refresh global session components (for testing)."""
    global engine, SessionLocal
    engine, SessionLocal = _get_legacy_session_components()
