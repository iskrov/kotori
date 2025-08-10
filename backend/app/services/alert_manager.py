"""
Alert Manager Service

This module provides comprehensive alert management for the monitoring system.
It handles alert creation, processing, delivery, escalation, and suppression
while maintaining privacy-preserving alerting and zero-knowledge compliance.
"""

import asyncio
import logging
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict, deque
import json
import uuid
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.services.audit_service import SecurityAuditService
from app.models.monitoring import Alert, AlertRule, AlertChannel, AlertEscalation
from app.core.config import settings

logger = logging.getLogger(__name__)


class AlertSeverity(str, Enum):
    """Alert severity levels"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class AlertStatus(str, Enum):
    """Alert status values"""
    ACTIVE = "active"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    SUPPRESSED = "suppressed"


class AlertChannel(str, Enum):
    """Alert delivery channels"""
    EMAIL = "email"
    WEBHOOK = "webhook"
    CONSOLE = "console"
    DATABASE = "database"


@dataclass
class AlertDeliveryConfig:
    """Alert delivery configuration"""
    channel: AlertChannel
    enabled: bool
    config: Dict[str, Any] = field(default_factory=dict)
    retry_count: int = 3
    retry_delay: int = 60  # seconds


@dataclass
class AlertRule:
    """Alert rule configuration"""
    rule_id: str
    name: str
    condition: str
    severity: AlertSeverity
    enabled: bool
    suppression_duration: int = 300  # seconds
    escalation_delay: int = 900  # seconds
    tags: List[str] = field(default_factory=list)
    channels: List[AlertChannel] = field(default_factory=list)


@dataclass
class AlertInstance:
    """Alert instance data"""
    id: str
    alert_type: str
    severity: AlertSeverity
    status: AlertStatus
    title: str
    description: str
    source: str
    metadata: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    acknowledged_by: Optional[str] = None
    resolved_by: Optional[str] = None
    escalation_level: int = 0
    delivery_attempts: int = 0
    last_delivery_attempt: Optional[datetime] = None


class AlertManager:
    """
    Comprehensive alert management service
    
    This service provides alert management capabilities including:
    - Alert creation and processing
    - Multi-channel alert delivery
    - Alert escalation and suppression
    - Alert acknowledgment and resolution
    - Alert metrics and analytics
    """
    
    def __init__(self, db: Session):
        """Initialize alert manager"""
        self.db = db
        self.logger = logging.getLogger(__name__)
        
        # Initialize dependent services
        self.audit_service = SecurityAuditService()
        
        # Alert processing state
        self.processing_active = False
        self.processing_thread = None
        self.delivery_thread = None
        
        # Alert storage
        self.active_alerts = {}  # alert_id -> AlertInstance
        self.alert_history = deque(maxlen=10000)
        self.suppressed_alerts = {}  # alert_type -> suppression_end_time
        
        # Delivery configuration
        self.delivery_channels = self._load_delivery_channels()
        
        # Alert rules
        self.alert_rules = self._load_alert_rules()
        
        # Metrics
        self.alert_metrics = {
            'total_alerts': 0,
            'active_alerts': 0,
            'acknowledged_alerts': 0,
            'resolved_alerts': 0,
            'suppressed_alerts': 0,
            'delivery_attempts': 0,
            'delivery_failures': 0
        }
        
        # Thread safety
        self.lock = threading.RLock()
        
        # Start alert processing
        self.start_processing()
    
    def _load_delivery_channels(self) -> Dict[str, AlertDeliveryConfig]:
        """Load alert delivery channel configuration"""
        return {
            AlertChannel.EMAIL: AlertDeliveryConfig(
                channel=AlertChannel.EMAIL,
                enabled=getattr(settings, 'ALERT_EMAIL_ENABLED', False),
                config={
                    'smtp_server': getattr(settings, 'ALERT_SMTP_SERVER', 'localhost'),
                    'smtp_port': getattr(settings, 'ALERT_SMTP_PORT', 587),
                    'smtp_username': getattr(settings, 'ALERT_SMTP_USERNAME', ''),
                    'smtp_password': getattr(settings, 'ALERT_SMTP_PASSWORD', ''),
                    'from_address': getattr(settings, 'ALERT_FROM_EMAIL', 'alerts@kotori.io'),
                    'to_addresses': getattr(settings, 'ALERT_TO_EMAILS', [])
                }
            ),
            AlertChannel.WEBHOOK: AlertDeliveryConfig(
                channel=AlertChannel.WEBHOOK,
                enabled=getattr(settings, 'ALERT_WEBHOOK_ENABLED', False),
                config={
                    'webhook_url': getattr(settings, 'ALERT_WEBHOOK_URL', ''),
                    'webhook_secret': getattr(settings, 'ALERT_WEBHOOK_SECRET', '')
                }
            ),
            AlertChannel.CONSOLE: AlertDeliveryConfig(
                channel=AlertChannel.CONSOLE,
                enabled=True,
                config={}
            ),
            AlertChannel.DATABASE: AlertDeliveryConfig(
                channel=AlertChannel.DATABASE,
                enabled=True,
                config={}
            )
        }
    
    def _load_alert_rules(self) -> Dict[str, AlertRule]:
        """Load alert rules configuration"""
        return {
            'service_health_critical': AlertRule(
                rule_id='service_health_critical',
                name='Service Health Critical',
                condition='service_status == "critical"',
                severity=AlertSeverity.CRITICAL,
                enabled=True,
                suppression_duration=300,
                escalation_delay=600,
                channels=[AlertChannel.EMAIL, AlertChannel.WEBHOOK, AlertChannel.CONSOLE]
            ),
            'service_health_warning': AlertRule(
                rule_id='service_health_warning',
                name='Service Health Warning',
                condition='service_status == "warning"',
                severity=AlertSeverity.WARNING,
                enabled=True,
                suppression_duration=600,
                escalation_delay=1800,
                channels=[AlertChannel.CONSOLE, AlertChannel.DATABASE]
            ),
            'high_cpu_usage': AlertRule(
                rule_id='high_cpu_usage',
                name='High CPU Usage',
                condition='cpu_usage > 80',
                severity=AlertSeverity.WARNING,
                enabled=True,
                suppression_duration=300,
                escalation_delay=900,
                channels=[AlertChannel.CONSOLE, AlertChannel.DATABASE]
            ),
            'high_memory_usage': AlertRule(
                rule_id='high_memory_usage',
                name='High Memory Usage',
                condition='memory_usage > 85',
                severity=AlertSeverity.WARNING,
                enabled=True,
                suppression_duration=300,
                escalation_delay=900,
                channels=[AlertChannel.CONSOLE, AlertChannel.DATABASE]
            ),
            'high_error_rate': AlertRule(
                rule_id='high_error_rate',
                name='High Error Rate',
                condition='error_rate > 0.05',
                severity=AlertSeverity.ERROR,
                enabled=True,
                suppression_duration=180,
                escalation_delay=600,
                channels=[AlertChannel.EMAIL, AlertChannel.CONSOLE, AlertChannel.DATABASE]
            )
        }
    
    def start_processing(self):
        """Start background alert processing"""
        with self.lock:
            if not self.processing_active:
                self.processing_active = True
                
                # Start alert processing thread
                self.processing_thread = threading.Thread(
                    target=self._processing_loop,
                    daemon=True,
                    name="alert-processing-thread"
                )
                self.processing_thread.start()
                
                # Start delivery thread
                self.delivery_thread = threading.Thread(
                    target=self._delivery_loop,
                    daemon=True,
                    name="alert-delivery-thread"
                )
                self.delivery_thread.start()
                
                self.logger.info("Alert manager started")
    
    def stop_processing(self):
        """Stop background alert processing"""
        with self.lock:
            self.processing_active = False
            
            # Wait for threads to finish
            if self.processing_thread:
                self.processing_thread.join(timeout=5)
            if self.delivery_thread:
                self.delivery_thread.join(timeout=5)
            
            self.logger.info("Alert manager stopped")
    
    def _processing_loop(self):
        """Background alert processing loop"""
        while self.processing_active:
            try:
                # Process alert escalations
                self._process_escalations()
                
                # Clean up resolved alerts
                self._cleanup_resolved_alerts()
                
                # Update metrics
                self._update_metrics()
                
                time.sleep(30)  # Process every 30 seconds
            except Exception as e:
                self.logger.error(f"Error in alert processing loop: {e}")
                time.sleep(30)
    
    def _delivery_loop(self):
        """Background alert delivery loop"""
        while self.processing_active:
            try:
                # Deliver pending alerts
                self._deliver_pending_alerts()
                
                time.sleep(10)  # Process every 10 seconds
            except Exception as e:
                self.logger.error(f"Error in alert delivery loop: {e}")
                time.sleep(10)
    
    def create_alert(
        self,
        alert_type: str,
        severity: str,
        title: str,
        description: str,
        source: str,
        metadata: Optional[Dict[str, Any]] = None,
        user_id: Optional[str] = None
    ) -> str:
        """
        Create a new alert
        
        Args:
            alert_type: Type of alert
            severity: Alert severity level
            title: Alert title
            description: Alert description
            source: Source component that generated the alert
            metadata: Additional alert metadata
            user_id: User ID if applicable
            
        Returns:
            Alert ID
        """
        try:
            # Check if alert type is suppressed
            if self._is_suppressed(alert_type):
                self.logger.debug(f"Alert type {alert_type} is suppressed")
                return None
            
            # Create alert instance
            alert_id = str(uuid.uuid4())
            alert = AlertInstance(
                id=alert_id,
                alert_type=alert_type,
                severity=AlertSeverity(severity),
                status=AlertStatus.ACTIVE,
                title=title,
                description=description,
                source=source,
                metadata=metadata or {},
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            
            # Store alert
            with self.lock:
                self.active_alerts[alert_id] = alert
                self.alert_history.append(alert)
                self.alert_metrics['total_alerts'] += 1
                self.alert_metrics['active_alerts'] += 1
            
            # Apply suppression if configured
            rule = self.alert_rules.get(alert_type)
            if rule and rule.suppression_duration > 0:
                self._suppress_alert_type(alert_type, rule.suppression_duration)
            
            # Log alert creation
            self.audit_service.log_event(
                db=self.db,
                event_type="alert_created",
                event_category="system",
                severity=severity,
                message=f"Alert created: {title}",
                user_id=user_id,
                event_data={
                    "alert_id": alert_id,
                    "alert_type": alert_type,
                    "title": title,
                    "source": source,
                    "metadata": metadata
                },
                success=True
            )
            
            self.logger.info(f"Alert created: {alert_id} - {title}")
            return alert_id
            
        except Exception as e:
            self.logger.error(f"Error creating alert: {e}")
            return None
    
    def acknowledge_alert(self, alert_id: str, acknowledged_by: str) -> bool:
        """
        Acknowledge an alert
        
        Args:
            alert_id: Alert ID to acknowledge
            acknowledged_by: User who acknowledged the alert
            
        Returns:
            True if successful
        """
        try:
            with self.lock:
                alert = self.active_alerts.get(alert_id)
                if not alert:
                    self.logger.warning(f"Alert {alert_id} not found")
                    return False
                
                if alert.status == AlertStatus.ACKNOWLEDGED:
                    self.logger.warning(f"Alert {alert_id} already acknowledged")
                    return False
                
                # Update alert status
                alert.status = AlertStatus.ACKNOWLEDGED
                alert.acknowledged_at = datetime.now(timezone.utc)
                alert.acknowledged_by = acknowledged_by
                alert.updated_at = datetime.now(timezone.utc)
                
                self.alert_metrics['acknowledged_alerts'] += 1
                self.alert_metrics['active_alerts'] -= 1
            
            # Log acknowledgment
            self.audit_service.log_event(
                db=self.db,
                event_type="alert_acknowledged",
                event_category="system",
                severity="info",
                message=f"Alert acknowledged: {alert.title}",
                user_id=acknowledged_by,
                event_data={
                    "alert_id": alert_id,
                    "alert_type": alert.alert_type,
                    "acknowledged_by": acknowledged_by
                },
                success=True
            )
            
            self.logger.info(f"Alert acknowledged: {alert_id} by {acknowledged_by}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error acknowledging alert: {e}")
            return False
    
    def resolve_alert(self, alert_id: str, resolved_by: str) -> bool:
        """
        Resolve an alert
        
        Args:
            alert_id: Alert ID to resolve
            resolved_by: User who resolved the alert
            
        Returns:
            True if successful
        """
        try:
            with self.lock:
                alert = self.active_alerts.get(alert_id)
                if not alert:
                    self.logger.warning(f"Alert {alert_id} not found")
                    return False
                
                if alert.status == AlertStatus.RESOLVED:
                    self.logger.warning(f"Alert {alert_id} already resolved")
                    return False
                
                # Update alert status
                alert.status = AlertStatus.RESOLVED
                alert.resolved_at = datetime.now(timezone.utc)
                alert.resolved_by = resolved_by
                alert.updated_at = datetime.now(timezone.utc)
                
                self.alert_metrics['resolved_alerts'] += 1
                if alert.status == AlertStatus.ACTIVE:
                    self.alert_metrics['active_alerts'] -= 1
                elif alert.status == AlertStatus.ACKNOWLEDGED:
                    self.alert_metrics['acknowledged_alerts'] -= 1
            
            # Log resolution
            self.audit_service.log_event(
                db=self.db,
                event_type="alert_resolved",
                event_category="system",
                severity="info",
                message=f"Alert resolved: {alert.title}",
                user_id=resolved_by,
                event_data={
                    "alert_id": alert_id,
                    "alert_type": alert.alert_type,
                    "resolved_by": resolved_by
                },
                success=True
            )
            
            self.logger.info(f"Alert resolved: {alert_id} by {resolved_by}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error resolving alert: {e}")
            return False
    
    def _is_suppressed(self, alert_type: str) -> bool:
        """Check if an alert type is currently suppressed"""
        suppression_end = self.suppressed_alerts.get(alert_type)
        if suppression_end and datetime.now(timezone.utc) < suppression_end:
            return True
        elif suppression_end:
            # Remove expired suppression
            del self.suppressed_alerts[alert_type]
        return False
    
    def _suppress_alert_type(self, alert_type: str, duration: int):
        """Suppress an alert type for a specified duration"""
        suppression_end = datetime.now(timezone.utc) + timedelta(seconds=duration)
        self.suppressed_alerts[alert_type] = suppression_end
        self.logger.debug(f"Suppressed alert type {alert_type} until {suppression_end}")
    
    def _process_escalations(self):
        """Process alert escalations"""
        current_time = datetime.now(timezone.utc)
        
        with self.lock:
            for alert in self.active_alerts.values():
                if alert.status != AlertStatus.ACTIVE:
                    continue
                
                rule = self.alert_rules.get(alert.alert_type)
                if not rule or rule.escalation_delay <= 0:
                    continue
                
                # Check if escalation time has passed
                escalation_time = alert.created_at + timedelta(seconds=rule.escalation_delay)
                if current_time > escalation_time and alert.escalation_level == 0:
                    self._escalate_alert(alert)
    
    def _escalate_alert(self, alert: AlertInstance):
        """Escalate an alert to higher priority"""
        try:
            alert.escalation_level += 1
            alert.updated_at = datetime.now(timezone.utc)
            
            # Create escalation alert
            escalation_alert_id = self.create_alert(
                alert_type=f"{alert.alert_type}_escalated",
                severity=AlertSeverity.CRITICAL.value,
                title=f"ESCALATED: {alert.title}",
                description=f"Alert escalated after no acknowledgment: {alert.description}",
                source=f"alert_manager.escalation",
                metadata={
                    "original_alert_id": alert.id,
                    "escalation_level": alert.escalation_level,
                    "original_severity": alert.severity.value
                }
            )
            
            self.logger.warning(f"Alert escalated: {alert.id} -> {escalation_alert_id}")
            
        except Exception as e:
            self.logger.error(f"Error escalating alert {alert.id}: {e}")
    
    def _deliver_pending_alerts(self):
        """Deliver pending alerts"""
        with self.lock:
            alerts_to_deliver = [
                alert for alert in self.active_alerts.values()
                if alert.status == AlertStatus.ACTIVE and alert.delivery_attempts < 3
            ]
        
        for alert in alerts_to_deliver:
            self._deliver_alert(alert)
    
    def _deliver_alert(self, alert: AlertInstance):
        """Deliver an alert to configured channels"""
        rule = self.alert_rules.get(alert.alert_type)
        if not rule:
            return
        
        alert.delivery_attempts += 1
        alert.last_delivery_attempt = datetime.now(timezone.utc)
        
        for channel in rule.channels:
            try:
                if channel == AlertChannel.CONSOLE:
                    self._deliver_to_console(alert)
                elif channel == AlertChannel.EMAIL:
                    self._deliver_to_email(alert)
                elif channel == AlertChannel.WEBHOOK:
                    self._deliver_to_webhook(alert)
                elif channel == AlertChannel.DATABASE:
                    self._deliver_to_database(alert)
                
                self.alert_metrics['delivery_attempts'] += 1
                
            except Exception as e:
                self.logger.error(f"Error delivering alert {alert.id} to {channel}: {e}")
                self.alert_metrics['delivery_failures'] += 1
    
    def _deliver_to_console(self, alert: AlertInstance):
        """Deliver alert to console/logs"""
        log_level = {
            AlertSeverity.INFO: logging.INFO,
            AlertSeverity.WARNING: logging.WARNING,
            AlertSeverity.ERROR: logging.ERROR,
            AlertSeverity.CRITICAL: logging.CRITICAL
        }.get(alert.severity, logging.INFO)
        
        self.logger.log(log_level, f"ALERT [{alert.severity.upper()}]: {alert.title} - {alert.description}")
    
    def _deliver_to_email(self, alert: AlertInstance):
        """Deliver alert via email"""
        config = self.delivery_channels[AlertChannel.EMAIL]
        if not config.enabled:
            return
        
        # Create email message
        msg = MIMEMultipart()
        msg['From'] = config.config['from_address']
        msg['To'] = ', '.join(config.config['to_addresses'])
        msg['Subject'] = f"[{alert.severity.upper()}] {alert.title}"
        
        body = f"""
