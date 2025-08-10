"""
Performance Analytics Service

This module provides comprehensive performance analytics including trend analysis,
resource utilization monitoring, bottleneck detection, and capacity planning metrics
while maintaining privacy-preserving analytics and zero-knowledge compliance.
"""

import logging
import threading
import time
from datetime import datetime, timedelta, timezone
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

from app.utils.performance_monitor import PerformanceMonitor, get_performance_monitor
from app.services.audit_service import SecurityAuditService
from app.core.config import settings

logger = logging.getLogger(__name__)


class PerformanceStatus(str, Enum):
    """Performance status levels"""
    EXCELLENT = "excellent"
    GOOD = "good"
    DEGRADED = "degraded"
    CRITICAL = "critical"


class ResourceType(str, Enum):
    """Resource types for monitoring"""
    CPU = "cpu"
    MEMORY = "memory"
    DISK = "disk"
    NETWORK = "network"
    DATABASE = "database"
    RESPONSE_TIME = "response_time"


@dataclass
class PerformanceMetric:
    """Performance metric data point"""
    metric_id: str
    metric_type: ResourceType
    value: float
    unit: str
    timestamp: datetime
    source: str
    tags: Dict[str, str] = field(default_factory=dict)
    threshold_exceeded: bool = False
    baseline_deviation: float = 0.0


@dataclass
class PerformanceTrend:
    """Performance trend analysis"""
    metric_type: ResourceType
    trend_direction: str  # "increasing", "decreasing", "stable"
    trend_strength: float  # 0.0 to 1.0
    slope: float
    r_squared: float
    period_hours: int
    prediction_next_hour: float
    prediction_confidence: float


@dataclass
class BottleneckDetection:
    """Bottleneck detection result"""
    resource_type: ResourceType
    severity: str
    confidence: float
    description: str
    impact_score: float
    suggested_actions: List[str]
    correlated_metrics: List[str]


@dataclass
class CapacityForecast:
    """Capacity planning forecast"""
    resource_type: ResourceType
    current_utilization: float
    forecast_utilization: float
    forecast_horizon_hours: int
    time_to_capacity: Optional[int]  # hours until capacity exceeded
    recommended_scaling: Optional[str]
    confidence_level: float


