"""
Security Analytics Service

This module provides comprehensive security analytics including attack pattern detection,
anomaly detection, threat intelligence, and security metrics aggregation while maintaining
privacy-preserving analytics and zero-knowledge compliance.
"""

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
import statistics
import math

from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.services.audit_service import SecurityAuditService
from app.models.secret_tag_opaque import SecurityAuditLog
from app.core.config import settings

logger = logging.getLogger(__name__)


class ThreatLevel(str, Enum):
    """Threat level classifications"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AttackPattern(str, Enum):
    """Known attack patterns"""
    BRUTE_FORCE = "brute_force"
    CREDENTIAL_STUFFING = "credential_stuffing"
    TIMING_ATTACK = "timing_attack"
    ENUMERATION = "enumeration"
    RATE_LIMIT_BYPASS = "rate_limit_bypass"
    SUSPICIOUS_BEHAVIOR = "suspicious_behavior"
    ABNORMAL_ACTIVITY = "abnormal_activity"


@dataclass
class SecurityEvent:
    """Security event data"""
    event_id: str
    event_type: str
    severity: str
    timestamp: datetime
    user_id_hash: Optional[str]
    ip_address_hash: Optional[str]
    session_id_hash: Optional[str]
    event_data: Dict[str, Any]
    threat_score: float = 0.0
    patterns: List[AttackPattern] = field(default_factory=list)
    confidence: float = 0.0


@dataclass
class AttackDetectionResult:
    """Attack detection result"""
    pattern: AttackPattern
    confidence: float
    threat_level: ThreatLevel
    description: str
    indicators: List[str]
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class SecurityMetrics:
    """Security metrics aggregation"""
    timestamp: datetime
    total_events: int
    authentication_attempts: int
    authentication_failures: int
    authentication_success_rate: float
    unique_users: int
    unique_ips: int
    security_violations: int
    threat_score_average: float
    high_risk_events: int
    attack_patterns_detected: Dict[str, int]
    top_threat_sources: List[Tuple[str, int]]


class SecurityAnalytics:
    """
    Comprehensive security analytics service
    
    This service provides security analytics capabilities including:
    - Attack pattern detection
    - Anomaly detection
    - Threat scoring
    - Security metrics aggregation
    - Behavioral analysis
    """
    
    def __init__(self, db: Session):
        """Initialize security analytics"""
        self.db = db
        self.logger = logging.getLogger(__name__)
        
        # Initialize dependent services
        self.audit_service = SecurityAuditService()
        
        # Analytics state
        self.analytics_active = False
        self.analytics_thread = None
        self.last_analysis = None
        
        # Security event storage
        self.recent_events = deque(maxlen=10000)
        self.threat_patterns = {}
        self.user_baselines = {}  # user_id_hash -> baseline behavior
        self.ip_baselines = {}    # ip_address_hash -> baseline behavior
        
        # Detection rules
        self.detection_rules = self._load_detection_rules()
        
        # Metrics
        self.security_metrics = {
            'total_events_analyzed': 0,
            'threats_detected': 0,
            'patterns_identified': 0,
            'false_positives': 0,
            'analysis_runtime_ms': 0
        }
        
        # Thread safety
        self.lock = threading.RLock()
        
        # Start analytics
        self.start_analytics()
    
    def _load_detection_rules(self) -> Dict[str, Any]:
        """Load attack detection rules"""
        return {
            'brute_force_detection': {
                'enabled': True,
                'window_minutes': 15,
                'max_failures': 5,
                'confidence_threshold': 0.8
            },
            'credential_stuffing_detection': {
                'enabled': True,
                'window_minutes': 30,
                'max_attempts': 20,
                'unique_user_threshold': 10,
                'confidence_threshold': 0.7
            },
            'timing_attack_detection': {
                'enabled': True,
                'response_time_threshold': 2000,  # ms
                'pattern_count_threshold': 10,
                'confidence_threshold': 0.6
            },
            'enumeration_detection': {
                'enabled': True,
                'window_minutes': 10,
                'request_rate_threshold': 50,
                'confidence_threshold': 0.7
            },
            'rate_limit_bypass_detection': {
                'enabled': True,
                'window_minutes': 5,
                'request_count_threshold': 100,
                'confidence_threshold': 0.8
            },
            'anomaly_detection': {
                'enabled': True,
                'deviation_threshold': 3.0,  # standard deviations
                'confidence_threshold': 0.6
            }
        }
    
    def start_analytics(self):
        """Start background security analytics"""
        with self.lock:
            if not self.analytics_active:
                self.analytics_active = True
                
                # Start analytics thread
                self.analytics_thread = threading.Thread(
                    target=self._analytics_loop,
                    daemon=True,
                    name="security-analytics-thread"
                )
                self.analytics_thread.start()
                
                self.logger.info("Security analytics started")
    
    def stop_analytics(self):
        """Stop background security analytics"""
        with self.lock:
            self.analytics_active = False
            
            # Wait for thread to finish
            if self.analytics_thread:
                self.analytics_thread.join(timeout=5)
            
            self.logger.info("Security analytics stopped")
    
    def _analytics_loop(self):
        """Background analytics loop"""
        while self.analytics_active:
            try:
                # Analyze recent security events
                self._analyze_security_events()
                
                # Update baselines
                self._update_behavioral_baselines()
                
                # Clean up old data
                self._cleanup_old_data()
                
                time.sleep(60)  # Analyze every minute
            except Exception as e:
                self.logger.error(f"Error in security analytics loop: {e}")
                time.sleep(60)
    
    def _analyze_security_events(self):
        """Analyze recent security events for threats"""
        try:
            start_time = time.time()
            
            # Get recent audit logs
            recent_logs = self._get_recent_audit_logs()
            
            # Convert to security events
            security_events = []
            for log in recent_logs:
                event = SecurityEvent(
                    event_id=log.id,
                    event_type=log.event_type,
                    severity=log.severity,
                    timestamp=log.timestamp,
                    user_id_hash=log.user_id_hash,
                    ip_address_hash=log.ip_address_hash,
                    session_id_hash=log.session_id_hash,
                    event_data=json.loads(log.event_data) if log.event_data else {}
                )
                security_events.append(event)
            
            # Analyze events for attack patterns
            for event in security_events:
                self._analyze_event_for_patterns(event)
            
            # Store events
            with self.lock:
                self.recent_events.extend(security_events)
                self.security_metrics['total_events_analyzed'] += len(security_events)
                self.security_metrics['analysis_runtime_ms'] = int((time.time() - start_time) * 1000)
                self.last_analysis = datetime.now(UTC)
            
        except Exception as e:
            self.logger.error(f"Error analyzing security events: {e}")
    
    def _get_recent_audit_logs(self) -> List[SecurityAuditLog]:
        """Get recent audit logs for analysis"""
        try:
            # Get logs from last 5 minutes
            cutoff_time = datetime.now(UTC) - timedelta(minutes=5)
            
            logs = self.db.query(SecurityAuditLog).filter(
                SecurityAuditLog.timestamp >= cutoff_time,
                SecurityAuditLog.event_category.in_(['auth', 'security', 'session'])
            ).order_by(SecurityAuditLog.timestamp.desc()).limit(1000).all()
            
            return logs
            
        except Exception as e:
            self.logger.error(f"Error getting recent audit logs: {e}")
            return []
    
    def _analyze_event_for_patterns(self, event: SecurityEvent):
        """Analyze a single event for attack patterns"""
        try:
            patterns_detected = []
            
            # Brute force detection
            if self._detect_brute_force(event):
                patterns_detected.append(AttackPattern.BRUTE_FORCE)
            
            # Credential stuffing detection
            if self._detect_credential_stuffing(event):
                patterns_detected.append(AttackPattern.CREDENTIAL_STUFFING)
            
            # Timing attack detection
            if self._detect_timing_attack(event):
                patterns_detected.append(AttackPattern.TIMING_ATTACK)
            
            # Enumeration detection
            if self._detect_enumeration(event):
                patterns_detected.append(AttackPattern.ENUMERATION)
            
            # Rate limit bypass detection
            if self._detect_rate_limit_bypass(event):
                patterns_detected.append(AttackPattern.RATE_LIMIT_BYPASS)
            
            # Anomaly detection
            if self._detect_anomaly(event):
                patterns_detected.append(AttackPattern.ABNORMAL_ACTIVITY)
            
            # Update event with detected patterns
            event.patterns = patterns_detected
            event.threat_score = self._calculate_threat_score(event)
            
            # Log detected patterns
            if patterns_detected:
                self._log_pattern_detection(event, patterns_detected)
            
        except Exception as e:
            self.logger.error(f"Error analyzing event {event.event_id}: {e}")
    
    def _detect_brute_force(self, event: SecurityEvent) -> bool:
        """Detect brute force attacks"""
        if not self.detection_rules['brute_force_detection']['enabled']:
            return False
        
        # Only analyze authentication failures
        if event.event_type not in ['opaque_login_finish', 'user_login_failure']:
            return False
        
        if event.event_data.get('success', True):
            return False
        
        # Count recent failures from same IP or user
        window_start = datetime.now(UTC) - timedelta(
            minutes=self.detection_rules['brute_force_detection']['window_minutes']
        )
        
        failure_count = 0
        for recent_event in self.recent_events:
            if recent_event.timestamp < window_start:
                continue
            
            if (recent_event.ip_address_hash == event.ip_address_hash or
                recent_event.user_id_hash == event.user_id_hash):
                
                if (recent_event.event_type in ['opaque_login_finish', 'user_login_failure'] and
                    not recent_event.event_data.get('success', True)):
                    failure_count += 1
        
        max_failures = self.detection_rules['brute_force_detection']['max_failures']
        if failure_count >= max_failures:
            event.confidence = min(1.0, failure_count / max_failures)
            return True
        
        return False
    
    def _detect_credential_stuffing(self, event: SecurityEvent) -> bool:
        """Detect credential stuffing attacks"""
        if not self.detection_rules['credential_stuffing_detection']['enabled']:
            return False
        
        # Look for authentication attempts from same IP to multiple users
        if event.event_type not in ['opaque_login_finish', 'user_login_failure']:
            return False
        
        if not event.ip_address_hash:
            return False
        
        window_start = datetime.now(UTC) - timedelta(
            minutes=self.detection_rules['credential_stuffing_detection']['window_minutes']
        )
        
        attempt_count = 0
        unique_users = set()
        
        for recent_event in self.recent_events:
            if recent_event.timestamp < window_start:
                continue
            
            if recent_event.ip_address_hash == event.ip_address_hash:
                if recent_event.event_type in ['opaque_login_finish', 'user_login_failure']:
                    attempt_count += 1
                    if recent_event.user_id_hash:
                        unique_users.add(recent_event.user_id_hash)
        
        max_attempts = self.detection_rules['credential_stuffing_detection']['max_attempts']
        unique_threshold = self.detection_rules['credential_stuffing_detection']['unique_user_threshold']
        
        if attempt_count >= max_attempts and len(unique_users) >= unique_threshold:
            event.confidence = min(1.0, (attempt_count * len(unique_users)) / (max_attempts * unique_threshold))
            return True
        
        return False
    
    def _detect_timing_attack(self, event: SecurityEvent) -> bool:
        """Detect timing attacks"""
        if not self.detection_rules['timing_attack_detection']['enabled']:
            return False
        
        # Check for consistent timing patterns
        processing_time = event.event_data.get('processing_time_ms', 0)
        threshold = self.detection_rules['timing_attack_detection']['response_time_threshold']
        
        if processing_time < threshold:
            return False
        
        # Count similar timing patterns
        pattern_count = 0
        for recent_event in self.recent_events:
            recent_time = recent_event.event_data.get('processing_time_ms', 0)
            if abs(recent_time - processing_time) < 100:  # Within 100ms
                pattern_count += 1
        
        pattern_threshold = self.detection_rules['timing_attack_detection']['pattern_count_threshold']
        if pattern_count >= pattern_threshold:
            event.confidence = min(1.0, pattern_count / pattern_threshold)
            return True
        
        return False
    
    def _detect_enumeration(self, event: SecurityEvent) -> bool:
        """Detect enumeration attacks"""
        if not self.detection_rules['enumeration_detection']['enabled']:
            return False
        
        # Look for high request rates from same IP
        if not event.ip_address_hash:
            return False
        
        window_start = datetime.now(UTC) - timedelta(
            minutes=self.detection_rules['enumeration_detection']['window_minutes']
        )
        
        request_count = 0
        for recent_event in self.recent_events:
            if recent_event.timestamp < window_start:
                continue
            
            if recent_event.ip_address_hash == event.ip_address_hash:
                request_count += 1
        
        threshold = self.detection_rules['enumeration_detection']['request_rate_threshold']
        if request_count >= threshold:
            event.confidence = min(1.0, request_count / threshold)
            return True
        
        return False
    
    def _detect_rate_limit_bypass(self, event: SecurityEvent) -> bool:
        """Detect rate limit bypass attempts"""
        if not self.detection_rules['rate_limit_bypass_detection']['enabled']:
            return False
        
        # Look for rate limit violations
        if event.event_type != 'rate_limit_exceeded':
            return False
        
        window_start = datetime.now(UTC) - timedelta(
            minutes=self.detection_rules['rate_limit_bypass_detection']['window_minutes']
        )
        
        violation_count = 0
        for recent_event in self.recent_events:
            if recent_event.timestamp < window_start:
                continue
            
            if (recent_event.ip_address_hash == event.ip_address_hash and
                recent_event.event_type == 'rate_limit_exceeded'):
                violation_count += 1
        
        threshold = self.detection_rules['rate_limit_bypass_detection']['request_count_threshold']
        if violation_count >= threshold:
            event.confidence = min(1.0, violation_count / threshold)
            return True
        
        return False
    
    def _detect_anomaly(self, event: SecurityEvent) -> bool:
        """Detect anomalous behavior"""
        if not self.detection_rules['anomaly_detection']['enabled']:
            return False
        
        # Check for deviations from user baseline
        if event.user_id_hash:
            user_baseline = self.user_baselines.get(event.user_id_hash)
            if user_baseline and self._is_anomalous_behavior(event, user_baseline):
                return True
        
        # Check for deviations from IP baseline
        if event.ip_address_hash:
            ip_baseline = self.ip_baselines.get(event.ip_address_hash)
            if ip_baseline and self._is_anomalous_behavior(event, ip_baseline):
                return True
        
        return False
    
    def _is_anomalous_behavior(self, event: SecurityEvent, baseline: Dict[str, Any]) -> bool:
        """Check if event represents anomalous behavior"""
        try:
            # Check timing anomalies
            processing_time = event.event_data.get('processing_time_ms', 0)
            if processing_time > 0:
                baseline_time = baseline.get('avg_processing_time', 0)
                baseline_std = baseline.get('std_processing_time', 0)
                
                if baseline_std > 0:
                    z_score = abs(processing_time - baseline_time) / baseline_std
                    deviation_threshold = self.detection_rules['anomaly_detection']['deviation_threshold']
                    
                    if z_score > deviation_threshold:
                        event.confidence = min(1.0, z_score / deviation_threshold)
                        return True
            
            # Check frequency anomalies
            hour_of_day = event.timestamp.hour
            baseline_hourly = baseline.get('hourly_activity', {})
            expected_activity = baseline_hourly.get(str(hour_of_day), 0)
            
            if expected_activity == 0 and event.event_type in ['opaque_login_finish', 'session_created']:
                # Activity at unusual hour
                event.confidence = 0.5
                return True
            
            return False
            
        except Exception as e:
            self.logger.error(f"Error checking anomalous behavior: {e}")
            return False
    
    def _calculate_threat_score(self, event: SecurityEvent) -> float:
        """Calculate threat score for an event"""
        base_score = 0.0
        
        # Severity-based scoring
        severity_scores = {
            'info': 0.1,
            'warning': 0.3,
            'error': 0.6,
            'critical': 1.0
        }
        base_score += severity_scores.get(event.severity, 0.0)
        
        # Pattern-based scoring
        pattern_scores = {
            AttackPattern.BRUTE_FORCE: 0.8,
            AttackPattern.CREDENTIAL_STUFFING: 0.9,
            AttackPattern.TIMING_ATTACK: 0.7,
            AttackPattern.ENUMERATION: 0.6,
            AttackPattern.RATE_LIMIT_BYPASS: 0.8,
            AttackPattern.ABNORMAL_ACTIVITY: 0.5
        }
        
        for pattern in event.patterns:
            base_score += pattern_scores.get(pattern, 0.0)
        
        # Confidence multiplier
        base_score *= event.confidence
        
        return min(1.0, base_score)
    
    def _log_pattern_detection(self, event: SecurityEvent, patterns: List[AttackPattern]):
        """Log detected attack patterns"""
        try:
            pattern_names = [pattern.value for pattern in patterns]
            
            self.audit_service.log_event(
                db=self.db,
                event_type="attack_pattern_detected",
                event_category="security",
                severity="warning" if event.threat_score < 0.7 else "critical",
                message=f"Attack patterns detected: {', '.join(pattern_names)}",
                user_id=event.user_id_hash,
                ip_address=event.ip_address_hash,
                event_data={
                    "original_event_id": event.event_id,
                    "patterns": pattern_names,
                    "threat_score": event.threat_score,
                    "confidence": event.confidence
                },
                success=False,
                is_sensitive=True
            )
            
            with self.lock:
                self.security_metrics['threats_detected'] += 1
                self.security_metrics['patterns_identified'] += len(patterns)
            
        except Exception as e:
            self.logger.error(f"Error logging pattern detection: {e}")
    
    def _update_behavioral_baselines(self):
        """Update behavioral baselines for users and IPs"""
        try:
            # Update user baselines
            for user_id_hash in set(event.user_id_hash for event in self.recent_events if event.user_id_hash):
                self._update_user_baseline(user_id_hash)
            
            # Update IP baselines
            for ip_hash in set(event.ip_address_hash for event in self.recent_events if event.ip_address_hash):
                self._update_ip_baseline(ip_hash)
                
        except Exception as e:
            self.logger.error(f"Error updating behavioral baselines: {e}")
    
    def _update_user_baseline(self, user_id_hash: str):
        """Update baseline behavior for a user"""
        try:
            user_events = [event for event in self.recent_events if event.user_id_hash == user_id_hash]
            
            if not user_events:
                return
            
            # Calculate processing time statistics
            processing_times = [
                event.event_data.get('processing_time_ms', 0)
                for event in user_events
                if event.event_data.get('processing_time_ms', 0) > 0
            ]
            
            baseline = {
                'last_updated': datetime.now(UTC),
                'event_count': len(user_events),
                'hourly_activity': defaultdict(int)
            }
            
            if processing_times:
                baseline['avg_processing_time'] = statistics.mean(processing_times)
                baseline['std_processing_time'] = statistics.stdev(processing_times) if len(processing_times) > 1 else 0
            
            # Track hourly activity
            for event in user_events:
                hour = event.timestamp.hour
                baseline['hourly_activity'][str(hour)] += 1
            
            self.user_baselines[user_id_hash] = baseline
            
        except Exception as e:
            self.logger.error(f"Error updating user baseline for {user_id_hash}: {e}")
    
    def _update_ip_baseline(self, ip_hash: str):
        """Update baseline behavior for an IP address"""
        try:
            ip_events = [event for event in self.recent_events if event.ip_address_hash == ip_hash]
            
            if not ip_events:
                return
            
            # Calculate request rate statistics
            baseline = {
                'last_updated': datetime.now(UTC),
                'event_count': len(ip_events),
                'request_rate': len(ip_events) / 60,  # requests per minute
                'unique_users': len(set(event.user_id_hash for event in ip_events if event.user_id_hash))
            }
            
            self.ip_baselines[ip_hash] = baseline
            
        except Exception as e:
            self.logger.error(f"Error updating IP baseline for {ip_hash}: {e}")
    
    def _cleanup_old_data(self):
        """Clean up old analytics data"""
        cutoff_time = datetime.now(UTC) - timedelta(hours=24)
        
        # Clean up old baselines
        for user_id_hash in list(self.user_baselines.keys()):
            baseline = self.user_baselines[user_id_hash]
            if baseline.get('last_updated', datetime.min.replace(tzinfo=UTC)) < cutoff_time:
                del self.user_baselines[user_id_hash]
        
        for ip_hash in list(self.ip_baselines.keys()):
            baseline = self.ip_baselines[ip_hash]
            if baseline.get('last_updated', datetime.min.replace(tzinfo=UTC)) < cutoff_time:
                del self.ip_baselines[ip_hash]
    
    def get_security_metrics(self) -> Dict[str, Any]:
        """Get current security metrics"""
        try:
            # Get recent events for metrics calculation
            recent_time = datetime.now(UTC) - timedelta(hours=1)
            recent_events = [event for event in self.recent_events if event.timestamp > recent_time]
            
            # Calculate metrics
            auth_events = [e for e in recent_events if e.event_type in ['opaque_login_finish', 'user_login_failure']]
            auth_failures = [e for e in auth_events if not e.event_data.get('success', True)]
            
            metrics = {
                'active_sessions': len(set(e.session_id_hash for e in recent_events if e.session_id_hash)),
                'security_events_count': len(recent_events),
                'authentication_attempts': len(auth_events),
                'authentication_failures': len(auth_failures),
                'authentication_success_rate': 1.0 - (len(auth_failures) / len(auth_events)) if auth_events else 1.0,
                'unique_users': len(set(e.user_id_hash for e in recent_events if e.user_id_hash)),
                'unique_ips': len(set(e.ip_address_hash for e in recent_events if e.ip_address_hash)),
                'threats_detected': self.security_metrics['threats_detected'],
                'patterns_identified': self.security_metrics['patterns_identified'],
                'avg_threat_score': statistics.mean([e.threat_score for e in recent_events if e.threat_score > 0]) if recent_events else 0,
                'high_risk_events': len([e for e in recent_events if e.threat_score > 0.7]),
                'last_analysis': self.last_analysis.isoformat() if self.last_analysis else None
            }
            
            return metrics
            
        except Exception as e:
            self.logger.error(f"Error getting security metrics: {e}")
            return {
                'active_sessions': 0,
                'security_events_count': 0,
                'authentication_attempts': 0,
                'authentication_failures': 0,
                'authentication_success_rate': 0,
                'unique_users': 0,
                'unique_ips': 0,
                'threats_detected': 0,
                'patterns_identified': 0,
                'avg_threat_score': 0,
                'high_risk_events': 0,
                'last_analysis': None
            }
    
    def get_threat_intelligence(self) -> Dict[str, Any]:
        """Get threat intelligence summary"""
        try:
            recent_time = datetime.now(UTC) - timedelta(hours=24)
            recent_events = [event for event in self.recent_events if event.timestamp > recent_time]
            
            # Aggregate threat patterns
            pattern_counts = defaultdict(int)
            for event in recent_events:
                for pattern in event.patterns:
                    pattern_counts[pattern.value] += 1
            
            # Top threat sources
            ip_threat_scores = defaultdict(list)
            for event in recent_events:
                if event.ip_address_hash and event.threat_score > 0:
                    ip_threat_scores[event.ip_address_hash].append(event.threat_score)
            
            top_threat_sources = []
            for ip_hash, scores in ip_threat_scores.items():
                avg_score = statistics.mean(scores)
                top_threat_sources.append((ip_hash[:8] + '...', avg_score, len(scores)))
            
            top_threat_sources.sort(key=lambda x: x[1], reverse=True)
            
            return {
                'patterns_detected': dict(pattern_counts),
                'top_threat_sources': top_threat_sources[:10],
                'total_threats': len([e for e in recent_events if e.threat_score > 0.5]),
                'critical_threats': len([e for e in recent_events if e.threat_score > 0.8]),
                'analysis_period_hours': 24,
                'baseline_users': len(self.user_baselines),
                'baseline_ips': len(self.ip_baselines)
            }
            
        except Exception as e:
            self.logger.error(f"Error getting threat intelligence: {e}")
            return {}
    
    def health_check(self) -> Dict[str, Any]:
        """Get security analytics health status"""
        return {
            "status": "healthy" if self.analytics_active else "unhealthy",
            "analytics_active": self.analytics_active,
            "last_analysis": self.last_analysis.isoformat() if self.last_analysis else None,
            "events_in_buffer": len(self.recent_events),
            "user_baselines": len(self.user_baselines),
            "ip_baselines": len(self.ip_baselines),
            "detection_rules": {
                rule: config['enabled'] for rule, config in self.detection_rules.items()
            },
            "metrics": self.security_metrics
        } 