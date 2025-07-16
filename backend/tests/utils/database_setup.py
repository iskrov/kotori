"""
Test Database Setup Utilities

This module provides utilities for setting up and tearing down test databases
with proper schema initialization, data seeding, and cleanup.
"""

import os
import asyncio
import logging
from typing import Optional, Dict, Any, List
from pathlib import Path
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
import pytest
import uuid
from datetime import datetime, timedelta, UTC

# Import models to ensure they're registered
from app.models.user import User
from app.models.journal_entry import JournalEntry
from app.models.tag import Tag
from app.models.reminder import Reminder
from app.models.secret_tag_opaque import SecretTag, WrappedKey, VaultBlob, OpaqueSession
from app.core.config import settings
from app.models.base import Base
from app.db.session import get_db
from app.core.config import settings

logger = logging.getLogger(__name__)

class TestDatabaseManager:
    """Manages test database lifecycle and setup"""
    
    def __init__(self, test_db_name: str = "test_vibes"):
        self.settings = settings
        self.test_db_name = test_db_name
        self.admin_db_url = self._get_admin_db_url()
        self.test_db_url = self._get_test_db_url()
        self.engine: Optional[AsyncEngine] = None
        self.session_factory: Optional[sessionmaker] = None
        
    def _get_admin_db_url(self) -> str:
        """Get database URL for admin operations (creating/dropping databases)"""
        # Connect to postgres database for admin operations
        base_url = self.settings.database_url
        if base_url.startswith("postgresql://"):
            base_url = base_url.replace("postgresql://", "postgresql+asyncpg://")
        elif not base_url.startswith("postgresql+asyncpg://"):
            base_url = f"postgresql+asyncpg://{base_url}"
        
        # Replace database name with 'postgres' for admin operations
        parts = base_url.split('/')
        if len(parts) > 3:
            parts[-1] = 'postgres'
        return '/'.join(parts)
    
    def _get_test_db_url(self) -> str:
        """Get database URL for test database"""
        base_url = self.settings.database_url
        if base_url.startswith("postgresql://"):
            base_url = base_url.replace("postgresql://", "postgresql+asyncpg://")
        elif not base_url.startswith("postgresql+asyncpg://"):
            base_url = f"postgresql+asyncpg://{base_url}"
        
        # Replace database name with test database name
        parts = base_url.split('/')
        if len(parts) > 3:
            parts[-1] = self.test_db_name
        return '/'.join(parts)
    
    async def create_test_database(self) -> bool:
        """Create the test database if it doesn't exist"""
        try:
            # Connect to postgres database to create test database
            admin_engine = create_async_engine(self.admin_db_url, isolation_level="AUTOCOMMIT")
            
            async with admin_engine.connect() as conn:
                # Check if database exists
                result = await conn.execute(sa.text(
                    "SELECT 1 FROM pg_database WHERE datname = :dbname"
                ), {"dbname": self.test_db_name})
                
                if not result.fetchone():
                    # Create database
                    await conn.execute(sa.text(f"CREATE DATABASE {self.test_db_name}"))
                    logger.info(f"Created test database: {self.test_db_name}")
                else:
                    logger.info(f"Test database already exists: {self.test_db_name}")
            
            await admin_engine.dispose()
            return True
            
        except Exception as e:
            logger.error(f"Error creating test database: {e}")
            return False
    
    async def drop_test_database(self) -> bool:
        """Drop the test database"""
        try:
            # Connect to postgres database to drop test database
            admin_engine = create_async_engine(self.admin_db_url, isolation_level="AUTOCOMMIT")
            
            async with admin_engine.connect() as conn:
                # Terminate existing connections to the test database
                await conn.execute(sa.text(f"""
                    SELECT pg_terminate_backend(pg_stat_activity.pid)
                    FROM pg_stat_activity
                    WHERE pg_stat_activity.datname = '{self.test_db_name}'
                    AND pid <> pg_backend_pid()
                """))
                
                # Drop database
                await conn.execute(sa.text(f"DROP DATABASE IF EXISTS {self.test_db_name}"))
                logger.info(f"Dropped test database: {self.test_db_name}")
            
            await admin_engine.dispose()
            return True
            
        except Exception as e:
            logger.error(f"Error dropping test database: {e}")
            return False
    
    async def initialize_schema(self) -> bool:
        """Initialize database schema using SQLAlchemy"""
        try:
            # Create all tables directly using SQLAlchemy
            from sqlalchemy import create_engine
            sync_test_db_url = self.test_db_url.replace("postgresql+asyncpg://", "postgresql://")
            engine = create_engine(sync_test_db_url)
            
            # Create all tables
            Base.metadata.create_all(engine)
            
            logger.info("Successfully initialized test database schema")
            return True
                
        except Exception as e:
            logger.error(f"Error initializing schema: {e}")
            return False
    
    async def setup_engine_and_session(self) -> bool:
        """Set up database engine and session factory"""
        try:
            self.engine = create_async_engine(
                self.test_db_url,
                echo=False,  # Set to True for SQL debugging
                pool_pre_ping=True,
                pool_recycle=300
            )
            
            self.session_factory = sessionmaker(
                bind=self.engine,
                class_=AsyncSession,
                expire_on_commit=False
            )
            
            logger.info("Database engine and session factory configured")
            return True
            
        except Exception as e:
            logger.error(f"Error setting up engine and session: {e}")
            return False
    
    async def get_session(self) -> AsyncSession:
        """Get a database session"""
        if not self.session_factory:
            raise RuntimeError("Database not initialized. Call setup_engine_and_session first.")
        
        return self.session_factory()
    
    async def cleanup_tables(self) -> bool:
        """Clean up all tables for test isolation"""
        try:
            if not self.engine:
                return False
            
            async with self.engine.connect() as conn:
                # Get all table names
                result = await conn.execute(sa.text("""
                    SELECT tablename FROM pg_tables 
                    WHERE schemaname = 'public' 
                    AND tablename NOT LIKE 'schema_migrations'
                """))
                
                tables = [row[0] for row in result.fetchall()]
                
                # Disable foreign key constraints temporarily
                await conn.execute(sa.text("SET session_replication_role = replica"))
                
                # Truncate all tables
                for table in tables:
                    await conn.execute(sa.text(f"TRUNCATE TABLE {table} CASCADE"))
                
                # Re-enable foreign key constraints
                await conn.execute(sa.text("SET session_replication_role = DEFAULT"))
                
                await conn.commit()
                logger.info("Cleaned up all test tables")
                return True
                
        except Exception as e:
            logger.error(f"Error cleaning up tables: {e}")
            return False
    
    async def seed_test_data(self, seed_config: Dict[str, Any] = None) -> bool:
        """Seed database with test data"""
        try:
            if not seed_config:
                seed_config = self._get_default_seed_config()
            
            async with self.get_session() as session:
                # Create test users
                test_users = await self._create_test_users(session, seed_config.get('users', []))
                
                # Create test entries
                if seed_config.get('entries'):
                    await self._create_test_entries(session, test_users, seed_config['entries'])
                
                # Create test secret tags
                if seed_config.get('secret_tags'):
                    await self._create_test_secret_tags(session, test_users, seed_config['secret_tags'])
                
                await session.commit()
                logger.info("Successfully seeded test data")
                return True
                
        except Exception as e:
            logger.error(f"Error seeding test data: {e}")
            return False
    
    def _get_default_seed_config(self) -> Dict[str, Any]:
        """Get default seed configuration"""
        return {
            'users': [
                {
                    'email': 'test@example.com',
                    'display_name': 'Test User',
                    'phone': '+1234567890',
                    'is_active': True
                },
                {
                    'email': 'admin@example.com',
                    'display_name': 'Admin User',
                    'phone': '+1234567891',
                    'is_active': True
                }
            ],
            'entries': [
                {
                    'title': 'Test Entry 1',
                    'content': 'This is a test entry for testing purposes',
                    'user_index': 0
                }
            ],
            'secret_tags': [
                {
                    'phrase_hash': b'test_phrase_hash_16',  # 16 bytes
                    'salt': b'test_salt_32_bytes_for_testing_01',  # 32 bytes
                    'verifier_kv': b'test_verifier_data',
                    'user_index': 0
                }
            ]
        }
    
    async def _create_test_users(self, session: AsyncSession, user_configs: List[Dict[str, Any]]) -> List[User]:
        """Create test users"""
        users = []
        
        for config in user_configs:
            user = User(
                id=uuid.uuid4(),
                email=config['email'],
                display_name=config['display_name'],
                phone=config.get('phone'),
                is_active=config.get('is_active', True),
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC)
            )
            
            session.add(user)
            users.append(user)
        
        await session.flush()  # Ensure IDs are available
        return users
    
    async def _create_test_entries(self, session: AsyncSession, users: List[User], entry_configs: List[Dict[str, Any]]):
        """Create test entries"""
        for config in entry_configs:
            user = users[config['user_index']]
            
            entry = JournalEntry(
                id=uuid.uuid4(),
                title=config['title'],
                content=config['content'],
                user_id=user.id,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC)
            )
            
            session.add(entry)
        
        await session.flush()
    
    async def _create_test_secret_tags(self, session: AsyncSession, users: List[User], secret_tag_configs: List[Dict[str, Any]]):
        """Create test secret tags"""
        for config in secret_tag_configs:
            user = users[config['user_index']]
            
            secret_tag = SecretTag(
                id=uuid.uuid4(),
                phrase_hash=config['phrase_hash'],
                salt=config['salt'],
                verifier_kv=config['verifier_kv'],
                user_id=user.id,
                is_active=config.get('is_active', True),
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC)
            )
            
            session.add(secret_tag)
        
        await session.flush()
    
    async def close(self):
        """Close database connections"""
        if self.engine:
            await self.engine.dispose()
            self.engine = None
            self.session_factory = None
            logger.info("Database connections closed")


