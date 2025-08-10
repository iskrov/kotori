"""
OPAQUE Authentication Models

This file contains models specifically for OPAQUE user authentication.
These models are separate from secret-tag functionality which has been removed.

Created: 2025-08-09
Purpose: Restore OPAQUE user authentication after accidental removal in PBI-4 Stage 2
"""

from sqlalchemy import Column, String, LargeBinary, DateTime, Index
from sqlalchemy.sql import func
from datetime import timezone

from .base import Base, TimestampMixin, UUID


class OpaqueSession(Base, TimestampMixin):
    """
    OPAQUE authentication session state for user authentication.
    
    This model manages session state for OPAQUE user registration and login flows.
    It is NOT related to secret-tag functionality which has been removed.
    """
    __tablename__ = "opaque_sessions"

    # Primary key - unique session identifier
    session_id = Column(String(64), primary_key=True, nullable=False)
    
    # User association
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    # Session state management
    session_state = Column(String(64), nullable=False, default='initialized')
    session_data = Column(LargeBinary, nullable=True)
    
    # Session lifecycle
    expires_at = Column(DateTime(timezone=True), nullable=False)
    last_activity = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        Index('idx_opaque_sessions_user_id', 'user_id'),
        Index('idx_opaque_sessions_expires_at', 'expires_at'),
    )
    
    def __repr__(self):
        return f"<OpaqueSession(session_id={self.session_id}, user_id={self.user_id}, state={self.session_state})>"

