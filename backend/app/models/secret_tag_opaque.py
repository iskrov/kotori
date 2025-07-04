"""
OPAQUE Database Models for Zero-Knowledge Authentication
"""

from sqlalchemy import Column, Integer, String, LargeBinary, ForeignKey, DateTime, Index, Text, Boolean
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime, UTC

from .base import Base, TimestampMixin


class SecretTag(Base, TimestampMixin):
    """OPAQUE Secret Tag model for zero-knowledge authentication"""
    __tablename__ = "secret_tags"

    tag_id = Column(LargeBinary(16), primary_key=True, nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    salt = Column(LargeBinary(16), nullable=False)
    verifier_kv = Column(LargeBinary(32), nullable=False)
    opaque_envelope = Column(LargeBinary, nullable=False)
    tag_name = Column(String(100), nullable=False)
    color_code = Column(String(7), nullable=False, default='#007AFF')

    user = relationship("User", back_populates="secret_tags")
    wrapped_keys = relationship("WrappedKey", back_populates="secret_tag", cascade="all, delete-orphan")
    journal_entries = relationship("JournalEntry", back_populates="secret_tag", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_secret_tags_user_id', 'user_id'),
        Index('idx_secret_tags_tag_lookup', 'tag_id'),
        {"extend_existing": True},
    )


class WrappedKey(Base, TimestampMixin):
    """AES-KW wrapped data encryption keys for vault access"""
    __tablename__ = "wrapped_keys"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), nullable=False)
    tag_id = Column(LargeBinary(16), ForeignKey("secret_tags.tag_id"), nullable=False, index=True)
    vault_id = Column(String(36), nullable=False, index=True)
    wrapped_key = Column(LargeBinary(40), nullable=False)
    key_purpose = Column(String(50), nullable=False, default='vault_data')
    key_version = Column(Integer, nullable=False, default=1)

    secret_tag = relationship("SecretTag", back_populates="wrapped_keys")
    vault_blobs = relationship("VaultBlob", back_populates="wrapped_key", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_wrapped_keys_tag_id', 'tag_id'),
        Index('idx_wrapped_keys_vault_id', 'vault_id'),
        {"extend_existing": True},
    )


class VaultBlob(Base, TimestampMixin):
    """Encrypted content blobs stored in vaults"""
    __tablename__ = "vault_blobs"

    vault_id = Column(String(36), nullable=False, primary_key=True)
    object_id = Column(String(36), nullable=False, primary_key=True)
    wrapped_key_id = Column(String(36), ForeignKey("wrapped_keys.id"), nullable=False, index=True)
    iv = Column(LargeBinary(12), nullable=False)
    ciphertext = Column(LargeBinary, nullable=False)
    auth_tag = Column(LargeBinary(16), nullable=False)
    content_type = Column(String(100), nullable=False, default='application/octet-stream')
    content_size = Column(Integer, nullable=False)

    wrapped_key = relationship("WrappedKey", back_populates="vault_blobs")

    __table_args__ = (
        Index('idx_vault_blobs_vault_id', 'vault_id'),
        Index('idx_vault_blobs_wrapped_key', 'wrapped_key_id'),
        {"extend_existing": True},
    )


class OpaqueSession(Base):
    """OPAQUE authentication session state"""
    __tablename__ = "opaque_sessions"

    session_id = Column(String(64), primary_key=True, nullable=False)
    user_id = Column(String(36), nullable=False, index=True)
    tag_id = Column(LargeBinary(16), nullable=True, index=True)
    session_state = Column(String(20), nullable=False, default='initialized')
    session_data = Column(LargeBinary, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))
    expires_at = Column(DateTime, nullable=False)
    last_activity = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))

    __table_args__ = (
        Index('idx_opaque_sessions_user_id', 'user_id'),
        Index('idx_opaque_sessions_expires_at', 'expires_at'),
        {"extend_existing": True},
    )


class SecurityAuditLog(Base):
    """Security audit log for OPAQUE authentication and system events"""
    __tablename__ = "security_audit_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), nullable=False)
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
    timestamp = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC), index=True)
    processing_time_ms = Column(Integer, nullable=True)  # Request processing time
    
    # Status and outcome
    success = Column(Boolean, nullable=True)  # For events with success/failure outcome
    error_code = Column(String(50), nullable=True)  # Error code if applicable
    
    __table_args__ = (
        Index('idx_audit_event_type_timestamp', 'event_type', 'timestamp'),
        Index('idx_audit_category_severity', 'event_category', 'severity'),
        Index('idx_audit_user_timestamp', 'user_id_hash', 'timestamp'),
        Index('idx_audit_correlation_id', 'correlation_id'),
        Index('idx_audit_timestamp', 'timestamp'),
        {"extend_existing": True},
    )


class SecurityMetrics(Base):
    """Aggregated security metrics for monitoring and alerting"""
    __tablename__ = "security_metrics"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), nullable=False)
    metric_name = Column(String(100), nullable=False, index=True)
    metric_type = Column(String(30), nullable=False)  # counter, gauge, histogram
    
    # Time window
    time_window = Column(String(20), nullable=False)  # 1m, 5m, 15m, 1h, 24h
    window_start = Column(DateTime, nullable=False, index=True)
    window_end = Column(DateTime, nullable=False, index=True)
    
    # Metric values
    value = Column(Integer, nullable=False)
    max_value = Column(Integer, nullable=True)
    min_value = Column(Integer, nullable=True)
    avg_value = Column(Integer, nullable=True)
    
    # Context
    tags = Column(Text, nullable=True)  # JSON with metric tags
    
    # Metadata
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))
    
    __table_args__ = (
        Index('idx_metrics_name_window', 'metric_name', 'window_start'),
        Index('idx_metrics_type_time', 'metric_type', 'window_start'),
        {"extend_existing": True},
    )


class SecurityAlert(Base):
    """Security alerts for real-time threat detection and response"""
    __tablename__ = "security_alerts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), nullable=False)
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
    
    # Timing
    first_seen = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC), index=True)
    last_seen = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))
    resolved_at = Column(DateTime, nullable=True)
    
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
        {"extend_existing": True},
    ) 