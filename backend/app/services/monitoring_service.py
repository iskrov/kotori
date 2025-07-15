"""
Comprehensive Monitoring Service

This module provides centralized monitoring orchestration for the secret phrase authentication system.
It aggregates health checks, metrics, and alerts from all system components while maintaining
privacy-preserving monitoring and zero-knowledge compliance.
"""

import asyncio
import logging
import threading
import time
from datetime import datetime, timedelta, UTC
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict, deque
import json
import uuid

from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.services.audit_service import SecurityAuditService
from app.utils.performance_monitor import PerformanceMonitor, get_performance_monitor
from app.services.alert_manager import AlertManager
from app.services.security_analytics import SecurityAnalytics
from app.services.performance_analytics import PerformanceAnalytics
from app.models.monitoring import SystemHealth, ServiceHealth, Alert, MonitoringConfiguration
from app.core.config import settings

logger = logging.getLogger(__name__)


class ServiceStatus(str, Enum):
    """Service health status levels"""
    HEALTHY = "healthy"
    WARNING = "warning"
    CRITICAL = "critical"
    UNKNOWN = "unknown"


class MonitoringLevel(str, Enum):
    """Monitoring intensity levels"""
    BASIC = "basic"
    STANDARD = "standard"
    COMPREHENSIVE = "comprehensive"
    DEBUG = "debug"


@dataclass
class HealthCheckResult:
    """Result of a health check operation"""
    service_name: str
    status: ServiceStatus
    timestamp: datetime
    response_time_ms: float
    details: Dict[str, Any] = field(default_factory=dict)
    error_message: Optional[str] = None
    dependencies: List[str] = field(default_factory=list)


@dataclass
class SystemMetrics:
    """Aggregated system metrics"""
    timestamp: datetime
    cpu_usage: float
    memory_usage: float
    active_sessions: int
    request_rate: float
    error_rate: float
    response_time_p95: float
    security_events: int
    alert_count: int
    service_health_score: float


@dataclass
class MonitoringConfig:
    """Monitoring configuration"""
    level: MonitoringLevel
    health_check_interval: int  # seconds
    metric_collection_interval: int  # seconds
    alert_processing_interval: int  # seconds
    metric_retention_days: int
    enable_performance_monitoring: bool
    enable_security_monitoring: bool
    enable_real_time_alerts: bool
    privacy_mode: bool