# Global test database manager instance
_test_db_manager: Optional[TestDatabaseManager] = None


async def get_test_db_manager() -> TestDatabaseManager:
    """Get the global test database manager"""
    global _test_db_manager
    
    if _test_db_manager is None:
        _test_db_manager = TestDatabaseManager()
    
    return _test_db_manager


async def setup_test_database() -> TestDatabaseManager:
    """Set up the test database for testing"""
    db_manager = await get_test_db_manager()
    
    # Create test database
    await db_manager.create_test_database()
    
    # Initialize schema
    await db_manager.initialize_schema()
    
    # Set up engine and session
    await db_manager.setup_engine_and_session()
    
    return db_manager


async def cleanup_test_database():
    """Clean up the test database"""
    db_manager = await get_test_db_manager()
    
    # Clean up tables
    await db_manager.cleanup_tables()


async def teardown_test_database():
    """Tear down the test database completely"""
    db_manager = await get_test_db_manager()
    
    # Close connections
    await db_manager.close()
    
    # Drop test database
    await db_manager.drop_test_database()


# Pytest fixtures
@pytest.fixture(scope="session")
async def test_db_manager():
    """Session-scoped test database manager"""
    manager = await setup_test_database()
    yield manager
    await teardown_test_database()


@pytest.fixture(scope="function")
async def db_session(test_db_manager):
    """Function-scoped database session with cleanup"""
    # Clean up before each test
    await test_db_manager.cleanup_tables()
    
    # Provide session
    async with test_db_manager.get_session() as session:
        yield session
        await session.rollback()


