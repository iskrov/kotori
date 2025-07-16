"""
Monitoring API Endpoints

This module provides REST API endpoints for the monitoring system including
system health, service health, alerts, metrics, and analytics.
"""

from datetime import datetime, timedelta, UTC
from typing import Dict, List, Optional, Any
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Path, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.dependencies import get_db, get_current_user_optional
from app.services.monitoring_service import get_monitoring_service
from app.services.alert_manager import AlertManager
from app.services.security_analytics import SecurityAnalytics
from app.services.performance_analytics import PerformanceAnalytics
from app.models.user import User
from app.schemas.monitoring import (
    HealthHistoryResponse,
    MonitoringConfigResponse,
    ServiceHealthCheckResponse,
    MonitoringDashboardResponse,
    HealthCheckTriggerResponse,
    MonitoringStatusResponse,
    AlertCreateResponse,
    AlertUpdateResponse
)

router = APIRouter(prefix="/monitoring", tags=["monitoring"])
logger = logging.getLogger(__name__)


# Pydantic models for API responses
class SystemStatusResponse(BaseModel):
    timestamp: str
    overall_status: str
    health_score: float
    services: Dict[str, Dict[str, Any]]
    metrics: Dict[str, Any]
    alerts: Dict[str, Any]


class ServiceHealthResponse(BaseModel):
    service_name: str
    status: str
    response_time_ms: float
    last_check: str
    error: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class AlertResponse(BaseModel):
    id: str
    alert_type: str
    severity: str
    status: str
    title: str
    description: str
    created_at: str
    source: str
    metadata: Optional[Dict[str, Any]] = None


class AlertCreateRequest(BaseModel):
    alert_type: str
    severity: str
    title: str
    description: str
    source: str
    metadata: Optional[Dict[str, Any]] = None


class AlertUpdateRequest(BaseModel):
    status: Optional[str] = None
    acknowledged_by: Optional[str] = None
    resolved_by: Optional[str] = None


class MetricsResponse(BaseModel):
    timestamp: str
    cpu_usage: float
    memory_usage: float
    active_sessions: int
    request_rate: float
    error_rate: float
    response_time_p95: float
    security_events: int
    alert_count: int
    health_score: float


class SecurityMetricsResponse(BaseModel):
    active_sessions: int
    security_events_count: int
    authentication_attempts: int
    authentication_failures: int
    authentication_success_rate: float
    unique_users: int
    unique_ips: int
    threats_detected: int
    patterns_identified: int
    avg_threat_score: float
    high_risk_events: int
    last_analysis: Optional[str] = None


class PerformanceMetricsResponse(BaseModel):
    timestamp: str
    status: str
    metrics_analyzed: int
    resource_utilization: Dict[str, Any]
    trends: int
    bottlenecks: int
    analytics_metrics: Dict[str, Any]


class ThreatIntelligenceResponse(BaseModel):
    patterns_detected: Dict[str, int]
    top_threat_sources: List[List[Any]]
    total_threats: int
    critical_threats: int
    analysis_period_hours: int
    baseline_users: int
    baseline_ips: int


