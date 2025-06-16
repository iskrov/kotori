from sqlalchemy import Column
from sqlalchemy import DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from sqlalchemy import String, TypeDecorator
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
import uuid

Base = declarative_base()


class UUID(TypeDecorator):
    """
    Platform-independent UUID type.
    Uses PostgreSQL UUID when available, otherwise falls back to String for SQLite.
    """
    impl = String
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(PostgreSQLUUID(as_uuid=True))
        else:
            return dialect.type_descriptor(String(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        elif dialect.name == 'postgresql':
            return value
        else:
            return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        elif dialect.name == 'postgresql':
            return value
        else:
            return uuid.UUID(value)


class TimestampMixin:
    """Mixin for adding created_at and updated_at timestamps to models"""

    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