@pytest.fixture(scope="function")
async def seeded_db_session(test_db_manager):
    """Function-scoped database session with seeded test data"""
    # Clean up and seed data
    await test_db_manager.cleanup_tables()
    await test_db_manager.seed_test_data()
    
    # Provide session
    async with test_db_manager.get_session() as session:
        yield session
        await session.rollback()


# Utility functions for tests
async def create_test_user(session: AsyncSession, **kwargs) -> User:
    """Create a test user with default values"""
    defaults = {
        'id': uuid.uuid4(),
        'email': 'test@example.com',
        'display_name': 'Test User',
        'phone': '+1234567890',
        'is_active': True,
        'created_at': datetime.now(UTC),
        'updated_at': datetime.now(UTC)
    }
    defaults.update(kwargs)
    
    user = User(**defaults)
    session.add(user)
    await session.flush()
    return user


async def create_test_secret_tag(session: AsyncSession, user: User, **kwargs) -> SecretTag:
    """Create a test secret tag with default values"""
    defaults = {
        'id': uuid.uuid4(),
        'phrase_hash': b'test_phrase_hash_16',  # 16 bytes
        'salt': b'test_salt_32_bytes_for_testing_01',  # 32 bytes
        'verifier_kv': b'test_verifier_data',
        'user_id': user.id,
        'is_active': True,
        'created_at': datetime.now(UTC),
        'updated_at': datetime.now(UTC)
    }
    defaults.update(kwargs)
    
    secret_tag = SecretTag(**defaults)
    session.add(secret_tag)
    await session.flush()
    return secret_tag 