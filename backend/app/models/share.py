import uuid
from sqlalchemy import Boolean, Column, String, Text, Integer, TIMESTAMP
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy import ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .base import Base, TimestampMixin


class Share(Base, TimestampMixin):
    """
    Represents a generated share (summary) that can be accessed via token
    """
    __tablename__ = "shares"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    
    # Share identification
    share_token = Column(String(64), unique=True, nullable=False, index=True)
    title = Column(String(255), nullable=False)
    
    # Content and metadata
    content = Column(JSONB, nullable=False)  # Q&A pairs and metadata
    template_id = Column(String(100), nullable=False)
    target_language = Column(String(10), nullable=False, default='en')
    entry_count = Column(Integer, nullable=False, default=0)
    
    # User and access control
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    access_count = Column(Integer, default=0, nullable=False)
    
    # Expiration and lifecycle
    expires_at = Column(TIMESTAMP(timezone=True), nullable=True)
    last_accessed_at = Column(TIMESTAMP(timezone=True), nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="shares")
    
    def __repr__(self):
        return f"<Share(id={self.id}, token={self.share_token[:8]}..., user_id={self.user_id})>"
    
    @property
    def is_expired(self) -> bool:
        """Check if the share has expired"""
        if not self.expires_at:
            return False
        from datetime import datetime, timezone
        return datetime.now(timezone.utc) > self.expires_at
    
    @property
    def question_count(self) -> int:
        """Get the number of questions in this share"""
        if isinstance(self.content, dict) and 'answers' in self.content:
            return len(self.content['answers'])
        return 0


class ShareAccess(Base, TimestampMixin):
    """
    Tracks access to shares for audit purposes
    """
    __tablename__ = "share_access"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    
    # Share reference
    share_id = Column(UUID(as_uuid=True), ForeignKey("shares.id"), nullable=False, index=True)
    
    # Access metadata
    ip_address_hash = Column(String(64), nullable=True)  # Hashed for privacy
    user_agent_hash = Column(String(64), nullable=True)  # Hashed for privacy
    referrer = Column(String(255), nullable=True)
    access_type = Column(String(20), nullable=False, default='view')  # view, download, email
    # Consent audit (plain text never stored; only counts and timeframe)
    consent_timeframe_start = Column(TIMESTAMP(timezone=True), nullable=True)
    consent_timeframe_end = Column(TIMESTAMP(timezone=True), nullable=True)
    consent_entry_count = Column(Integer, nullable=True)
    consent_acknowledged = Column(Boolean, nullable=True)
    
    # Relationships
    share = relationship("Share", backref="access_logs")
    
    def __repr__(self):
        return f"<ShareAccess(share_id={self.share_id}, type={self.access_type}, created_at={self.created_at})>"
