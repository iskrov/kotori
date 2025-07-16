"""
Monitoring API Response Schemas

Pydantic models for monitoring API responses that were missing proper schemas.
"""

from datetime import datetime
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field, ConfigDict


class HealthHistoryResponse(BaseModel):
    """Response schema for health history endpoint"""
    health_history: List[Dict[str, Any]] = Field(..., description="Historical health check data")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "health_history": [
                    {
                        "timestamp": "2025-01-21T10:00:00Z",
                        "overall_status": "healthy",
                        "services": {"database": "healthy", "redis": "healthy"}
                    }
                ]
            }
        }
    )


class MonitoringConfigResponse(BaseModel):
    """Response schema for monitoring configuration"""
    monitoring_enabled: bool = Field(..., description="Whether monitoring is enabled")
    health_check_interval: int = Field(..., description="Health check interval in seconds")
    alert_thresholds: Dict[str, Any] = Field(..., description="Alert threshold configuration")
    services: List[str] = Field(..., description="List of monitored services")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "monitoring_enabled": True,
                "health_check_interval": 60,
                "alert_thresholds": {"cpu": 80, "memory": 85},
                "services": ["database", "redis", "speech_service"]
            }
        }
    )


class ServiceHealthCheckResponse(BaseModel):
    """Response schema for individual service health checks"""
    service_name: str = Field(..., description="Name of the service")
    status: str = Field(..., description="Service status")
    uptime: Optional[str] = Field(None, description="Service uptime")
    last_check: str = Field(..., description="Last health check timestamp")
    dependencies: Optional[List[str]] = Field(None, description="Service dependencies")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional service metadata")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "service_name": "database",
                "status": "healthy",
                "uptime": "24h 15m",
                "last_check": "2025-01-21T10:00:00Z",
                "dependencies": ["network", "storage"],
                "metadata": {"version": "14.0", "connections": 25}
            }
        }
    )


class MonitoringDashboardResponse(BaseModel):
    """Response schema for monitoring dashboard"""
    timestamp: str = Field(..., description="Dashboard generation timestamp")
    system_status: Dict[str, Any] = Field(..., description="Overall system status")
    security_metrics: Dict[str, Any] = Field(..., description="Security metrics summary")
    performance_summary: Dict[str, Any] = Field(..., description="Performance metrics summary")
    recent_alerts: List[Dict[str, Any]] = Field(..., description="Recent alerts")
    dashboard_metadata: Dict[str, Any] = Field(..., description="Dashboard metadata")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "timestamp": "2025-01-21T10:00:00Z",
                "system_status": {"overall_status": "healthy", "health_score": 0.95},
                "security_metrics": {"active_sessions": 150, "threats_detected": 0},
                "performance_summary": {"cpu_usage": 45.2, "memory_usage": 67.8},
                "recent_alerts": [],
                "dashboard_metadata": {"version": "1.0", "refresh_interval": 60}
            }
        }
    )


class HealthCheckTriggerResponse(BaseModel):
    """Response schema for health check trigger"""
    status: str = Field(..., description="Trigger status")
    timestamp: str = Field(..., description="Trigger timestamp")
    message: Optional[str] = Field(None, description="Additional message")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": "health_check_triggered",
                "timestamp": "2025-01-21T10:00:00Z",
                "message": "Health check initiated in background"
            }
        }
    )


class MonitoringStatusResponse(BaseModel):
    """Response schema for monitoring status"""
    status: str = Field(..., description="Monitoring system status")
    timestamp: str = Field(..., description="Status check timestamp")
    version: str = Field(..., description="Monitoring system version")
    uptime: str = Field(..., description="System uptime information")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": "operational",
                "timestamp": "2025-01-21T10:00:00Z",
                "version": "1.0",
                "uptime": "monitoring_active"
            }
        }
    )


class AlertCreateResponse(BaseModel):
    """Response schema for alert creation"""
    alert_id: str = Field(..., description="Created alert ID")
    status: str = Field(..., description="Creation status")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "alert_id": "alert-12345678-1234-1234-1234-123456789012",
                "status": "created"
            }
        }
    )


class AlertUpdateResponse(BaseModel):
    """Response schema for alert updates"""
    alert_id: str = Field(..., description="Updated alert ID")
    status: str = Field(..., description="Update status")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "alert_id": "alert-12345678-1234-1234-1234-123456789012",
                "status": "acknowledged"
            }
        }
    ) 