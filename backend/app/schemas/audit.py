"""
Security Audit Logging Schemas

Pydantic models for security audit logging API requests and responses.
"""

from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum


class EventCategory(str, Enum):
    """Audit event categories"""
    AUTH = "auth"
    SESSION = "session"
    VAULT = "vault"
    SYSTEM = "system"
    SECURITY = "security"


class EventSeverity(str, Enum):
    """Audit event severity levels"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class AuditLogRequest(BaseModel):
    """Request to create an audit log entry"""
    event_type: str = Field(..., description="Type of event being logged")
    event_category: EventCategory = Field(..., description="Category of the event")
    severity: EventSeverity = Field(..., description="Severity level of the event")
    message: str = Field(..., max_length=500, description="Human-readable event message")
    
    user_id: Optional[str] = Field(None, description="User identifier (will be hashed)")
    session_id: Optional[str] = Field(None, description="Session identifier (will be hashed)")
    correlation_id: Optional[str] = Field(None, description="Correlation ID for tracking related events")
    request_id: Optional[str] = Field(None, description="Request identifier")
    ip_address: Optional[str] = Field(None, description="Client IP address (will be hashed)")
    user_agent: Optional[str] = Field(None, description="Client user agent (will be hashed)")
    
    event_data: Optional[Dict[str, Any]] = Field(None, description="Additional event data")
    success: Optional[bool] = Field(None, description="Whether the event represents success")
    error_code: Optional[str] = Field(None, description="Error code if applicable")
    processing_time_ms: Optional[int] = Field(None, ge=0, description="Processing time in milliseconds")
    is_sensitive: bool = Field(False, description="Whether this event contains sensitive information")
    
    @field_validator('event_type')
    @classmethod
    def validate_event_type(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Event type cannot be empty')
        return v.strip()
    
    @field_validator('message')
    @classmethod
    def validate_message(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Event message cannot be empty')
        return v.strip()
    
    model_config = ConfigDict(
        json_schema_extra = {
            "example": {
                "event_type": "opaque_login_finish",
                "event_category": "auth",
                "severity": "info",
                "message": "OPAQUE authentication completed successfully",
                "user_id": "user@example.com",
                "correlation_id": "12345678-1234-1234-1234-123456789012",
                "success": True,
                "processing_time_ms": 150
            }
        })


class AuditLogResponse(BaseModel):
    """Response for audit log creation"""
    success: bool = Field(..., description="Whether the log entry was created successfully")
    log_id: Optional[str] = Field(None, description="ID of the created log entry")
    correlation_id: Optional[str] = Field(None, description="Correlation ID for the event")
    message: str = Field(..., description="Status message")
    
    model_config = ConfigDict(
        json_schema_extra = {
            "example": {
                "success": True,
                "log_id": "87654321-4321-4321-4321-210987654321",
                "correlation_id": "12345678-1234-1234-1234-123456789012",
                "message": "Audit log entry created successfully"
            }
        })


class AuditLogEntry(BaseModel):
    """Audit log entry information"""
    id: str = Field(..., description="Unique log entry identifier")
    event_type: str = Field(..., description="Type of event")
    event_category: str = Field(..., description="Category of event")
    severity: str = Field(..., description="Severity level")
    
    user_id_hash: Optional[str] = Field(None, description="Hashed user identifier")
    session_id_hash: Optional[str] = Field(None, description="Hashed session identifier")
    correlation_id: Optional[str] = Field(None, description="Correlation ID")
    request_id: Optional[str] = Field(None, description="Request identifier")
    
    event_message: str = Field(..., description="Human-readable event message")
    event_data: Optional[Dict[str, Any]] = Field(None, description="Event-specific data")
    
    success: Optional[bool] = Field(None, description="Success status")
    error_code: Optional[str] = Field(None, description="Error code")
    processing_time_ms: Optional[int] = Field(None, description="Processing time")
    
    timestamp: datetime = Field(..., description="Event timestamp")
    is_sensitive: bool = Field(..., description="Whether event is sensitive")
    
    model_config = ConfigDict(
        json_schema_extra = {
            "example": {
                "id": "87654321-4321-4321-4321-210987654321",
                "event_type": "opaque_login_finish",
                "event_category": "auth",
                "severity": "info",
                "user_id_hash": "a1b2c3d4e5f6...",
                "correlation_id": "12345678-1234-1234-1234-123456789012",
                "event_message": "OPAQUE authentication completed successfully",
                "success": True,
                "timestamp": "2025-01-20T03:30:00Z",
                "is_sensitive": False
            }
        })


class AuditLogListRequest(BaseModel):
    """Request to list audit log entries"""
    user_id: Optional[str] = Field(None, description="Filter by user ID")
    event_category: Optional[EventCategory] = Field(None, description="Filter by event category")
    event_type: Optional[str] = Field(None, description="Filter by event type")
    severity: Optional[EventSeverity] = Field(None, description="Filter by severity")
    start_time: Optional[datetime] = Field(None, description="Filter by start time")
    end_time: Optional[datetime] = Field(None, description="Filter by end time")
    limit: int = Field(100, ge=1, le=1000, description="Maximum number of results")
    offset: int = Field(0, ge=0, description="Number of results to skip")
    
    model_config = ConfigDict(
        json_schema_extra = {
            "example": {
                "event_category": "auth",
                "severity": "warning",
                "start_time": "2025-01-20T00:00:00Z",
                "limit": 50,
                "offset": 0
            }
        })


class AuditLogListResponse(BaseModel):
    """Response for audit log listing"""
    logs: List[AuditLogEntry] = Field(..., description="List of audit log entries")
    total_count: int = Field(..., description="Total number of matching entries")
    has_more: bool = Field(..., description="Whether there are more entries available")
    
    model_config = ConfigDict(
        json_schema_extra = {
            "example": {
                "logs": [
                    {
                        "id": "87654321-4321-4321-4321-210987654321",
                        "event_type": "opaque_login_finish",
                        "event_category": "auth",
                        "severity": "info",
                        "event_message": "OPAQUE authentication completed successfully",
                        "timestamp": "2025-01-20T03:30:00Z",
                        "is_sensitive": False
                    }
                ],
                "total_count": 1,
                "has_more": False
            }
        })


class SecurityMetricsRequest(BaseModel):
    """Request for security metrics"""
    metric_names: Optional[List[str]] = Field(None, description="Specific metrics to retrieve")
    time_window: Optional[str] = Field("1h", description="Time window for metrics")
    start_time: Optional[datetime] = Field(None, description="Start time for metrics")
    end_time: Optional[datetime] = Field(None, description="End time for metrics")
    
    @field_validator('time_window')
    @classmethod
    def validate_time_window(cls, v):
        valid_windows = ['1m', '5m', '15m', '1h', '24h']
        if v not in valid_windows:
            raise ValueError(f'Time window must be one of: {valid_windows}')
        return v
    
    model_config = ConfigDict(
        json_schema_extra = {
            "example": {
                "metric_names": ["auth_failures", "brute_force_attempts"],
                "time_window": "1h",
                "start_time": "2025-01-20T02:00:00Z"
            }
        })


class SecurityMetric(BaseModel):
    """Security metric information"""
    metric_name: str = Field(..., description="Name of the metric")
    metric_type: str = Field(..., description="Type of metric")
    time_window: str = Field(..., description="Time window for the metric")
    value: int = Field(..., description="Metric value")
    max_value: Optional[int] = Field(None, description="Maximum value in window")
    min_value: Optional[int] = Field(None, description="Minimum value in window")
    avg_value: Optional[int] = Field(None, description="Average value in window")
    window_start: datetime = Field(..., description="Window start time")
    window_end: datetime = Field(..., description="Window end time")
    
    model_config = ConfigDict(
        json_schema_extra = {
            "example": {
                "metric_name": "auth_failures",
                "metric_type": "counter",
                "time_window": "1h",
                "value": 15,
                "max_value": 5,
                "min_value": 0,
                "avg_value": 2,
                "window_start": "2025-01-20T02:00:00Z",
                "window_end": "2025-01-20T03:00:00Z"
            }
        })


class SecurityMetricsResponse(BaseModel):
    """Response for security metrics"""
    metrics: List[SecurityMetric] = Field(..., description="List of security metrics")
    time_range: Dict[str, datetime] = Field(..., description="Time range for metrics")
    
    model_config = ConfigDict(
        json_schema_extra = {
            "example": {
                "metrics": [
                    {
                        "metric_name": "auth_failures",
                        "metric_type": "counter",
                        "time_window": "1h",
                        "value": 15,
                        "window_start": "2025-01-20T02:00:00Z",
                        "window_end": "2025-01-20T03:00:00Z"
                    }
                ],
                "time_range": {
                    "start": "2025-01-20T02:00:00Z",
                    "end": "2025-01-20T03:00:00Z"
                }
            }
        })


class SecurityAlertRequest(BaseModel):
    """Request to create a security alert"""
    alert_type: str = Field(..., description="Type of security alert")
    severity: EventSeverity = Field(..., description="Alert severity")
    title: str = Field(..., max_length=200, description="Alert title")
    description: str = Field(..., description="Alert description")
    detection_rule: str = Field(..., description="Detection rule that triggered the alert")
    
    user_id: Optional[str] = Field(None, description="Associated user ID")
    correlation_id: Optional[str] = Field(None, description="Correlation ID")
    related_events: Optional[List[str]] = Field(None, description="Related audit log entry IDs")
    confidence_score: int = Field(100, ge=0, le=100, description="Confidence score (0-100)")
    
    model_config = ConfigDict(
        json_schema_extra = {
            "example": {
                "alert_type": "brute_force_attack",
                "severity": "critical",
                "title": "Brute Force Attack Detected",
                "description": "Multiple failed authentication attempts detected",
                "detection_rule": "auth_failure_threshold",
                "confidence_score": 95
            }
        })


class SecurityAlert(BaseModel):
    """Security alert information"""
    id: str = Field(..., description="Alert identifier")
    alert_type: str = Field(..., description="Type of alert")
    severity: str = Field(..., description="Alert severity")
    status: str = Field(..., description="Alert status")
    title: str = Field(..., description="Alert title")
    description: str = Field(..., description="Alert description")
    detection_rule: str = Field(..., description="Detection rule")
    
    user_id_hash: Optional[str] = Field(None, description="Hashed user ID")
    correlation_id: Optional[str] = Field(None, description="Correlation ID")
    
    first_seen: datetime = Field(..., description="First occurrence time")
    last_seen: datetime = Field(..., description="Last occurrence time")
    event_count: int = Field(..., description="Number of related events")
    confidence_score: int = Field(..., description="Confidence score")
    
    model_config = ConfigDict(
        json_schema_extra = {
            "example": {
                "id": "alert-12345678-1234-1234-1234-123456789012",
                "alert_type": "brute_force_attack",
                "severity": "critical",
                "status": "active",
                "title": "Brute Force Attack Detected",
                "description": "Multiple failed authentication attempts detected",
                "detection_rule": "auth_failure_threshold",
                "first_seen": "2025-01-20T03:00:00Z",
                "last_seen": "2025-01-20T03:15:00Z",
                "event_count": 8,
                "confidence_score": 95
            }
        })


class SecurityAlertsResponse(BaseModel):
    """Response for security alerts listing"""
    alerts: List[SecurityAlert] = Field(..., description="List of security alerts")
    total_count: int = Field(..., description="Total number of alerts")
    active_count: int = Field(..., description="Number of active alerts")
    
    model_config = ConfigDict(
        json_schema_extra = {
            "example": {
                "alerts": [
                    {
                        "id": "alert-12345678-1234-1234-1234-123456789012",
                        "alert_type": "brute_force_attack",
                        "severity": "critical",
                        "status": "active",
                        "title": "Brute Force Attack Detected",
                        "first_seen": "2025-01-20T03:00:00Z",
                        "event_count": 8,
                        "confidence_score": 95
                    }
                ],
                "total_count": 1,
                "active_count": 1
            }
        })


class AuditIntegrityRequest(BaseModel):
    """Request to verify audit log integrity"""
    log_ids: List[str] = Field(..., description="List of log entry IDs to verify")
    
    @field_validator('log_ids')
    @classmethod
    def validate_log_ids(cls, v):
        if not v or len(v) == 0:
            raise ValueError('At least one log ID must be provided')
        if len(v) > 100:
            raise ValueError('Cannot verify more than 100 log entries at once')
        return v
    
    model_config = ConfigDict(
        json_schema_extra = {
            "example": {
                "log_ids": [
                    "87654321-4321-4321-4321-210987654321",
                    "12345678-1234-1234-1234-123456789012"
                ]
            }
        })


class AuditIntegrityResult(BaseModel):
    """Audit log integrity verification result"""
    log_id: str = Field(..., description="Log entry ID")
    is_valid: bool = Field(..., description="Whether the log entry is valid")
    error_message: Optional[str] = Field(None, description="Error message if validation failed")
    
    model_config = ConfigDict(
        json_schema_extra = {
            "example": {
                "log_id": "87654321-4321-4321-4321-210987654321",
                "is_valid": True,
                "error_message": None
            }
        })


class AuditIntegrityResponse(BaseModel):
    """Response for audit log integrity verification"""
    results: List[AuditIntegrityResult] = Field(..., description="Verification results")
    total_checked: int = Field(..., description="Total number of entries checked")
    valid_count: int = Field(..., description="Number of valid entries")
    invalid_count: int = Field(..., description="Number of invalid entries")
    
    model_config = ConfigDict(
        json_schema_extra = {
            "example": {
                "results": [
                    {
                        "log_id": "87654321-4321-4321-4321-210987654321",
                        "is_valid": True,
                        "error_message": None
                    }
                ],
                "total_checked": 1,
                "valid_count": 1,
                "invalid_count": 0
            }
        })


class AuditErrorResponse(BaseModel):
    """Error response for audit operations"""
    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Error message")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional error details")
    
    model_config = ConfigDict(
        json_schema_extra = {
            "example": {
                "error": "AuditServiceError",
                "message": "Failed to create audit log entry",
                "details": {"correlation_id": "12345678-1234-1234-1234-123456789012"}
            }
        } )