class PerformanceAnalytics:
    """
    Comprehensive performance analytics service
    
    This service provides performance analytics capabilities including:
    - Performance trend analysis
    - Resource utilization monitoring
    - Bottleneck detection
    - Capacity planning
    - Performance forecasting
    """
    
    def __init__(self, db: Session):
        """Initialize performance analytics"""
        self.db = db
        self.logger = logging.getLogger(__name__)
        
        # Initialize dependent services
        self.performance_monitor = get_performance_monitor()
        self.audit_service = SecurityAuditService()
        
        # Analytics state
        self.analytics_active = False
        self.analytics_thread = None
        self.last_analysis = None
        
        # Performance data storage
        self.metrics_history = deque(maxlen=10000)
        self.trend_history = deque(maxlen=1000)
        self.bottleneck_history = deque(maxlen=1000)
        
        # Thresholds and baselines
        self.performance_thresholds = self._load_performance_thresholds()
        self.resource_baselines = {}
        
        # Analytics configuration
        self.analytics_config = self._load_analytics_config()
        
        # Metrics
        self.analytics_metrics = {
            'total_metrics_analyzed': 0,
            'trends_detected': 0,
            'bottlenecks_identified': 0,
            'forecasts_generated': 0,
            'analysis_runtime_ms': 0
        }
        
        # Thread safety
        self.lock = threading.RLock()
        
        # Start analytics
        self.start_analytics()
    
    def _load_performance_thresholds(self) -> Dict[str, Dict[str, float]]:
        """Load performance thresholds"""
        return {
            ResourceType.CPU: {
                'warning': 70.0,
                'critical': 90.0,
                'excellent': 50.0
            },
            ResourceType.MEMORY: {
                'warning': 80.0,
                'critical': 95.0,
                'excellent': 60.0
            },
            ResourceType.DISK: {
                'warning': 80.0,
                'critical': 95.0,
                'excellent': 60.0
            },
            ResourceType.NETWORK: {
                'warning': 80.0,
                'critical': 95.0,
                'excellent': 60.0
            },
            ResourceType.RESPONSE_TIME: {
                'warning': 1000.0,  # ms
                'critical': 2000.0,  # ms
                'excellent': 200.0   # ms
            },
            ResourceType.DATABASE: {
                'warning': 100.0,   # connections
                'critical': 200.0,  # connections
                'excellent': 50.0   # connections
            }
        }
    
    def _load_analytics_config(self) -> Dict[str, Any]:
        """Load analytics configuration"""
        return {
            'trend_analysis_window_hours': 24,
            'bottleneck_detection_window_hours': 1,
            'capacity_forecast_horizon_hours': 72,
            'baseline_calculation_window_hours': 168,  # 1 week
            'outlier_detection_threshold': 2.0,  # standard deviations
            'trend_significance_threshold': 0.7,  # R-squared
            'bottleneck_confidence_threshold': 0.8,
            'forecast_confidence_threshold': 0.7
        }
    
    def start_analytics(self):
        """Start background performance analytics"""
        with self.lock:
            if not self.analytics_active:
                self.analytics_active = True
                
                # Start analytics thread
                self.analytics_thread = threading.Thread(
                    target=self._analytics_loop,
                    daemon=True,
                    name="performance-analytics-thread"
                )
                self.analytics_thread.start()
                
                self.logger.info("Performance analytics started")
    
    def stop_analytics(self):
        """Stop background performance analytics"""
        with self.lock:
            self.analytics_active = False
            
            # Wait for thread to finish
            if self.analytics_thread:
                self.analytics_thread.join(timeout=5)
            
            self.logger.info("Performance analytics stopped")
    
    def _analytics_loop(self):
        """Background analytics loop"""
        while self.analytics_active:
            try:
                # Collect performance metrics
                self._collect_performance_metrics()
                
                # Analyze trends
                self._analyze_performance_trends()
                
                # Detect bottlenecks
                self._detect_bottlenecks()
                
                # Update baselines
                self._update_baselines()
                
                # Generate forecasts
                self._generate_capacity_forecasts()
                
                # Clean up old data
                self._cleanup_old_data()
                
                time.sleep(300)  # Analyze every 5 minutes
            except Exception as e:
                self.logger.error(f"Error in performance analytics loop: {e}")
                time.sleep(300)
    
    def _collect_performance_metrics(self):
        """Collect performance metrics from monitor"""
        try:
            start_time = time.time()
            
            # Get current metrics from performance monitor
            metrics_summary = self.performance_monitor.get_metrics_summary()
            resource_stats = self.performance_monitor.get_resource_stats()
            
            # Convert to performance metrics
            current_time = datetime.now(timezone.utc)
            new_metrics = []
            
            # CPU metrics
            if 'cpu_percent' in resource_stats:
                cpu_metric = PerformanceMetric(
                    metric_id=str(uuid.uuid4()),
                    metric_type=ResourceType.CPU,
                    value=resource_stats['cpu_percent']['current'],
                    unit='percent',
                    timestamp=current_time,
                    source='performance_monitor',
                    tags={'resource': 'cpu_usage'}
                )
                cpu_metric.threshold_exceeded = self._check_threshold_exceeded(cpu_metric)
                new_metrics.append(cpu_metric)
            
            # Memory metrics
            if 'memory_percent' in resource_stats:
                memory_metric = PerformanceMetric(
                    metric_id=str(uuid.uuid4()),
                    metric_type=ResourceType.MEMORY,
                    value=resource_stats['memory_percent']['current'],
                    unit='percent',
                    timestamp=current_time,
                    source='performance_monitor',
                    tags={'resource': 'memory_usage'}
                )
                memory_metric.threshold_exceeded = self._check_threshold_exceeded(memory_metric)
                new_metrics.append(memory_metric)
            
            # Response time metrics
            histograms = metrics_summary.get('histograms', {})
            for operation, stats in histograms.items():
                if 'duration_ms' in operation:
                    response_metric = PerformanceMetric(
                        metric_id=str(uuid.uuid4()),
                        metric_type=ResourceType.RESPONSE_TIME,
                        value=stats.get('p95', 0),
                        unit='milliseconds',
                        timestamp=current_time,
                        source='performance_monitor',
                        tags={'operation': operation, 'percentile': 'p95'}
                    )
                    response_metric.threshold_exceeded = self._check_threshold_exceeded(response_metric)
                    new_metrics.append(response_metric)
            
            # Store metrics
            with self.lock:
                self.metrics_history.extend(new_metrics)
                self.analytics_metrics['total_metrics_analyzed'] += len(new_metrics)
                self.analytics_metrics['analysis_runtime_ms'] = int((time.time() - start_time) * 1000)
                self.last_analysis = current_time
            
        except Exception as e:
            self.logger.error(f"Error collecting performance metrics: {e}")
    
    def _check_threshold_exceeded(self, metric: PerformanceMetric) -> bool:
        """Check if metric exceeds thresholds"""
        thresholds = self.performance_thresholds.get(metric.metric_type, {})
        warning_threshold = thresholds.get('warning', float('inf'))
        
        return metric.value > warning_threshold
    
    def _analyze_performance_trends(self):
        """Analyze performance trends"""
        try:
            window_hours = self.analytics_config['trend_analysis_window_hours']
            cutoff_time = datetime.now(timezone.utc) - timedelta(hours=window_hours)
            
            # Group metrics by type
            metrics_by_type = defaultdict(list)
            for metric in self.metrics_history:
                if metric.timestamp > cutoff_time:
                    metrics_by_type[metric.metric_type].append(metric)
            
            # Analyze trends for each metric type
            for metric_type, metrics in metrics_by_type.items():
                if len(metrics) < 10:  # Need minimum data points
                    continue
                
                trend = self._calculate_trend(metrics)
                if trend:
                    with self.lock:
                        self.trend_history.append(trend)
                        self.analytics_metrics['trends_detected'] += 1
        
        except Exception as e:
            self.logger.error(f"Error analyzing performance trends: {e}")
    
    def _calculate_trend(self, metrics: List[PerformanceMetric]) -> Optional[PerformanceTrend]:
        """Calculate trend for a set of metrics"""
        try:
            if len(metrics) < 2:
                return None
            
            # Sort by timestamp
            metrics.sort(key=lambda x: x.timestamp)
            
            # Convert to time series
            timestamps = [(m.timestamp - metrics[0].timestamp).total_seconds() / 3600 for m in metrics]  # hours
            values = [m.value for m in metrics]
            
            # Calculate linear regression
            n = len(timestamps)
            sum_x = sum(timestamps)
            sum_y = sum(values)
            sum_xy = sum(x * y for x, y in zip(timestamps, values))
            sum_x_squared = sum(x * x for x in timestamps)
            
            # Calculate slope and r-squared
            slope = (n * sum_xy - sum_x * sum_y) / (n * sum_x_squared - sum_x * sum_x)
            y_mean = sum_y / n
            
            ss_tot = sum((y - y_mean) ** 2 for y in values)
            ss_res = sum((y - (slope * x + (sum_y - slope * sum_x) / n)) ** 2 
                        for x, y in zip(timestamps, values))
            
            r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0
            
            # Determine trend direction and strength
            if abs(slope) < 0.1:
                trend_direction = "stable"
                trend_strength = 0.0
            elif slope > 0:
                trend_direction = "increasing"
                trend_strength = min(1.0, abs(slope) / 10.0)
            else:
                trend_direction = "decreasing"
                trend_strength = min(1.0, abs(slope) / 10.0)
            
            # Generate prediction
            next_hour_x = timestamps[-1] + 1
            prediction = slope * next_hour_x + (sum_y - slope * sum_x) / n
            
            return PerformanceTrend(
                metric_type=metrics[0].metric_type,
                trend_direction=trend_direction,
                trend_strength=trend_strength,
                slope=slope,
                r_squared=r_squared,
                period_hours=int(timestamps[-1] - timestamps[0]) if timestamps else 0,
                prediction_next_hour=prediction,
                prediction_confidence=r_squared
            )
            
        except Exception as e:
            self.logger.error(f"Error calculating trend: {e}")
            return None
    
    def _detect_bottlenecks(self):
        """Detect performance bottlenecks"""
        try:
            window_hours = self.analytics_config['bottleneck_detection_window_hours']
            cutoff_time = datetime.now(timezone.utc) - timedelta(hours=window_hours)
            
            # Get recent metrics
            recent_metrics = [m for m in self.metrics_history if m.timestamp > cutoff_time]
            
            # Group by resource type
            metrics_by_type = defaultdict(list)
            for metric in recent_metrics:
                metrics_by_type[metric.metric_type].append(metric)
            
            # Analyze each resource type for bottlenecks
            for resource_type, metrics in metrics_by_type.items():
                bottleneck = self._analyze_bottleneck(resource_type, metrics)
                if bottleneck:
                    with self.lock:
                        self.bottleneck_history.append(bottleneck)
                        self.analytics_metrics['bottlenecks_identified'] += 1
        
        except Exception as e:
            self.logger.error(f"Error detecting bottlenecks: {e}")
    
    def _analyze_bottleneck(self, resource_type: ResourceType, metrics: List[PerformanceMetric]) -> Optional[BottleneckDetection]:
        """Analyze metrics for bottleneck conditions"""
        try:
            if not metrics:
                return None
            
            # Calculate statistics
            values = [m.value for m in metrics]
            avg_value = statistics.mean(values)
            max_value = max(values)
            threshold_violations = sum(1 for m in metrics if m.threshold_exceeded)
            
            thresholds = self.performance_thresholds.get(resource_type, {})
            critical_threshold = thresholds.get('critical', float('inf'))
            warning_threshold = thresholds.get('warning', float('inf'))
            
            # Determine bottleneck severity
            severity = "none"
            confidence = 0.0
            impact_score = 0.0
            
            if max_value > critical_threshold:
                severity = "critical"
                confidence = min(1.0, (max_value - critical_threshold) / critical_threshold)
                impact_score = 0.9
            elif avg_value > warning_threshold:
                severity = "warning"
                confidence = min(1.0, (avg_value - warning_threshold) / warning_threshold)
                impact_score = 0.6
            elif threshold_violations > len(metrics) * 0.3:  # 30% threshold violations
                severity = "warning"
                confidence = threshold_violations / len(metrics)
                impact_score = 0.4
            
            if severity == "none":
                return None
            
            # Generate description and suggestions
            description = f"{resource_type.value} utilization is {severity}"
            suggested_actions = self._generate_bottleneck_suggestions(resource_type, severity, avg_value)
            
            return BottleneckDetection(
                resource_type=resource_type,
                severity=severity,
                confidence=confidence,
                description=description,
                impact_score=impact_score,
                suggested_actions=suggested_actions,
                correlated_metrics=[]
            )
            
        except Exception as e:
            self.logger.error(f"Error analyzing bottleneck for {resource_type}: {e}")
            return None
    
    def _generate_bottleneck_suggestions(self, resource_type: ResourceType, severity: str, current_value: float) -> List[str]:
        """Generate suggestions for bottleneck resolution"""
        suggestions = []
        
        if resource_type == ResourceType.CPU:
            if severity == "critical":
                suggestions.extend([
                    "Consider scaling up CPU resources",
                    "Optimize CPU-intensive operations",
                    "Implement request queuing to reduce load spikes"
                ])
            else:
                suggestions.extend([
                    "Monitor CPU usage patterns",
                    "Consider code optimization",
                    "Review background processes"
                ])
        
        elif resource_type == ResourceType.MEMORY:
            if severity == "critical":
                suggestions.extend([
                    "Increase memory allocation",
                    "Identify memory leaks",
                    "Optimize memory usage patterns"
                ])
            else:
                suggestions.extend([
                    "Monitor memory usage trends",
                    "Consider memory optimization",
                    "Review cache sizes"
                ])
        
        elif resource_type == ResourceType.RESPONSE_TIME:
            if severity == "critical":
                suggestions.extend([
                    "Optimize slow queries",
                    "Implement caching",
                    "Scale backend services"
                ])
            else:
                suggestions.extend([
                    "Profile application performance",
                    "Monitor response time trends",
                    "Consider preemptive caching"
                ])
        
        return suggestions
    
    def _update_baselines(self):
        """Update performance baselines"""
        try:
            window_hours = self.analytics_config['baseline_calculation_window_hours']
            cutoff_time = datetime.now(timezone.utc) - timedelta(hours=window_hours)
            
            # Get historical metrics
            historical_metrics = [m for m in self.metrics_history if m.timestamp > cutoff_time]
            
            # Group by resource type
            metrics_by_type = defaultdict(list)
            for metric in historical_metrics:
                metrics_by_type[metric.metric_type].append(metric)
            
            # Calculate baselines for each resource type
            for resource_type, metrics in metrics_by_type.items():
                if len(metrics) < 10:  # Need minimum data points
                    continue
                
                values = [m.value for m in metrics]
                baseline = {
                    'mean': statistics.mean(values),
                    'median': statistics.median(values),
                    'std_dev': statistics.stdev(values) if len(values) > 1 else 0,
                    'min': min(values),
                    'max': max(values),
                    'p95': self._percentile(values, 95),
                    'p99': self._percentile(values, 99),
                    'sample_count': len(values),
                    'updated_at': datetime.now(timezone.utc)
                }
                
                self.resource_baselines[resource_type] = baseline
        
        except Exception as e:
            self.logger.error(f"Error updating baselines: {e}")
    
    def _percentile(self, values: List[float], percentile: float) -> float:
        """Calculate percentile value"""
        if not values:
            return 0.0
        
        sorted_values = sorted(values)
        k = (len(sorted_values) - 1) * percentile / 100
        f = math.floor(k)
        c = math.ceil(k)
        
        if f == c:
            return sorted_values[int(k)]
        
        d0 = sorted_values[int(f)] * (c - k)
        d1 = sorted_values[int(c)] * (k - f)
        return d0 + d1
    
    def _generate_capacity_forecasts(self):
        """Generate capacity planning forecasts"""
        try:
            # Get trends for forecasting
            recent_trends = [t for t in self.trend_history if t.r_squared > 0.5]
            
            for trend in recent_trends:
                forecast = self._calculate_capacity_forecast(trend)
                if forecast:
                    with self.lock:
                        self.analytics_metrics['forecasts_generated'] += 1
        
        except Exception as e:
            self.logger.error(f"Error generating capacity forecasts: {e}")
    
    def _calculate_capacity_forecast(self, trend: PerformanceTrend) -> Optional[CapacityForecast]:
        """Calculate capacity forecast based on trend"""
        try:
            if trend.trend_direction == "stable":
                return None
            
            # Get current utilization
            recent_metrics = [m for m in self.metrics_history 
                           if m.metric_type == trend.metric_type and 
                           m.timestamp > datetime.now(timezone.utc) - timedelta(hours=1)]
            
            if not recent_metrics:
                return None
            
            current_utilization = statistics.mean([m.value for m in recent_metrics])
            
            # Calculate forecast utilization
            forecast_hours = self.analytics_config['capacity_forecast_horizon_hours']
            forecast_utilization = current_utilization + (trend.slope * forecast_hours)
            
            # Get capacity threshold
            thresholds = self.performance_thresholds.get(trend.metric_type, {})
            capacity_threshold = thresholds.get('critical', 100.0)
            
            # Calculate time to capacity
            time_to_capacity = None
            if trend.slope > 0 and forecast_utilization > capacity_threshold:
                time_to_capacity = int((capacity_threshold - current_utilization) / trend.slope)
            
            # Generate scaling recommendation
            recommended_scaling = None
            if time_to_capacity and time_to_capacity < 48:  # Less than 48 hours
                recommended_scaling = "immediate"
            elif time_to_capacity and time_to_capacity < 168:  # Less than 1 week
                recommended_scaling = "soon"
            elif forecast_utilization > capacity_threshold * 0.8:  # 80% of capacity
                recommended_scaling = "planned"
            
            return CapacityForecast(
                resource_type=trend.metric_type,
                current_utilization=current_utilization,
                forecast_utilization=forecast_utilization,
                forecast_horizon_hours=forecast_hours,
                time_to_capacity=time_to_capacity,
                recommended_scaling=recommended_scaling,
                confidence_level=trend.prediction_confidence
            )
            
        except Exception as e:
            self.logger.error(f"Error calculating capacity forecast: {e}")
            return None
    
    def _cleanup_old_data(self):
        """Clean up old analytics data"""
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=168)  # 1 week
        
        # Keep only recent data in memory
        # The deque maxlen will handle most cleanup automatically
        pass
    
    def get_performance_summary(self) -> Dict[str, Any]:
        """Get performance summary"""
        try:
            # Get recent metrics
            recent_time = datetime.now(timezone.utc) - timedelta(hours=1)
            recent_metrics = [m for m in self.metrics_history if m.timestamp > recent_time]
            
            # Calculate summary statistics
            metrics_by_type = defaultdict(list)
            for metric in recent_metrics:
                metrics_by_type[metric.metric_type].append(metric.value)
            
            summary = {
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'status': self._get_overall_performance_status(),
                'metrics_analyzed': len(recent_metrics),
                'resource_utilization': {},
                'trends': len(self.trend_history),
                'bottlenecks': len([b for b in self.bottleneck_history if b.severity in ['warning', 'critical']]),
                'analytics_metrics': self.analytics_metrics.copy()
            }
            
            # Add resource utilization
            for resource_type, values in metrics_by_type.items():
                if values:
                    summary['resource_utilization'][resource_type.value] = {
                        'current': values[-1] if values else 0,
                        'average': statistics.mean(values),
                        'max': max(values),
                        'threshold_exceeded': any(
                            v > self.performance_thresholds.get(resource_type, {}).get('warning', float('inf'))
                            for v in values
                        )
                    }
            
            return summary
            
        except Exception as e:
            self.logger.error(f"Error getting performance summary: {e}")
            return {
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'status': 'unknown',
                'error': str(e)
            }
    
    def _get_overall_performance_status(self) -> str:
        """Get overall performance status"""
        try:
            # Check recent bottlenecks
            recent_time = datetime.now(timezone.utc) - timedelta(hours=1)
            recent_bottlenecks = [b for b in self.bottleneck_history if b.severity != 'none']
            
            if any(b.severity == 'critical' for b in recent_bottlenecks):
                return PerformanceStatus.CRITICAL.value
            elif any(b.severity == 'warning' for b in recent_bottlenecks):
                return PerformanceStatus.DEGRADED.value
            
            # Check recent metrics against thresholds
            recent_metrics = [m for m in self.metrics_history 
                            if m.timestamp > recent_time and m.threshold_exceeded]
            
            if len(recent_metrics) > 10:
                return PerformanceStatus.DEGRADED.value
            elif len(recent_metrics) > 0:
                return PerformanceStatus.GOOD.value
            else:
                return PerformanceStatus.EXCELLENT.value
                
        except Exception as e:
            self.logger.error(f"Error getting performance status: {e}")
            return PerformanceStatus.CRITICAL.value
    
    def get_trend_analysis(self) -> Dict[str, Any]:
        """Get trend analysis results"""
        try:
            trends_by_type = defaultdict(list)
            for trend in self.trend_history:
                trends_by_type[trend.metric_type.value].append({
                    'direction': trend.trend_direction,
                    'strength': trend.trend_strength,
                    'confidence': trend.prediction_confidence,
                    'prediction_next_hour': trend.prediction_next_hour
                })
            
            return {
                'trends_by_resource': dict(trends_by_type),
                'total_trends': len(self.trend_history),
                'significant_trends': len([t for t in self.trend_history if t.r_squared > 0.7])
            }
            
        except Exception as e:
            self.logger.error(f"Error getting trend analysis: {e}")
            return {}
    
    def get_bottleneck_analysis(self) -> Dict[str, Any]:
        """Get bottleneck analysis results"""
        try:
            recent_bottlenecks = list(self.bottleneck_history)[-10:]  # Last 10 bottlenecks
            
            bottlenecks_by_severity = defaultdict(list)
            for bottleneck in recent_bottlenecks:
                bottlenecks_by_severity[bottleneck.severity].append({
                    'resource_type': bottleneck.resource_type.value,
                    'confidence': bottleneck.confidence,
                    'impact_score': bottleneck.impact_score,
                    'description': bottleneck.description,
                    'suggested_actions': bottleneck.suggested_actions
                })
            
            return {
                'bottlenecks_by_severity': dict(bottlenecks_by_severity),
                'total_bottlenecks': len(recent_bottlenecks),
                'critical_bottlenecks': len(bottlenecks_by_severity.get('critical', []))
            }
            
        except Exception as e:
            self.logger.error(f"Error getting bottleneck analysis: {e}")
            return {}
    
    def health_check(self) -> Dict[str, Any]:
        """Get performance analytics health status"""
        return {
            "status": "healthy" if self.analytics_active else "unhealthy",
            "analytics_active": self.analytics_active,
            "last_analysis": self.last_analysis.isoformat() if self.last_analysis else None,
            "metrics_in_buffer": len(self.metrics_history),
            "trends_tracked": len(self.trend_history),
            "bottlenecks_tracked": len(self.bottleneck_history),
            "resource_baselines": len(self.resource_baselines),
            "analytics_config": self.analytics_config,
            "performance_thresholds": {
                rt.value: thresholds for rt, thresholds in self.performance_thresholds.items()
            },
            "metrics": self.analytics_metrics
        } 