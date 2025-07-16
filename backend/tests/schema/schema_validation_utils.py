"""
Schema Validation Utilities for UUID-based Database Testing

This module provides utilities for testing database schema constraints,
foreign key relationships, and business logic enforcement with UUID primary keys.
"""

import uuid
import pytest
from contextlib import contextmanager
from typing import Dict, List, Any, Optional, Union, Callable
from datetime import datetime, timezone
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import IntegrityError, DataError
import psycopg2.errors

from app.core.config import settings
from app.models.user import User
from app.models.journal_entry import JournalEntry
from app.models.tag import Tag
from app.models.reminder import Reminder
from app.models.secret_tag_opaque import SecretTag


class ConstraintViolationError:
    """Represents a database constraint violation for testing."""
    
    def __init__(self, error_type: str, constraint_name: str, message: str, error_code: str = None):
        self.error_type = error_type
        self.constraint_name = constraint_name
        self.message = message
        self.error_code = error_code
    
    def __str__(self):
        return f"{self.error_type}: {self.constraint_name} - {self.message}"


class SchemaValidationTester:
    """Provides utilities for testing database schema constraints."""
    
    def __init__(self, db_url: str = None):
        self.db_url = db_url or settings.DATABASE_URL
        self.engine = create_engine(self.db_url)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
    
    @contextmanager
    def get_session(self):
        """Get a database session with automatic rollback for testing."""
        session = self.SessionLocal()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()
    
    @contextmanager
    def expect_constraint_violation(self, expected_constraint: str = None, 
                                   expected_error_type: str = None):
        """Context manager that expects a constraint violation."""
        try:
            yield
            pytest.fail(f"Expected constraint violation for {expected_constraint}, but none occurred")
        except IntegrityError as e:
            # Parse the constraint violation
            violation = self._parse_constraint_violation(e)
            
            if expected_constraint and expected_constraint not in violation.constraint_name:
                pytest.fail(f"Expected constraint {expected_constraint}, got {violation.constraint_name}")
            
            if expected_error_type and expected_error_type not in violation.error_type:
                pytest.fail(f"Expected error type {expected_error_type}, got {violation.error_type}")
            
            # Return the violation for further inspection
            return violation
        except DataError as e:
            # Handle data type violations
            violation = ConstraintViolationError(
                error_type="DataError",
                constraint_name="data_type",
                message=str(e.orig),
                error_code=e.orig.pgcode if hasattr(e.orig, 'pgcode') else None
            )
            return violation
    
    def _parse_constraint_violation(self, error: IntegrityError) -> ConstraintViolationError:
        """Parse a constraint violation error into a structured format."""
        error_message = str(error.orig)
        error_code = error.orig.pgcode if hasattr(error.orig, 'pgcode') else None
        
        # Determine error type based on PostgreSQL error code
        if error_code == '23505':  # unique_violation
            error_type = "UniqueViolation"
            # Extract constraint name from message
            if 'duplicate key value violates unique constraint' in error_message:
                constraint_name= error_message.split('"')[1] if '"' in error_message else "unknown"
            else:
                constraint_name= "unique_constraint"
        elif error_code == '23503':  # foreign_key_violation
            error_type = "ForeignKeyViolation"
            constraint_name= "foreign_key_constraint"
        elif error_code == '23502':  # not_null_violation
            error_type = "NotNullViolation"
            constraint_name= "not_null_constraint"
        elif error_code == '23514':  # check_violation
            error_type = "CheckViolation"
            constraint_name= "check_constraint"
        else:
            error_type = "IntegrityError"
            constraint_name= "unknown_constraint"
        
        return ConstraintViolationError(
            error_type=error_type,
            constraint_name=constraint_name,
            message=error_message,
            error_code=error_code
        )
    
    def verify_record_exists(self, table_name: str, record_id: uuid.UUID) -> bool:
        """Verify that a record exists in the database."""
        with self.get_session() as session:
            result = session.execute(
                text(f"SELECT 1 FROM {table_name} WHERE id = :id"),
                {"id": record_id}
            ).fetchone()
            return result is not None
    
    def verify_record_count(self, table_name: str, expected_count: int, 
                           condition: str = None, params: Dict[str, Any] = None) -> bool:
        """Verify the number of records in a table."""
        query = f"SELECT COUNT(*) FROM {table_name}"
        if condition:
            query += f" WHERE {condition}"
        
        with self.get_session() as session:
            result = session.execute(text(query), params or {}).fetchone()
            actual_count = result[0] if result else 0
            return actual_count == expected_count
    
    def get_foreign_key_constraints(self, table_name: str) -> List[Dict[str, Any]]:
        """Get foreign key constraints for a table."""
        inspector = inspect(self.engine)
        return inspector.get_foreign_keys(table_name)
    
    def get_unique_constraints(self, table_name: str) -> List[Dict[str, Any]]:
        """Get unique constraints for a table."""
        inspector = inspect(self.engine)
        return inspector.get_unique_constraints(table_name)
    
    def get_check_constraints(self, table_name: str) -> List[Dict[str, Any]]:
        """Get check constraints for a table."""
        inspector = inspect(self.engine)
        try:
            return inspector.get_check_constraints(table_name)
        except NotImplementedError:
            # Some database versions don't support this
            return []
    
    def cleanup_test_data(self, table_name: str, record_ids: List[uuid.UUID]):
        """Clean up test data by IDs."""
        with self.get_session() as session:
            session.execute(
                text(f"DELETE FROM {table_name} WHERE id = ANY(:ids)"),
                {"ids": record_ids}
            )