# System Health Endpoints
@router.get("/health", response_model=SystemStatusResponse)
async def get_system_health(
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Get overall system health status
    
    Returns comprehensive system health information including:
    - Overall system status
    - Service health status
    - System metrics
    - Alert summary
    """
    try:
        monitoring_service = get_monitoring_service(db)
        system_status = monitoring_service.get_system_status()
        
        return SystemStatusResponse(**system_status)
        
    except Exception as e:
        logger.error(f"Error getting system health: {e}")
        raise HTTPException(status_code=500, detail="Failed to get system health")


@router.get("/health/services", response_model=List[ServiceHealthResponse])
async def get_service_health(
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Get health status for all services
    
    Returns detailed health information for each monitored service
    """
    try:
        monitoring_service = get_monitoring_service(db)
        system_status = monitoring_service.get_system_status()
        
        services = []
        for service_name, service_data in system_status.get("services", {}).items():
            services.append(ServiceHealthResponse(
                service_name=service_name,
                status=service_data.get("status", "unknown"),
                response_time_ms=service_data.get("response_time_ms", 0),
                last_check=service_data.get("last_check", ""),
                error=service_data.get("error"),
                metadata=service_data
            ))
        
        return services
        
    except Exception as e:
        logger.error(f"Error getting service health: {e}")
        raise HTTPException(status_code=500, detail="Failed to get service health")


@router.get("/health/history", response_model=HealthHistoryResponse)
async def get_health_history(
    hours: int = Query(1, description="Number of hours of history to retrieve"),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Get health check history
    
    Returns historical health check data for the specified time period
    """
    try:
        monitoring_service = get_monitoring_service(db)
        health_history = monitoring_service.get_health_history(hours=hours)
        
        return HealthHistoryResponse(health_history=health_history)
        
    except Exception as e:
        logger.error(f"Error getting health history: {e}")
        raise HTTPException(status_code=500, detail="Failed to get health history")


# Metrics Endpoints
@router.get("/metrics", response_model=List[MetricsResponse])
async def get_metrics(
    hours: int = Query(1, description="Number of hours of metrics to retrieve"),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Get system metrics
    
    Returns system performance and health metrics for the specified time period
    """
    try:
        monitoring_service = get_monitoring_service(db)
        metrics_history = monitoring_service.get_metrics_history(hours=hours)
        
        return [MetricsResponse(**metrics) for metrics in metrics_history]
        
    except Exception as e:
        logger.error(f"Error getting metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get metrics")


@router.get("/metrics/security", response_model=SecurityMetricsResponse)
async def get_security_metrics(
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Get security metrics
    
    Returns security-related metrics including authentication stats,
    threat detection results, and security event counts
    """
    try:
        security_analytics = SecurityAnalytics(db)
        security_metrics = security_analytics.get_security_metrics()
        
        return SecurityMetricsResponse(**security_metrics)
        
    except Exception as e:
        logger.error(f"Error getting security metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get security metrics")


@router.get("/metrics/performance", response_model=PerformanceMetricsResponse)
async def get_performance_metrics(
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Get performance metrics
    
    Returns performance-related metrics including resource utilization,
    response times, and bottleneck analysis
    """
    try:
        performance_analytics = PerformanceAnalytics(db)
        performance_summary = performance_analytics.get_performance_summary()
        
        return PerformanceMetricsResponse(**performance_summary)
        
    except Exception as e:
        logger.error(f"Error getting performance metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get performance metrics")


# Alert Management Endpoints
@router.get("/alerts", response_model=List[AlertResponse])
async def get_alerts(
    limit: int = Query(10, description="Maximum number of alerts to retrieve"),
    status: Optional[str] = Query(None, description="Filter by alert status"),
    severity: Optional[str] = Query(None, description="Filter by alert severity"),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Get alerts
    
    Returns recent alerts with optional filtering by status and severity
    """
    try:
        monitoring_service = get_monitoring_service(db)
        alerts = monitoring_service.get_recent_alerts(limit=limit)
        
        # Apply filters
        if status:
            alerts = [alert for alert in alerts if alert.get("status") == status]
        if severity:
            alerts = [alert for alert in alerts if alert.get("severity") == severity]
        
        return [AlertResponse(**alert) for alert in alerts]
        
    except Exception as e:
        logger.error(f"Error getting alerts: {e}")
        raise HTTPException(status_code=500, detail="Failed to get alerts")


@router.post("/alerts", response_model=AlertCreateResponse)
async def create_alert(
    alert_request: AlertCreateRequest,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Create a new alert
    
    Creates a new alert with the specified parameters
    """
    try:
        alert_manager = AlertManager(db)
        alert_id = alert_manager.create_alert(
            alert_type=alert_request.alert_type,
            severity=alert_request.severity,
            title=alert_request.title,
            description=alert_request.description,
            source=alert_request.source,
            metadata=alert_request.metadata,
            user_id=user.id if user else None
        )
        
        if alert_id:
            return AlertCreateResponse(alert_id=alert_id, status="created")
        else:
            raise HTTPException(status_code=400, detail="Failed to create alert")
        
    except Exception as e:
        logger.error(f"Error creating alert: {e}")
        raise HTTPException(status_code=500, detail="Failed to create alert")


@router.put("/alerts/{alert_id}", response_model=AlertUpdateResponse)
async def update_alert(
    alert_id: str = Path(..., description="Alert ID"),
    alert_update: AlertUpdateRequest = None,
    action: str = Query(None, description="Action to perform: acknowledge, resolve"),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Update an alert
    
    Updates an alert status or performs actions like acknowledgment or resolution
    """
    try:
        alert_manager = AlertManager(db)
        
        if action == "acknowledge":
            success = alert_manager.acknowledge_alert(
                alert_id=alert_id,
                acknowledged_by=user.username if user else "anonymous"
            )
        elif action == "resolve":
            success = alert_manager.resolve_alert(
                alert_id=alert_id,
                resolved_by=user.username if user else "anonymous"
            )
        else:
            raise HTTPException(status_code=400, detail="Invalid action")
        
        if success:
            return AlertUpdateResponse(alert_id=alert_id, status=f"{action}d")
        else:
            raise HTTPException(status_code=404, detail="Alert not found or action failed")
        
    except Exception as e:
        logger.error(f"Error updating alert: {e}")
        raise HTTPException(status_code=500, detail="Failed to update alert")


# Analytics Endpoints
@router.get("/analytics/security/threats", response_model=ThreatIntelligenceResponse)
async def get_threat_intelligence(
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Get threat intelligence
    
    Returns threat intelligence data including attack patterns,
    threat sources, and security analytics
    """
    try:
        security_analytics = SecurityAnalytics(db)
        threat_intelligence = security_analytics.get_threat_intelligence()
        
        return ThreatIntelligenceResponse(**threat_intelligence)
        
    except Exception as e:
        logger.error(f"Error getting threat intelligence: {e}")
        raise HTTPException(status_code=500, detail="Failed to get threat intelligence")


@router.get("/analytics/performance/trends")
async def get_performance_trends(
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Get performance trends
    
    Returns performance trend analysis including resource utilization
    trends and performance forecasts
    """
    try:
        performance_analytics = PerformanceAnalytics(db)
        trend_analysis = performance_analytics.get_trend_analysis()
        
        return trend_analysis
        
    except Exception as e:
        logger.error(f"Error getting performance trends: {e}")
        raise HTTPException(status_code=500, detail="Failed to get performance trends")


@router.get("/analytics/performance/bottlenecks")
async def get_bottleneck_analysis(
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Get bottleneck analysis
    
    Returns bottleneck detection results and performance optimization
    recommendations
    """
    try:
        performance_analytics = PerformanceAnalytics(db)
        bottleneck_analysis = performance_analytics.get_bottleneck_analysis()
        
        return bottleneck_analysis
        
    except Exception as e:
        logger.error(f"Error getting bottleneck analysis: {e}")
        raise HTTPException(status_code=500, detail="Failed to get bottleneck analysis")


# Configuration Endpoints
@router.get("/config", response_model=MonitoringConfigResponse)
async def get_monitoring_config(
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Get monitoring configuration
    
    Returns current monitoring system configuration
    """
    try:
        monitoring_service = get_monitoring_service(db)
        config = monitoring_service.health_check()
        
        return MonitoringConfigResponse(**config)
        
    except Exception as e:
        logger.error(f"Error getting monitoring config: {e}")
        raise HTTPException(status_code=500, detail="Failed to get monitoring config")


# Health Check Endpoints for Individual Services
@router.get("/services/monitoring", response_model=ServiceHealthCheckResponse)
async def monitoring_service_health(
    db: Session = Depends(get_db)
):
    """
    Get monitoring service health
    
    Returns health status of the monitoring service itself
    """
    try:
        monitoring_service = get_monitoring_service(db)
        health = monitoring_service.health_check()
        
        return ServiceHealthCheckResponse(**health)
        
    except Exception as e:
        logger.error(f"Error getting monitoring service health: {e}")
        raise HTTPException(status_code=500, detail="Failed to get monitoring service health")


@router.get("/services/alerts", response_model=ServiceHealthCheckResponse)
async def alert_manager_health(
    db: Session = Depends(get_db)
):
    """
    Get alert manager health
    
    Returns health status of the alert manager service
    """
    try:
        alert_manager = AlertManager(db)
        health = alert_manager.health_check()
        
        return ServiceHealthCheckResponse(**health)
        
    except Exception as e:
        logger.error(f"Error getting alert manager health: {e}")
        raise HTTPException(status_code=500, detail="Failed to get alert manager health")


@router.get("/services/security-analytics", response_model=ServiceHealthCheckResponse)
async def security_analytics_health(
    db: Session = Depends(get_db)
):
    """
    Get security analytics health
    
    Returns health status of the security analytics service
    """
    try:
        security_analytics = SecurityAnalytics(db)
        health = security_analytics.health_check()
        
        return ServiceHealthCheckResponse(**health)
        
    except Exception as e:
        logger.error(f"Error getting security analytics health: {e}")
        raise HTTPException(status_code=500, detail="Failed to get security analytics health")


@router.get("/services/performance-analytics", response_model=ServiceHealthCheckResponse)
async def performance_analytics_health(
    db: Session = Depends(get_db)
):
    """
    Get performance analytics health
    
    Returns health status of the performance analytics service
    """
    try:
        performance_analytics = PerformanceAnalytics(db)
        health = performance_analytics.health_check()
        
        return ServiceHealthCheckResponse(**health)
        
    except Exception as e:
        logger.error(f"Error getting performance analytics health: {e}")
        raise HTTPException(status_code=500, detail="Failed to get performance analytics health")


# Dashboard Endpoints
@router.get("/dashboard", response_model=MonitoringDashboardResponse)
async def get_monitoring_dashboard(
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Get monitoring dashboard data
    
    Returns comprehensive dashboard data combining all monitoring aspects
    """
    try:
        monitoring_service = get_monitoring_service(db)
        security_analytics = SecurityAnalytics(db)
        performance_analytics = PerformanceAnalytics(db)
        
        # Get all dashboard data
        system_status = monitoring_service.get_system_status()
        security_metrics = security_analytics.get_security_metrics()
        performance_summary = performance_analytics.get_performance_summary()
        recent_alerts = monitoring_service.get_recent_alerts(limit=5)
        
        dashboard_data = MonitoringDashboardResponse(
            timestamp=datetime.now(UTC).isoformat(),
            system_status=system_status,
            security_metrics=security_metrics,
            performance_summary=performance_summary,
            recent_alerts=recent_alerts,
            dashboard_metadata={
                "version": "1.0",
                "refresh_interval": 60,
                "last_updated": datetime.now(UTC).isoformat()
            }
        )
        
        return dashboard_data
        
    except Exception as e:
        logger.error(f"Error getting monitoring dashboard: {e}")
        raise HTTPException(status_code=500, detail="Failed to get monitoring dashboard")


# Utility Endpoints
@router.post("/trigger-health-check", response_model=HealthCheckTriggerResponse)
async def trigger_health_check(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Trigger immediate health check
    
    Triggers an immediate health check of all services
    """
    try:
        monitoring_service = get_monitoring_service(db)
        
        # Trigger health check in background
        background_tasks.add_task(monitoring_service._perform_health_checks)
        
        return HealthCheckTriggerResponse(status="health_check_triggered", timestamp=datetime.now(UTC).isoformat())
        
    except Exception as e:
        logger.error(f"Error triggering health check: {e}")
        raise HTTPException(status_code=500, detail="Failed to trigger health check")


@router.get("/status", response_model=MonitoringStatusResponse)
async def get_monitoring_status():
    """
    Get basic monitoring status
    
    Returns basic status information without authentication
    """
    try:
        return MonitoringStatusResponse(
            status="operational",
            timestamp=datetime.now(UTC).isoformat(),
            version="1.0",
            uptime="monitoring_active"
        )
        
    except Exception as e:
        logger.error(f"Error getting monitoring status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get monitoring status") 