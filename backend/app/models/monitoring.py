"""
Monitoring Database Models

This module contains database models for the monitoring system including
system health, service health, alerts, and monitoring configuration.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, JSON, ForeignKey, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime, timezone
import uuid

from app.models.base import Base, TimestampMixin, UUID


class SystemHealth(Base):
    """System health monitoring records"""
    __tablename__ = "system_health"
    
    id = Column(UUID, primary_key=True, default=uuid.uuid4, index=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    overall_status = Column(String(20), nullable=False, index=True)  # healthy, warning, critical
    health_score = Column(Float, nullable=False, index=True)
    
    # System metrics
    cpu_usage = Column(Float, nullable=True)
    memory_usage = Column(Float, nullable=True)
    disk_usage = Column(Float, nullable=True)
    network_usage = Column(Float, nullable=True)
    
    # Application metrics
    active_sessions = Column(Integer, nullable=True)
    request_rate = Column(Float, nullable=True)
    error_rate = Column(Float, nullable=True)
    response_time_p95 = Column(Float, nullable=True)
    
    # Security metrics
    security_events = Column(Integer, nullable=True)
    threat_score = Column(Float, nullable=True)
    
    # Alert metrics
    alert_count = Column(Integer, nullable=True)
    critical_alerts = Column(Integer, nullable=True)
    
    # Additional data
    extra_data = Column(JSON, nullable=True)
    
    # Indexes
    __table_args__ = (
        Index('idx_system_health_timestamp', 'timestamp'),
        Index('idx_system_health_status', 'overall_status'),
        Index('idx_system_health_score', 'health_score'),
    )


class ServiceHealth(Base):
    """Service health monitoring records"""
    __tablename__ = "service_health"
    
    id = Column(UUID, primary_key=True, default=uuid.uuid4, index=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    service_name = Column(String(100), nullable=False, index=True)
    status = Column(String(20), nullable=False, index=True)  # healthy, warning, critical, unknown
    
    # Performance metrics
    response_time_ms = Column(Float, nullable=True)
    uptime_seconds = Column(Integer, nullable=True)
    cpu_usage = Column(Float, nullable=True)
    memory_usage = Column(Float, nullable=True)
    
    # Service-specific metrics
    request_count = Column(Integer, nullable=True)
    error_count = Column(Integer, nullable=True)
    success_rate = Column(Float, nullable=True)
    
    # Health check details
    health_check_passed = Column(Boolean, nullable=True)
    health_check_message = Column(Text, nullable=True)
    dependencies_healthy = Column(Boolean, nullable=True)
    
    # Additional data
    extra_data = Column(JSON, nullable=True)
    
    # Indexes
    __table_args__ = (
        Index('idx_service_health_service_timestamp', 'service_name', 'timestamp'),
        Index('idx_service_health_status', 'status'),
    )


class Alert(Base, TimestampMixin):
    """Alert records"""
    __tablename__ = "alerts"
    
    id = Column(UUID, primary_key=True, default=uuid.uuid4, index=True)
    
    # Alert identification
    alert_type = Column(String(100), nullable=False, index=True)
    severity = Column(String(20), nullable=False, index=True)  # info, warning, error, critical
    status = Column(String(20), nullable=False, index=True)    # active, acknowledged, resolved, suppressed
    
    # Alert content
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    source = Column(String(100), nullable=False, index=True)
    
    # Alert lifecycle
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    acknowledged_by = Column(String(100), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(String(100), nullable=True)
    
    # Escalation
    escalation_level = Column(Integer, nullable=False, default=0)
    escalated_at = Column(DateTime(timezone=True), nullable=True)
    
    # Delivery
    delivery_attempts = Column(Integer, nullable=False, default=0)
    last_delivery_attempt = Column(DateTime(timezone=True), nullable=True)
    delivery_channels = Column(JSON, nullable=True)  # List of channels used
    
    # Metrics
    threat_score = Column(Float, nullable=True)
    confidence = Column(Float, nullable=True)
    impact_score = Column(Float, nullable=True)
    
    # Additional data
    extra_data = Column(JSON, nullable=True)
    tags = Column(JSON, nullable=True)  # List of tags for categorization
    
    # Relationships
    rule_id = Column(UUID, ForeignKey('alert_rules.id'), nullable=True)
    rule = relationship("AlertRule", back_populates="alerts")
    
    # Indexes
    __table_args__ = (
        Index('idx_alerts_type_status', 'alert_type', 'status'),
        Index('idx_alerts_severity', 'severity'),
        Index('idx_alerts_created_at', 'created_at'),
        Index('idx_alerts_source', 'source'),
    )


class AlertRule(Base, TimestampMixin):
    """Alert rule configuration"""
    __tablename__ = "alert_rules"
    
    id = Column(UUID, primary_key=True, default=uuid.uuid4, index=True)
    
    # Rule identification
    rule_id = Column(String(100), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Rule configuration
    enabled = Column(Boolean, nullable=False, default=True)
    condition = Column(Text, nullable=False)  # Rule condition expression
    severity = Column(String(20), nullable=False)  # Default severity
    
    # Suppression and escalation
    suppression_duration = Column(Integer, nullable=False, default=300)  # seconds
    escalation_delay = Column(Integer, nullable=False, default=900)      # seconds
    
    # Delivery configuration
    delivery_channels = Column(JSON, nullable=True)  # List of delivery channels
    delivery_config = Column(JSON, nullable=True)    # Channel-specific configuration
    
    # Additional data
    tags = Column(JSON, nullable=True)
    extra_data = Column(JSON, nullable=True)
    
    # Relationships
    alerts = relationship("Alert", back_populates="rule")
    
    # Indexes
    __table_args__ = (
        Index('idx_alert_rules_enabled', 'enabled'),
        Index('idx_alert_rules_severity', 'severity'),
    )


class AlertChannel(Base, TimestampMixin):
    """Alert delivery channel configuration"""
    __tablename__ = "alert_channels"
    
    id = Column(UUID, primary_key=True, default=uuid.uuid4, index=True)
    
    # Channel identification
    channel_name = Column(String(100), nullable=False, unique=True, index=True)
    channel_type = Column(String(50), nullable=False, index=True)  # email, webhook, console, database
    
    # Channel configuration
    enabled = Column(Boolean, nullable=False, default=True)
    configuration = Column(JSON, nullable=False)  # Channel-specific config
    
    # Retry configuration
    retry_count = Column(Integer, nullable=False, default=3)
    retry_delay = Column(Integer, nullable=False, default=60)  # seconds
    
    # Rate limiting
    rate_limit_count = Column(Integer, nullable=True)
    rate_limit_window = Column(Integer, nullable=True)  # seconds
    
    # Additional data
    extra_data = Column(JSON, nullable=True)
    
    # Indexes
    __table_args__ = (
        Index('idx_alert_channels_enabled', 'enabled'),
        Index('idx_alert_channels_type', 'channel_type'),
    )


class AlertEscalation(Base, TimestampMixin):
    """Alert escalation records"""
    __tablename__ = "alert_escalations"
    
    id = Column(UUID, primary_key=True, default=uuid.uuid4, index=True)
    
    # Escalation identification
    alert_id = Column(UUID, ForeignKey('alerts.id'), nullable=False, index=True)
    escalation_level = Column(Integer, nullable=False)
    
    # Escalation details
    escalation_reason = Column(String(255), nullable=False)
    escalation_action = Column(String(100), nullable=False)
    
    # Escalation results
    escalation_successful = Column(Boolean, nullable=True)
    escalation_message = Column(Text, nullable=True)
    
    # Additional data
    extra_data = Column(JSON, nullable=True)
    
    # Relationships
    alert = relationship("Alert", foreign_keys=[alert_id])
    
    # Indexes
    __table_args__ = (
        Index('idx_alert_escalations_alert_id', 'alert_id'),
        Index('idx_alert_escalations_level', 'escalation_level'),
    )


class MonitoringConfiguration(Base, TimestampMixin):
    """Monitoring system configuration"""
    __tablename__ = "monitoring_configuration"
    
    id = Column(UUID, primary_key=True, default=uuid.uuid4, index=True)
    
    # Configuration identification
    config_key = Column(String(100), nullable=False, unique=True, index=True)
    config_category = Column(String(50), nullable=False, index=True)
    
    # Configuration data
    config_value = Column(JSON, nullable=False)
    config_description = Column(Text, nullable=True)
    
    # Configuration metadata
    is_active = Column(Boolean, nullable=False, default=True)
    config_version = Column(String(20), nullable=False, default="1.0")
    
    # Additional data
    extra_data = Column(JSON, nullable=True)
    
    # Indexes
    __table_args__ = (
        Index('idx_monitoring_config_key', 'config_key'),
        Index('idx_monitoring_config_category', 'config_category'),
    )


class MonitoringMetric(Base):
    """Monitoring metrics storage"""
    __tablename__ = "monitoring_metrics"
    
    id = Column(UUID, primary_key=True, default=uuid.uuid4, index=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    
    # Metric identification
    metric_name = Column(String(100), nullable=False, index=True)
    metric_type = Column(String(50), nullable=False, index=True)
    metric_source = Column(String(100), nullable=False, index=True)
    
    # Metric data
    metric_value = Column(Float, nullable=False)
    metric_unit = Column(String(20), nullable=True)
    
    # Metric metadata
    tags = Column(JSON, nullable=True)
    dimensions = Column(JSON, nullable=True)
    
    # Threshold information
    threshold_exceeded = Column(Boolean, nullable=False, default=False)
    threshold_value = Column(Float, nullable=True)
    
    # Additional data
    extra_data = Column(JSON, nullable=True)
    
    # Indexes
    __table_args__ = (
        Index('idx_monitoring_metrics_name_timestamp', 'metric_name', 'timestamp'),
        Index('idx_monitoring_metrics_type', 'metric_type'),
        Index('idx_monitoring_metrics_source', 'metric_source'),
    )


class MonitoringDashboard(Base, TimestampMixin):
    """Monitoring dashboard configuration"""
    __tablename__ = "monitoring_dashboards"
    
    id = Column(UUID, primary_key=True, default=uuid.uuid4, index=True)
    
    # Dashboard identification
    dashboard_name = Column(String(100), nullable=False, unique=True, index=True)
    dashboard_title = Column(String(255), nullable=False)
    dashboard_description = Column(Text, nullable=True)
    
    # Dashboard configuration
    dashboard_layout = Column(JSON, nullable=False)  # Layout configuration
    dashboard_widgets = Column(JSON, nullable=False)  # Widget configurations
    
    # Dashboard metadata
    is_active = Column(Boolean, nullable=False, default=True)
    is_public = Column(Boolean, nullable=False, default=False)
    refresh_interval = Column(Integer, nullable=False, default=60)  # seconds
    
    # Access control
    created_by = Column(String(100), nullable=True)
    allowed_users = Column(JSON, nullable=True)  # List of allowed users
    
    # Additional data
    extra_data = Column(JSON, nullable=True)
    
    # Indexes
    __table_args__ = (
        Index('idx_monitoring_dashboards_name', 'dashboard_name'),
        Index('idx_monitoring_dashboards_active', 'is_active'),
    ) 