class ConstraintTestDataGenerator:
    """Generates test data for constraint validation testing."""
    
    @staticmethod
    def generate_valid_user(email: str = None) -> Dict[str, Any]:
        """Generate valid user data."""
        timestamp = datetime.now(timezone.utc)
        return {
            "id": uuid.uuid4(),
            "email": email or f"test_{uuid.uuid4().hex[:8]}@example.com",
            "first_name": "Test",
            "last_name": "User",
            "is_active": True,
            "created_at": timestamp,
            "updated_at": timestamp
        }
    
    @staticmethod
    def generate_invalid_user_data() -> List[Dict[str, Any]]:
        """Generate various invalid user data scenarios."""
        base_user = ConstraintTestDataGenerator.generate_valid_user()
        
        return [
            # Missing required fields
            {**base_user, "email": None},  # NULL email
            {**base_user, "first_name": None},  # NULL first_name
            {**base_user, "last_name": None},  # NULL last_name
            
            # Invalid data types
            {**base_user, "id": "not-a-uuid"},  # Invalid UUID
            {**base_user, "is_active": "not-a-boolean"},  # Invalid boolean
            
            # Constraint violations will be tested separately
        ]
    
    @staticmethod
    def generate_valid_journal(user_id: uuid.UUID, title: str = None) -> Dict[str, Any]:
        """Generate valid journal entry data."""
        timestamp = datetime.now(timezone.utc)
        return {
            "id": uuid.uuid4(),
            "user_id": user_id,
            "title": title or f"Test Journal {uuid.uuid4().hex[:8]}",
            "content": "This is a test journal entry content.",
            "created_at": timestamp,
            "updated_at": timestamp
        }
    
    @staticmethod
    def generate_invalid_journal_data(user_id: uuid.UUID = None) -> List[Dict[str, Any]]:
        """Generate various invalid journal entry data scenarios."""
        valid_user_id = user_id or uuid.uuid4()
        base_journal = ConstraintTestDataGenerator.generate_valid_journal(valid_user_id)
        
        return [
            # Missing required fields
            {**base_journal, "user_id": None},  # NULL user_id
            {**base_journal, "title": None},  # NULL title
            {**base_journal, "content": None},  # NULL content
            
            # Invalid foreign key
            {**base_journal, "user_id": uuid.uuid4()},  # Non-existent user
            
            # Invalid data types
            {**base_journal, "id": "not-a-uuid"},  # Invalid UUID
            {**base_journal, "user_id": "not-a-uuid"},  # Invalid UUID
        ]
    
    @staticmethod
    def generate_valid_tag(journal_id: uuid.UUID, name: str = None) -> Dict[str, Any]:
        """Generate valid tag data."""
        timestamp = datetime.now(timezone.utc)
        return {
            "id": uuid.uuid4(),
            "journal_id": journal_id,
            "name": name or f"test_tag_{uuid.uuid4().hex[:8]}",
            "created_at": timestamp,
            "updated_at": timestamp
        }
    
    @staticmethod
    def generate_invalid_tag_data(journal_id: uuid.UUID = None) -> List[Dict[str, Any]]:
        """Generate various invalid tag data scenarios."""
        valid_journal_id = journal_id or uuid.uuid4()
        base_tag = ConstraintTestDataGenerator.generate_valid_tag(valid_journal_id)
        
        return [
            # Missing required fields
            {**base_tag, "journal_id": None},  # NULL journal_id
            {**base_tag, "name": None},  # NULL name
            
            # Invalid foreign key
            {**base_tag, "journal_id": uuid.uuid4()},  # Non-existent journal
            
            # Invalid data types
            {**base_tag, "id": "not-a-uuid"},  # Invalid UUID
            {**base_tag, "journal_id": "not-a-uuid"},  # Invalid UUID
        ]
    
    @staticmethod
    def generate_valid_reminder(user_id: uuid.UUID, title: str = None) -> Dict[str, Any]:
        """Generate valid reminder data."""
        timestamp = datetime.now(timezone.utc)
        return {
            "id": uuid.uuid4(),
            "user_id": user_id,
            "title": title or f"Test Reminder {uuid.uuid4().hex[:8]}",
            "description": "This is a test reminder description.",
            "due_date": timestamp,
            "is_completed": False,
            "created_at": timestamp,
            "updated_at": timestamp
        }
    
    @staticmethod
    def generate_invalid_reminder_data(user_id: uuid.UUID = None) -> List[Dict[str, Any]]:
        """Generate various invalid reminder data scenarios."""
        valid_user_id = user_id or uuid.uuid4()
        base_reminder = ConstraintTestDataGenerator.generate_valid_reminder(valid_user_id)
        
        return [
            # Missing required fields
            {**base_reminder, "user_id": None},  # NULL user_id
            {**base_reminder, "title": None},  # NULL title
            {**base_reminder, "due_date": None},  # NULL due_date
            
            # Invalid foreign key
            {**base_reminder, "user_id": uuid.uuid4()},  # Non-existent user
            
            # Invalid data types
            {**base_reminder, "id": "not-a-uuid"},  # Invalid UUID
            {**base_reminder, "user_id": "not-a-uuid"},  # Invalid UUID
            {**base_reminder, "is_completed": "not-a-boolean"},  # Invalid boolean
        ]
    
    @staticmethod
    def generate_valid_secret_tag(journal_id: uuid.UUID, name: str = None) -> Dict[str, Any]:
        """Generate valid secret tag data."""
        timestamp = datetime.now(timezone.utc)
        return {
            "id": uuid.uuid4(),
            "journal_id": journal_id,
            "name": name or f"secret_tag_{uuid.uuid4().hex[:8]}",
            "created_at": timestamp,
            "updated_at": timestamp
        }
    
    @staticmethod
    def generate_invalid_secret_tag_data(journal_id: uuid.UUID = None) -> List[Dict[str, Any]]:
        """Generate various invalid secret tag data scenarios."""
        valid_journal_id = journal_id or uuid.uuid4()
        base_secret_tag = ConstraintTestDataGenerator.generate_valid_secret_tag(valid_journal_id)
        
        return [
            # Missing required fields
            {**base_secret_tag, "journal_id": None},  # NULL journal_id
            {**base_secret_tag, "name": None},  # NULL name
            
            # Invalid foreign key
            {**base_secret_tag, "journal_id": uuid.uuid4()},  # Non-existent journal
            
            # Invalid data types
            {**base_secret_tag, "id": "not-a-uuid"},  # Invalid UUID
            {**base_secret_tag, "journal_id": "not-a-uuid"},  # Invalid UUID
        ]