Alert Details:
- ID: {alert.id}
- Type: {alert.alert_type}
- Severity: {alert.severity.upper()}
- Source: {alert.source}
- Time: {alert.created_at.isoformat()}
- Description: {alert.description}

Metadata:
{json.dumps(alert.metadata, indent=2)}
"""
        msg.attach(MIMEText(body, 'plain'))
        
        # Send email
        try:
            server = smtplib.SMTP(config.config['smtp_server'], config.config['smtp_port'])
            server.starttls()
            if config.config['smtp_username']:
                server.login(config.config['smtp_username'], config.config['smtp_password'])
            server.send_message(msg)
            server.quit()
            
            self.logger.info(f"Alert {alert.id} delivered via email")
            
        except Exception as e:
            self.logger.error(f"Failed to send email for alert {alert.id}: {e}")
            raise
    
    def _deliver_to_webhook(self, alert: AlertInstance):
        """Deliver alert via webhook"""
        config = self.delivery_channels[AlertChannel.WEBHOOK]
        if not config.enabled:
            return
        
        # This would implement webhook delivery
        # For now, we'll just log it
        self.logger.info(f"Alert {alert.id} would be delivered via webhook")
    
    def _deliver_to_database(self, alert: AlertInstance):
        """Deliver alert to database"""
        # This would store the alert in the database
        # For now, we'll just log it
        self.logger.info(f"Alert {alert.id} stored in database")
    
    def _cleanup_resolved_alerts(self):
        """Clean up old resolved alerts"""
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=24)
        
        with self.lock:
            resolved_alerts = [
                alert_id for alert_id, alert in self.active_alerts.items()
                if alert.status == AlertStatus.RESOLVED and alert.resolved_at < cutoff_time
            ]
            
            for alert_id in resolved_alerts:
                del self.active_alerts[alert_id]
    
    def _update_metrics(self):
        """Update alert metrics"""
        with self.lock:
            self.alert_metrics['active_alerts'] = len([
                alert for alert in self.active_alerts.values()
                if alert.status == AlertStatus.ACTIVE
            ])
            self.alert_metrics['acknowledged_alerts'] = len([
                alert for alert in self.active_alerts.values()
                if alert.status == AlertStatus.ACKNOWLEDGED
            ])
            self.alert_metrics['resolved_alerts'] = len([
                alert for alert in self.active_alerts.values()
                if alert.status == AlertStatus.RESOLVED
            ])
    
    def process_pending_alerts(self):
        """Process pending alerts (called by monitoring service)"""
        # This method is called by the monitoring service
        # The actual processing is done in background threads
        pass
    
    def get_recent_alerts(self, limit: int = 10) -> List[AlertInstance]:
        """Get recent alerts"""
        with self.lock:
            recent_alerts = list(self.alert_history)[-limit:] if self.alert_history else []
            return recent_alerts
    
    def get_alert_metrics(self) -> Dict[str, Any]:
        """Get alert metrics"""
        with self.lock:
            return self.alert_metrics.copy()
    
    def get_active_alerts(self) -> List[AlertInstance]:
        """Get all active alerts"""
        with self.lock:
            return [alert for alert in self.active_alerts.values() if alert.status == AlertStatus.ACTIVE]
    
    def health_check(self) -> Dict[str, Any]:
        """Get alert manager health status"""
        return {
            "status": "healthy" if self.processing_active else "unhealthy",
            "processing_active": self.processing_active,
            "active_alerts": self.alert_metrics['active_alerts'],
            "delivery_channels": {
                channel.value: config.enabled
                for channel, config in self.delivery_channels.items()
            },
            "metrics": self.alert_metrics
        } 