"""
Database Session Factory

Provides a database session factory pattern that allows proper test isolation
and supports both local development and GCP Cloud SQL deployment.
"""

import logging
from typing import Optional, Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from contextlib import contextmanager

from ..core.config import settings

logger = logging.getLogger(__name__)


class DatabaseSessionFactory:
    """
    Database session factory that provides proper session management
    with support for test isolation and GCP Cloud SQL integration.
    """
    
    def __init__(self, database_url: Optional[str] = None):
        """
        Initialize the database session factory.
        
        Args:
            database_url: Optional database URL override (primarily for testing)
        """
        self.database_url = database_url or settings.DATABASE_URL
        self._engine = None
        self._session_factory = None
        self._initialize_engine()
    
    def _initialize_engine(self):
        """Initialize the SQLAlchemy engine with appropriate configuration."""
        try:
            # Configure engine based on environment
            if settings.ENVIRONMENT == "production":
                # Production configuration for GCP Cloud SQL
                self._engine = create_engine(
                    self.database_url,
                    pool_pre_ping=True,  # Handle Cloud SQL connection timeouts
                    pool_recycle=3600,   # Recycle connections every hour
                    pool_size=10,        # Connection pool size
                    max_overflow=20,     # Maximum overflow connections
                    connect_args={
                        "sslmode": "require",
                        "application_name": f"kotori-{settings.ENVIRONMENT}"
                    }
                )
            elif settings.ENVIRONMENT == "test" or self.database_url.startswith("sqlite"):
                # Test configuration with SQLite support
                connect_args = {}
                poolclass = None
                
                if self.database_url.startswith("sqlite"):
                    connect_args = {"check_same_thread": False}
                    poolclass = StaticPool
                
                self._engine = create_engine(
                    self.database_url,
                    poolclass=poolclass,
                    connect_args=connect_args,
                    echo=False  # Disable SQL logging in tests
                )
            else:
                # Development configuration
                self._engine = create_engine(
                    self.database_url,
                    echo=settings.DEBUG,  # Enable SQL logging in debug mode
                    pool_pre_ping=True
                )
            
            # Create session factory
            self._session_factory = sessionmaker(
                autocommit=False,
                autoflush=False,
                bind=self._engine
            )
            
            logger.info(f"Database session factory initialized for {settings.ENVIRONMENT}")
            
        except Exception as e:
            logger.error(f"Failed to initialize database session factory: {e}")
            raise
    
    def get_session(self) -> Session:
        """
        Get a new database session.
        
        Returns:
            SQLAlchemy Session instance
        """
        if not self._session_factory:
            raise RuntimeError("Session factory not initialized")
        
        return self._session_factory()
    
    @contextmanager
    def get_session_context(self) -> Generator[Session, None, None]:
        """
        Get a database session with automatic cleanup.
        
        Yields:
            SQLAlchemy Session instance with automatic cleanup
        """
        session = self.get_session()
        try:
            yield session
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()
    
    def get_engine(self):
        """Get the SQLAlchemy engine."""
        return self._engine
    
    def dispose(self):
        """Dispose of the engine and all connections."""
        if self._engine:
            self._engine.dispose()
            logger.info("Database session factory disposed")
    
    def __call__(self) -> Session:
        """Allow the factory to be called directly to get a session."""
        return self.get_session()


# Global session factory instance
_session_factory: Optional[DatabaseSessionFactory] = None


def get_session_factory() -> DatabaseSessionFactory:
    """
    Get the global database session factory instance.
    
    Returns:
        DatabaseSessionFactory instance
    """
    global _session_factory
    if _session_factory is None:
        _session_factory = DatabaseSessionFactory()
    return _session_factory


def set_session_factory(factory: DatabaseSessionFactory):
    """
    Set the global database session factory instance.
    
    Args:
        factory: DatabaseSessionFactory instance to set as global
    """
    global _session_factory
    _session_factory = factory


def reset_session_factory():
    """Reset the global session factory to default."""
    global _session_factory
    _session_factory = None


# FastAPI dependency function for database sessions
def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency for database sessions.
    
    Yields:
        SQLAlchemy Session instance
    """
    factory = get_session_factory()
    session = factory.get_session()
    try:
        yield session
    finally:
        session.close()


# Backward compatibility function
def get_database_session() -> Session:
    """
    Get a database session (backward compatibility).
    
    Returns:
        SQLAlchemy Session instance
    """
    return get_session_factory().get_session() 