class MonitoringService:
    """
    Centralized monitoring orchestration service
    
    This service provides comprehensive monitoring capabilities including:
    - Service health aggregation
    - Performance metrics collection
    - Security event monitoring
    - Alert management
    - Real-time system status
    """
    
    def __init__(self, db: Session):
        """Initialize monitoring service"""
        self.db = db
        self.logger = logging.getLogger(__name__)
        
        # Initialize dependent services
        self.audit_service = SecurityAuditService()
        self.performance_monitor = get_performance_monitor()
        self.alert_manager = AlertManager(db)
        self.security_analytics = SecurityAnalytics(db)
        self.performance_analytics = PerformanceAnalytics(db)
        
        # Monitoring state
        self.monitoring_active = False
        self.monitoring_thread = None
        self.health_check_thread = None
        self.last_health_check = None
        self.last_metrics_collection = None
        
        # Configuration
        self.config = self._load_configuration()
        
        # Service registry
        self.services = {
            'database': self._check_database_health,
            'audit_service': self._check_audit_service_health,
            'performance_monitor': self._check_performance_monitor_health,
            'alert_manager': self._check_alert_manager_health,
            'security_analytics': self._check_security_analytics_health,
            'performance_analytics': self._check_performance_analytics_health
        }
        
        # Metrics storage
        self.health_history = deque(maxlen=1000)
        self.metrics_history = deque(maxlen=1000)
        self.alert_history = deque(maxlen=1000)
        
        # Thread safety
        self.lock = threading.RLock()
        
        # Start monitoring
        self.start_monitoring()
    
    def _load_configuration(self) -> MonitoringConfig:
        """Load monitoring configuration from settings"""
        return MonitoringConfig(
            level=MonitoringLevel.STANDARD,
            health_check_interval=30,  # 30 seconds
            metric_collection_interval=60,  # 1 minute
            alert_processing_interval=10,  # 10 seconds
            metric_retention_days=30,
            enable_performance_monitoring=True,
            enable_security_monitoring=True,
            enable_real_time_alerts=True,
            privacy_mode=True
        )
    
    def start_monitoring(self):
        """Start background monitoring threads"""
        with self.lock:
            if not self.monitoring_active:
                self.monitoring_active = True
                
                # Start health check thread
                self.health_check_thread = threading.Thread(
                    target=self._health_check_loop,
                    daemon=True,
                    name="health-check-thread"
                )
                self.health_check_thread.start()
                
                # Start metrics collection thread
                self.monitoring_thread = threading.Thread(
                    target=self._monitoring_loop,
                    daemon=True,
                    name="monitoring-thread"
                )
                self.monitoring_thread.start()
                
                self.logger.info("Monitoring service started")
    
    def stop_monitoring(self):
        """Stop background monitoring threads"""
        with self.lock:
            self.monitoring_active = False
            
            # Wait for threads to finish
            if self.health_check_thread:
                self.health_check_thread.join(timeout=5)
            if self.monitoring_thread:
                self.monitoring_thread.join(timeout=5)
            
            self.logger.info("Monitoring service stopped")
    
    def _health_check_loop(self):
        """Background health check loop"""
        while self.monitoring_active:
            try:
                self._perform_health_checks()
                time.sleep(self.config.health_check_interval)
            except Exception as e:
                self.logger.error(f"Error in health check loop: {e}")
                time.sleep(self.config.health_check_interval)
    
    def _monitoring_loop(self):
        """Background monitoring loop"""
        while self.monitoring_active:
            try:
                # Collect metrics
                self._collect_system_metrics()
                
                # Process alerts
                self._process_alerts()
                
                # Cleanup old data
                self._cleanup_old_data()
                
                time.sleep(self.config.metric_collection_interval)
            except Exception as e:
                self.logger.error(f"Error in monitoring loop: {e}")
                time.sleep(self.config.metric_collection_interval)
    
    def _perform_health_checks(self):
        """Perform health checks on all registered services"""
        health_results = []
        
        for service_name, health_check_func in self.services.items():
            try:
                start_time = time.time()
                result = health_check_func()
                response_time = (time.time() - start_time) * 1000
                
                health_result = HealthCheckResult(
                    service_name=service_name,
                    status=ServiceStatus.HEALTHY if result.get('status') == 'healthy' else ServiceStatus.WARNING,
                    timestamp=datetime.now(UTC),
                    response_time_ms=response_time,
                    details=result,
                    error_message=result.get('error'),
                    dependencies=result.get('dependencies', [])
                )
                
                health_results.append(health_result)
                
            except Exception as e:
                health_result = HealthCheckResult(
                    service_name=service_name,
                    status=ServiceStatus.CRITICAL,
                    timestamp=datetime.now(UTC),
                    response_time_ms=0,
                    error_message=str(e)
                )
                health_results.append(health_result)
        
        # Store health results
        with self.lock:
            self.health_history.append(health_results)
            self.last_health_check = datetime.now(UTC)
        
        # Check for health-based alerts
        self._check_health_alerts(health_results)
    
    def _collect_system_metrics(self):
        """Collect system-wide metrics"""
        try:
            # Get performance metrics
            perf_summary = self.performance_monitor.get_metrics_summary()
            resource_stats = self.performance_monitor.get_resource_stats()
            
            # Get security metrics
            security_metrics = self.security_analytics.get_security_metrics()
            
            # Get alert metrics
            alert_metrics = self.alert_manager.get_alert_metrics()
            
            # Calculate composite metrics
            system_metrics = SystemMetrics(
                timestamp=datetime.now(UTC),
                cpu_usage=resource_stats.get('cpu_percent', {}).get('current', 0),
                memory_usage=resource_stats.get('memory_percent', {}).get('current', 0),
                active_sessions=security_metrics.get('active_sessions', 0),
                request_rate=perf_summary.get('gauges', {}).get('request_rate', 0),
                error_rate=perf_summary.get('gauges', {}).get('error_rate', 0),
                response_time_p95=perf_summary.get('histograms', {}).get('response_time_ms', {}).get('p95', 0),
                security_events=security_metrics.get('security_events_count', 0),
                alert_count=alert_metrics.get('active_alerts', 0),
                service_health_score=self._calculate_health_score()
            )
            
            with self.lock:
                self.metrics_history.append(system_metrics)
                self.last_metrics_collection = datetime.now(UTC)
            
            # Check for metric-based alerts
            self._check_metric_alerts(system_metrics)
            
        except Exception as e:
            self.logger.error(f"Error collecting system metrics: {e}")
    
    def _process_alerts(self):
        """Process pending alerts"""
        try:
            # Process new alerts
            self.alert_manager.process_pending_alerts()
            
            # Update alert history
            recent_alerts = self.alert_manager.get_recent_alerts(limit=10)
            if recent_alerts:
                with self.lock:
                    self.alert_history.extend(recent_alerts)
                    # Keep only last 1000 alerts
                    if len(self.alert_history) > 1000:
                        self.alert_history = deque(list(self.alert_history)[-1000:], maxlen=1000)
            
        except Exception as e:
            self.logger.error(f"Error processing alerts: {e}")
    
    def _check_health_alerts(self, health_results: List[HealthCheckResult]):
        """Check for health-based alert conditions"""
        for result in health_results:
            if result.status == ServiceStatus.CRITICAL:
                self.alert_manager.create_alert(
                    alert_type="service_health_critical",
                    severity="critical",
                    title=f"Service {result.service_name} is critical",
                    description=f"Service {result.service_name} failed health check: {result.error_message}",
                    source=f"monitoring_service.health_check",
                    metadata={
                        "service_name": result.service_name,
                        "response_time_ms": result.response_time_ms,
                        "error_message": result.error_message
                    }
                )
            elif result.status == ServiceStatus.WARNING:
                self.alert_manager.create_alert(
                    alert_type="service_health_warning",
                    severity="warning",
                    title=f"Service {result.service_name} has warnings",
                    description=f"Service {result.service_name} health check returned warnings",
                    source=f"monitoring_service.health_check",
                    metadata={
                        "service_name": result.service_name,
                        "response_time_ms": result.response_time_ms,
                        "details": result.details
                    }
                )
    
    def _check_metric_alerts(self, metrics: SystemMetrics):
        """Check for metric-based alert conditions"""
        # High CPU usage
        if metrics.cpu_usage > 80:
            self.alert_manager.create_alert(
                alert_type="high_cpu_usage",
                severity="warning" if metrics.cpu_usage < 90 else "critical",
                title=f"High CPU usage: {metrics.cpu_usage:.1f}%",
                description=f"System CPU usage is at {metrics.cpu_usage:.1f}%",
                source="monitoring_service.metrics",
                metadata={"cpu_usage": metrics.cpu_usage}
            )
        
        # High memory usage
        if metrics.memory_usage > 85:
            self.alert_manager.create_alert(
                alert_type="high_memory_usage",
                severity="warning" if metrics.memory_usage < 95 else "critical",
                title=f"High memory usage: {metrics.memory_usage:.1f}%",
                description=f"System memory usage is at {metrics.memory_usage:.1f}%",
                source="monitoring_service.metrics",
                metadata={"memory_usage": metrics.memory_usage}
            )
        
        # High error rate
        if metrics.error_rate > 0.05:  # 5% error rate
            self.alert_manager.create_alert(
                alert_type="high_error_rate",
                severity="warning" if metrics.error_rate < 0.1 else "critical",
                title=f"High error rate: {metrics.error_rate:.1%}",
                description=f"System error rate is at {metrics.error_rate:.1%}",
                source="monitoring_service.metrics",
                metadata={"error_rate": metrics.error_rate}
            )
        
        # Low health score
        if metrics.service_health_score < 0.8:
            self.alert_manager.create_alert(
                alert_type="low_health_score",
                severity="warning" if metrics.service_health_score > 0.6 else "critical",
                title=f"Low system health score: {metrics.service_health_score:.1%}",
                description=f"System health score is at {metrics.service_health_score:.1%}",
                source="monitoring_service.metrics",
                metadata={"health_score": metrics.service_health_score}
            )
    
    def _calculate_health_score(self) -> float:
        """Calculate overall system health score"""
        if not self.health_history:
            return 1.0
        
        latest_health = self.health_history[-1]
        total_services = len(latest_health)
        
        if total_services == 0:
            return 1.0
        
        healthy_count = sum(1 for result in latest_health if result.status == ServiceStatus.HEALTHY)
        warning_count = sum(1 for result in latest_health if result.status == ServiceStatus.WARNING)
        critical_count = sum(1 for result in latest_health if result.status == ServiceStatus.CRITICAL)
        
        # Calculate weighted score
        score = (healthy_count * 1.0 + warning_count * 0.7 + critical_count * 0.0) / total_services
        return max(0.0, min(1.0, score))
    
    def _cleanup_old_data(self):
        """Clean up old monitoring data"""
        cutoff_time = datetime.now(UTC) - timedelta(days=self.config.metric_retention_days)
        
        # This would clean up database records in a real implementation
        # For now, we just maintain in-memory limits via deque maxlen
        pass
    
    # Service health check methods
    def _check_database_health(self) -> Dict[str, Any]:
        """Check database health"""
        try:
            # Test database connection
            self.db.execute("SELECT 1")
            return {
                "status": "healthy",
                "details": {"connection": "active"}
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "details": {"connection": "failed"}
            }
    
    def _check_audit_service_health(self) -> Dict[str, Any]:
        """Check audit service health"""
        try:
            # Test audit service functionality
            test_log = self.audit_service.log_event(
                db=self.db,
                event_type="health_check",
                event_category="system",
                severity="info",
                message="Health check test log"
            )
            return {
                "status": "healthy" if test_log else "unhealthy",
                "details": {"logging": "functional" if test_log else "failed"}
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "details": {"logging": "failed"}
            }
    
    def _check_performance_monitor_health(self) -> Dict[str, Any]:
        """Check performance monitor health"""
        try:
            health_result = self.performance_monitor.health_check()
            return health_result
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e)
            }
    
    def _check_alert_manager_health(self) -> Dict[str, Any]:
        """Check alert manager health"""
        try:
            return self.alert_manager.health_check()
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e)
            }
    
    def _check_security_analytics_health(self) -> Dict[str, Any]:
        """Check security analytics health"""
        try:
            return self.security_analytics.health_check()
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e)
            }
    
    def _check_performance_analytics_health(self) -> Dict[str, Any]:
        """Check performance analytics health"""
        try:
            return self.performance_analytics.health_check()
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e)
            }
    
    # Public API methods
    def get_system_status(self) -> Dict[str, Any]:
        """Get current system status"""
        with self.lock:
            latest_health = self.health_history[-1] if self.health_history else []
            latest_metrics = self.metrics_history[-1] if self.metrics_history else None
            
            return {
                "timestamp": datetime.now(UTC).isoformat(),
                "overall_status": self._get_overall_status(),
                "health_score": self._calculate_health_score(),
                "services": {
                    result.service_name: {
                        "status": result.status.value,
                        "response_time_ms": result.response_time_ms,
                        "last_check": result.timestamp.isoformat(),
                        "error": result.error_message
                    } for result in latest_health
                },
                "metrics": {
                    "cpu_usage": latest_metrics.cpu_usage if latest_metrics else 0,
                    "memory_usage": latest_metrics.memory_usage if latest_metrics else 0,
                    "active_sessions": latest_metrics.active_sessions if latest_metrics else 0,
                    "error_rate": latest_metrics.error_rate if latest_metrics else 0,
                    "response_time_p95": latest_metrics.response_time_p95 if latest_metrics else 0
                } if latest_metrics else {},
                "alerts": {
                    "active_count": len([a for a in self.alert_history if a.status == "active"]) if self.alert_history else 0,
                    "recent_count": len(self.alert_history) if self.alert_history else 0
                }
            }
    
    def _get_overall_status(self) -> str:
        """Get overall system status"""
        if not self.health_history:
            return "unknown"
        
        latest_health = self.health_history[-1]
        
        if any(result.status == ServiceStatus.CRITICAL for result in latest_health):
            return "critical"
        elif any(result.status == ServiceStatus.WARNING for result in latest_health):
            return "warning"
        else:
            return "healthy"
    
    def get_health_history(self, hours: int = 1) -> List[Dict[str, Any]]:
        """Get health check history"""
        cutoff_time = datetime.now(UTC) - timedelta(hours=hours)
        
        with self.lock:
            filtered_health = []
            for health_results in self.health_history:
                if health_results and health_results[0].timestamp > cutoff_time:
                    filtered_health.append([
                        {
                            "service": result.service_name,
                            "status": result.status.value,
                            "timestamp": result.timestamp.isoformat(),
                            "response_time_ms": result.response_time_ms,
                            "error": result.error_message
                        } for result in health_results
                    ])
            
            return filtered_health
    
    def get_metrics_history(self, hours: int = 1) -> List[Dict[str, Any]]:
        """Get metrics history"""
        cutoff_time = datetime.now(UTC) - timedelta(hours=hours)
        
        with self.lock:
            filtered_metrics = []
            for metrics in self.metrics_history:
                if metrics.timestamp > cutoff_time:
                    filtered_metrics.append({
                        "timestamp": metrics.timestamp.isoformat(),
                        "cpu_usage": metrics.cpu_usage,
                        "memory_usage": metrics.memory_usage,
                        "active_sessions": metrics.active_sessions,
                        "request_rate": metrics.request_rate,
                        "error_rate": metrics.error_rate,
                        "response_time_p95": metrics.response_time_p95,
                        "security_events": metrics.security_events,
                        "alert_count": metrics.alert_count,
                        "health_score": metrics.service_health_score
                    })
            
            return filtered_metrics
    
    def get_recent_alerts(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent alerts"""
        with self.lock:
            recent_alerts = list(self.alert_history)[-limit:] if self.alert_history else []
            return [
                {
                    "id": alert.id,
                    "type": alert.alert_type,
                    "severity": alert.severity,
                    "title": alert.title,
                    "description": alert.description,
                    "status": alert.status,
                    "created_at": alert.created_at.isoformat(),
                    "source": alert.source,
                    "metadata": alert.metadata
                } for alert in recent_alerts
            ]
    
    def health_check(self) -> Dict[str, Any]:
        """Get monitoring service health"""
        return {
            "status": "healthy" if self.monitoring_active else "unhealthy",
            "monitoring_active": self.monitoring_active,
            "last_health_check": self.last_health_check.isoformat() if self.last_health_check else None,
            "last_metrics_collection": self.last_metrics_collection.isoformat() if self.last_metrics_collection else None,
            "configuration": {
                "level": self.config.level.value,
                "health_check_interval": self.config.health_check_interval,
                "metric_collection_interval": self.config.metric_collection_interval,
                "privacy_mode": self.config.privacy_mode
            }
        }


# Global monitoring service instance
_monitoring_service = None

def get_monitoring_service(db: Session) -> MonitoringService:
    """Get the global monitoring service instance"""
    global _monitoring_service
    if _monitoring_service is None:
        _monitoring_service = MonitoringService(db)
    return _monitoring_service 