class CascadeTestHelper:
    """Helper class for testing cascade operations."""
    
    def __init__(self, schema_tester: SchemaValidationTester):
        self.schema_tester = schema_tester
    
    def create_test_hierarchy(self) -> Dict[str, Any]:
        """Create a test data hierarchy for cascade testing."""
        # Create user
        user_data = ConstraintTestDataGenerator.generate_valid_user()
        
        with self.schema_tester.get_session() as session:
            session.execute(text("""
                INSERT INTO users (id, email, first_name, last_name, is_active, created_at, updated_at)
                VALUES (:id, :email, :first_name, :last_name, :is_active, :created_at, :updated_at)
            """), user_data)
        
        # Create journal entries
        journal_data = [
            ConstraintTestDataGenerator.generate_valid_journal(user_data["id"]),
            ConstraintTestDataGenerator.generate_valid_journal(user_data["id"])
        ]
        
        with self.schema_tester.get_session() as session:
            for journal in journal_data:
                session.execute(text("""
                    INSERT INTO journal_entries (id, user_id, title, content, created_at, updated_at)
                    VALUES (:id, :user_id, :title, :content, :created_at, :updated_at)
                """), journal)
        
        # Create tags and secret tags
        tag_data = []
        secret_tag_data = []
        
        for journal in journal_data:
            # Create tags for each journal
            for i in range(2):
                tag = ConstraintTestDataGenerator.generate_valid_tag(journal["id"])
                tag_data.append(tag)
                
                secret_tag = ConstraintTestDataGenerator.generate_valid_secret_tag(journal["id"])
                secret_tag_data.append(secret_tag)
        
        with self.schema_tester.get_session() as session:
            for tag in tag_data:
                session.execute(text("""
                    INSERT INTO tags (id, journal_id, name, created_at, updated_at)
                    VALUES (:id, :journal_id, :name, :created_at, :updated_at)
                """), tag)
            
            for secret_tag in secret_tag_data:
                session.execute(text("""
                    INSERT INTO secret_tags (id, journal_id, name, created_at, updated_at)
                    VALUES (:id, :journal_id, :name, :created_at, :updated_at)
                """), secret_tag)
        
        # Create reminders
        reminder_data = [
            ConstraintTestDataGenerator.generate_valid_reminder(user_data["id"]),
            ConstraintTestDataGenerator.generate_valid_reminder(user_data["id"])
        ]
        
        with self.schema_tester.get_session() as session:
            for reminder in reminder_data:
                session.execute(text("""
                    INSERT INTO reminders (id, user_id, title, description, due_date, is_completed, created_at, updated_at)
                    VALUES (:id, :user_id, :title, :description, :due_date, :is_completed, :created_at, :updated_at)
                """), reminder)
        
        return {
            "user": user_data,
            "journals": journal_data,
            "tags": tag_data,
            "secret_tags": secret_tag_data,
            "reminders": reminder_data
        }
    
    def verify_cascade_deletion(self, hierarchy: Dict[str, Any], deleted_entity: str):
        """Verify that cascade deletion worked correctly."""
        user_id = hierarchy["user"]["id"]
        journal_ids = [j["id"] for j in hierarchy["journals"]]
        tag_ids = [t["id"] for t in hierarchy["tags"]]
        secret_tag_ids = [st["id"] for st in hierarchy["secret_tags"]]
        reminder_ids = [r["id"] for r in hierarchy["reminders"]]
        
        if deleted_entity == "user":
            # When user is deleted, all related records should be deleted
            assert not self.schema_tester.verify_record_exists("users", user_id)
            
            for journal_id in journal_ids:
                assert not self.schema_tester.verify_record_exists("journal_entries", journal_id)
            
            for tag_id in tag_ids:
                assert not self.schema_tester.verify_record_exists("tags", tag_id)
            
            for secret_tag_id in secret_tag_ids:
                assert not self.schema_tester.verify_record_exists("secret_tags", secret_tag_id)
            
            for reminder_id in reminder_ids:
                assert not self.schema_tester.verify_record_exists("reminders", reminder_id)
        
        elif deleted_entity == "journal":
            # When journal is deleted, only tags and secret_tags should be deleted
            assert self.schema_tester.verify_record_exists("users", user_id)
            
            for journal_id in journal_ids:
                assert not self.schema_tester.verify_record_exists("journal_entries", journal_id)
            
            for tag_id in tag_ids:
                assert not self.schema_tester.verify_record_exists("tags", tag_id)
            
            for secret_tag_id in secret_tag_ids:
                assert not self.schema_tester.verify_record_exists("secret_tags", secret_tag_id)
            
            # Reminders should still exist
            for reminder_id in reminder_ids:
                assert self.schema_tester.verify_record_exists("reminders", reminder_id) 