"""
OPAQUE Database Models for Zero-Knowledge Authentication
"""

from sqlalchemy import Column, Integer, String, LargeBinary, ForeignKey, DateTime, Index, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from datetime import datetime, timezone

from .base import Base, TimestampMixin, UUID


class SecretTag(Base, TimestampMixin):
    """OPAQUE Secret Tag model for zero-knowledge authentication"""
    __tablename__ = "secret_tags"

    # Use UUID as primary key to match the updated schema
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    # Store the binary phrase hash for OPAQUE lookups
    phrase_hash = Column(LargeBinary(16), nullable=False, unique=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    salt = Column(LargeBinary(16), nullable=False)
    verifier_kv = Column(LargeBinary(32), nullable=False)
    opaque_envelope = Column(LargeBinary, nullable=False)
    tag_name = Column(String(100), nullable=False)
    color_code = Column(String(7), nullable=False, default='#007AFF')

    user = relationship("User", back_populates="secret_tags")
    wrapped_keys = relationship("WrappedKey", back_populates="secret_tag", cascade="all, delete-orphan")
    journal_entries = relationship("JournalEntry", back_populates="secret_tag")

    # Indexes defined in the model for documentation
    __table_args__ = (
        Index('idx_secret_tags_user_id', 'user_id'),
        Index('idx_secret_tags_phrase_hash', 'phrase_hash', unique=True),
        Index('idx_secret_tags_user_tag_name', 'user_id', 'tag_name'),
        Index('idx_secret_tags_user_created', 'user_id', 'created_at'),
    )


class WrappedKey(Base, TimestampMixin):
    """AES-KW wrapped data encryption keys for vault access"""
    __tablename__ = "wrapped_keys"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    # Reference the UUID primary key instead of string
    tag_id = Column(UUID(as_uuid=True), ForeignKey("secret_tags.id"), nullable=False, index=True)
    vault_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    wrapped_key = Column(LargeBinary(40), nullable=False)
    key_purpose = Column(String(50), nullable=False, default='vault_data')
    key_version = Column(Integer, nullable=False, default=1)

    secret_tag = relationship("SecretTag", back_populates="wrapped_keys")
    vault_blobs = relationship("VaultBlob", back_populates="wrapped_key", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_wrapped_keys_tag_id', 'tag_id'),
        Index('idx_wrapped_keys_vault_id', 'vault_id'),
    )


class VaultBlob(Base, TimestampMixin):
    """Encrypted content blobs stored in vaults"""
    __tablename__ = "vault_blobs"

    vault_id = Column(UUID(as_uuid=True), nullable=False, primary_key=True)
    object_id = Column(UUID(as_uuid=True), nullable=False, primary_key=True)
    wrapped_key_id = Column(UUID(as_uuid=True), ForeignKey("wrapped_keys.id"), nullable=False, index=True)
    iv = Column(LargeBinary(12), nullable=False)
    ciphertext = Column(LargeBinary, nullable=False)
    auth_tag = Column(LargeBinary(16), nullable=False)
    content_type = Column(String(100), nullable=False, default='application/octet-stream')
    content_size = Column(Integer, nullable=False)

    wrapped_key = relationship("WrappedKey", back_populates="vault_blobs")

    __table_args__ = (
        Index('idx_vault_blobs_vault_id', 'vault_id'),
        Index('idx_vault_blobs_wrapped_key', 'wrapped_key_id'),
    )


class OpaqueSession(Base, TimestampMixin):
    """OPAQUE authentication session state"""
    __tablename__ = "opaque_sessions"

    session_id = Column(String(64), primary_key=True, nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    # Remove binary_tag_id as it's no longer used with the new schema
    session_state = Column(String(20), nullable=False, default='initialized')
    session_data = Column(LargeBinary, nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    last_activity = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        Index('idx_opaque_sessions_user_id', 'user_id'),
        Index('idx_opaque_sessions_expires_at', 'expires_at'),
    )


class SecurityAuditLog(Base):
    """Security audit log for OPAQUE authentication and system events"""
    __tablename__ = "security_audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    event_type = Column(String(50), nullable=False, index=True)
    event_category = Column(String(30), nullable=False, index=True)  # auth, session, vault, system
    severity = Column(String(20), nullable=False, index=True)  # info, warning, error, critical
    
    # User context (anonymized for privacy)
    user_id_hash = Column(String(64), nullable=True, index=True)  # SHA-256 hash of user ID
    session_id_hash = Column(String(64), nullable=True, index=True)  # SHA-256 hash of session ID
    
    # Request context
    correlation_id = Column(String(36), nullable=True, index=True)  # For tracking related events
    request_id = Column(String(36), nullable=True)
    ip_address_hash = Column(String(64), nullable=True)  # Hashed IP for privacy
    user_agent_hash = Column(String(64), nullable=True)  # Hashed user agent
    
    # Event details (structured JSON)
    event_data = Column(Text, nullable=True)  # JSON with event-specific data
    event_message = Column(String(500), nullable=False)  # Human-readable message
    
    # Security and integrity
    log_signature = Column(String(128), nullable=True)  # HMAC signature for integrity
    is_sensitive = Column(Boolean, nullable=False, default=False)  # Flag for sensitive events
    
    # Timing and metadata
    timestamp = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    processing_time_ms = Column(Integer, nullable=True)  # Request processing time
    
    # Status and outcome
    success = Column(Boolean, nullable=True)  # For operations that can succeed/fail
    error_code = Column(String(50), nullable=True)  # Standardized error codes
    
    # Additional context
    extra_data = Column(Text, nullable=True)  # Additional JSON data
    
    __table_args__ = (
        Index('idx_audit_logs_event_type', 'event_type'),
        Index('idx_audit_logs_category_severity', 'event_category', 'severity'),
        Index('idx_audit_logs_user_time', 'user_id_hash', 'timestamp'),
        Index('idx_audit_logs_correlation', 'correlation_id'),
        Index('idx_audit_logs_timestamp', 'timestamp'),
    )


class SecurityMetrics(Base):
    """Security metrics for monitoring and alerting"""
    __tablename__ = "security_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    metric_name = Column(String(100), nullable=False, index=True)
    metric_value = Column(Integer, nullable=False)
    metric_type = Column(String(50), nullable=False, index=True)  # counter, gauge, histogram
    
    # Time-based metrics
    timestamp = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    time_window = Column(String(20), nullable=False, default='1h')  # 1m, 5m, 1h, 1d
    
    # Categorization
    category = Column(String(50), nullable=False, index=True)  # auth, session, vault, system
    subcategory = Column(String(50), nullable=True, index=True)
    
    # Alerting thresholds
    threshold_value = Column(Integer, nullable=True)
    threshold_type = Column(String(20), nullable=True)  # above, below, equal
    alert_triggered = Column(Boolean, nullable=False, default=False)
    
    # Additional metadata
    dimensions = Column(Text, nullable=True)  # JSON with additional dimensions
    extra_data = Column(Text, nullable=True)  # Additional JSON data
    
    __table_args__ = (
        Index('idx_security_metrics_name_time', 'metric_name', 'timestamp'),
        Index('idx_security_metrics_category', 'category'),
        Index('idx_security_metrics_alert', 'alert_triggered'),
    )


class SecurityAlert(Base):
    """Security alerts for real-time threat detection and response"""
    __tablename__ = "security_alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    alert_type = Column(String(50), nullable=False, index=True)
    severity = Column(String(20), nullable=False, index=True)  # low, medium, high, critical
    status = Column(String(20), nullable=False, default='active', index=True)  # active, investigating, resolved
    
    # Alert details
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    detection_rule = Column(String(100), nullable=False)
    
    # Context
    user_id_hash = Column(String(64), nullable=True, index=True)
    correlation_id = Column(String(36), nullable=True, index=True)
    related_events = Column(Text, nullable=True)  # JSON array of related audit log IDs
    
    # Timing - using timezone-aware timestamps
    first_seen = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    last_seen = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    
    # Response
    response_actions = Column(Text, nullable=True)  # JSON with automated response actions
    manual_notes = Column(Text, nullable=True)
    
    # Metadata
    event_count = Column(Integer, nullable=False, default=1)
    confidence_score = Column(Integer, nullable=False, default=100)  # 0-100
    
    __table_args__ = (
        Index('idx_alerts_type_severity', 'alert_type', 'severity'),
        Index('idx_alerts_status_time', 'status', 'first_seen'),
        Index('idx_alerts_user_time', 'user_id_hash', 'first_seen'),
    ) 