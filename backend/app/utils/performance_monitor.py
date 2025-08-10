"""
Performance Monitoring Utilities for Secret Phrase Processing

This module provides comprehensive performance monitoring capabilities for the phrase
processing system. It includes metrics collection, timing measurements, resource
monitoring, and performance analytics.

Security features:
- Anonymized performance data collection
- Secure metrics aggregation
- No sensitive data in performance logs
"""

import time
import psutil
import threading
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from collections import defaultdict, deque
import logging
import json
from contextlib import contextmanager
from functools import wraps
import asyncio

logger = logging.getLogger(__name__)

@dataclass
class PerformanceMetric:
    """Single performance metric measurement"""
    name: str
    value: float
    unit: str
    timestamp: datetime
    tags: Dict[str, str] = field(default_factory=dict)

@dataclass
class TimingMetric:
    """Timing measurement with context"""
    operation: str
    duration_ms: float
    timestamp: datetime
    success: bool = True
    error: Optional[str] = None
    tags: Dict[str, str] = field(default_factory=dict)

@dataclass
class ResourceMetric:
    """System resource measurement"""
    cpu_percent: float
    memory_percent: float
    memory_mb: float
    disk_io_read_mb: float
    disk_io_write_mb: float
    network_sent_mb: float
    network_recv_mb: float
    timestamp: datetime

class PerformanceMonitor:
    """
    Comprehensive performance monitoring system with metrics collection and analysis.
    
    This class provides real-time performance monitoring, metrics collection,
    and performance analytics for the secret phrase processing system.
    """
    
    def __init__(self, max_metrics: int = 10000, retention_hours: int = 24):
        """
        Initialize performance monitor.
        
        Args:
            max_metrics: Maximum number of metrics to retain in memory
            retention_hours: Hours to retain metrics data
        """
        self.max_metrics = max_metrics
        self.retention_hours = retention_hours
        
        # Metrics storage
        self.metrics: deque = deque(maxlen=max_metrics)
        self.timing_metrics: deque = deque(maxlen=max_metrics)
        self.resource_metrics: deque = deque(maxlen=max_metrics)
        
        # Performance counters
        self.counters: Dict[str, int] = defaultdict(int)
        self.gauges: Dict[str, float] = defaultdict(float)
        self.histograms: Dict[str, List[float]] = defaultdict(list)
        
        # Thread safety
        self.lock = threading.RLock()
        
        # Resource monitoring
        self.process = psutil.Process()
        self.start_time = datetime.now(timezone.utc)
        
        # Initialize IO counters with fallback for Cloud Run environments
        try:
            self.last_disk_io = self.process.io_counters()
        except (ValueError, OSError) as e:
            logger.warning(f"Unable to initialize disk IO counters (common in containerized environments): {e}")
            self.last_disk_io = None
            
        try:
            self.last_network_io = psutil.net_io_counters()
        except (ValueError, OSError) as e:
            logger.warning(f"Unable to initialize network IO counters: {e}")
            self.last_network_io = None
        
        # Background monitoring
        self.monitoring_active = False
        self.monitoring_thread = None
        self.monitoring_interval = 60  # seconds
    
    def start_monitoring(self):
        """Start background resource monitoring."""
        with self.lock:
            if not self.monitoring_active:
                self.monitoring_active = True
                self.monitoring_thread = threading.Thread(target=self._monitoring_loop, daemon=True)
                self.monitoring_thread.start()
                logger.info("Performance monitoring started")
    
    def stop_monitoring(self):
        """Stop background resource monitoring."""
        with self.lock:
            self.monitoring_active = False
            if self.monitoring_thread:
                self.monitoring_thread.join(timeout=5)
                self.monitoring_thread = None
                logger.info("Performance monitoring stopped")
    
    def _monitoring_loop(self):
        """Background monitoring loop."""
        while self.monitoring_active:
            try:
                self._collect_resource_metrics()
                self._cleanup_old_metrics()
                time.sleep(self.monitoring_interval)
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                time.sleep(self.monitoring_interval)
    
    def _collect_resource_metrics(self):
        """Collect current system resource metrics."""
        try:
            # CPU and memory
            cpu_percent = self.process.cpu_percent()
            memory_info = self.process.memory_info()
            memory_percent = self.process.memory_percent()
            
            # Disk I/O (with fallback for containerized environments)
            disk_read_mb = 0.0
            disk_write_mb = 0.0
            if self.last_disk_io is not None:
                try:
                    current_disk_io = self.process.io_counters()
                    disk_read_mb = (current_disk_io.read_bytes - self.last_disk_io.read_bytes) / (1024 * 1024)
                    disk_write_mb = (current_disk_io.write_bytes - self.last_disk_io.write_bytes) / (1024 * 1024)
                    self.last_disk_io = current_disk_io
                except (ValueError, OSError):
                    # IO counters not available in this environment
                    pass
            
            # Network I/O (with fallback for containerized environments)
            network_sent_mb = 0.0
            network_recv_mb = 0.0
            if self.last_network_io is not None:
                try:
                    current_network_io = psutil.net_io_counters()
                    if current_network_io is not None:
                        network_sent_mb = (current_network_io.bytes_sent - self.last_network_io.bytes_sent) / (1024 * 1024)
                        network_recv_mb = (current_network_io.bytes_recv - self.last_network_io.bytes_recv) / (1024 * 1024)
                        self.last_network_io = current_network_io
                except (ValueError, OSError):
                    # Network IO counters not available in this environment
                    pass
            
            # Create resource metric
            resource_metric = ResourceMetric(
                cpu_percent=cpu_percent,
                memory_percent=memory_percent,
                memory_mb=memory_info.rss / (1024 * 1024),
                disk_io_read_mb=disk_read_mb,
                disk_io_write_mb=disk_write_mb,
                network_sent_mb=network_sent_mb,
                network_recv_mb=network_recv_mb,
                timestamp=datetime.now(timezone.utc)
            )
            
            with self.lock:
                self.resource_metrics.append(resource_metric)
                
                # Update gauges
                self.gauges['cpu_percent'] = cpu_percent
                self.gauges['memory_percent'] = memory_percent
                self.gauges['memory_mb'] = memory_info.rss / (1024 * 1024)
                
        except Exception as e:
            logger.error(f"Error collecting resource metrics: {e}")
    
    def _cleanup_old_metrics(self):
        """Remove old metrics based on retention policy."""
        try:
            cutoff_time = datetime.now(timezone.utc) - timedelta(hours=self.retention_hours)
            
            with self.lock:
                # Clean up metrics
                self.metrics = deque(
                    [m for m in self.metrics if m.timestamp > cutoff_time],
                    maxlen=self.max_metrics
                )
                
                # Clean up timing metrics
                self.timing_metrics = deque(
                    [t for t in self.timing_metrics if t.timestamp > cutoff_time],
                    maxlen=self.max_metrics
                )
                
                # Clean up resource metrics
                self.resource_metrics = deque(
                    [r for r in self.resource_metrics if r.timestamp > cutoff_time],
                    maxlen=self.max_metrics
                )
                
                # Clean up histograms
                for key in list(self.histograms.keys()):
                    if len(self.histograms[key]) > 1000:  # Keep last 1000 measurements
                        self.histograms[key] = self.histograms[key][-1000:]
                        
        except Exception as e:
            logger.error(f"Error cleaning up old metrics: {e}")
    
    def record_metric(self, name: str, value: float, unit: str = "", tags: Optional[Dict[str, str]] = None):
        """
        Record a performance metric.
        
        Args:
            name: Metric name
            value: Metric value
            unit: Unit of measurement
            tags: Optional tags for metric categorization
        """
        metric = PerformanceMetric(
            name=name,
            value=value,
            unit=unit,
            timestamp=datetime.now(timezone.utc),
            tags=tags or {}
        )
        
        with self.lock:
            self.metrics.append(metric)
            self.histograms[name].append(value)
    
    def record_timing(self, operation: str, duration_ms: float, success: bool = True, 
                     error: Optional[str] = None, tags: Optional[Dict[str, str]] = None):
        """
        Record a timing measurement.
        
        Args:
            operation: Operation name
            duration_ms: Duration in milliseconds
            success: Whether operation was successful
            error: Error message if failed
            tags: Optional tags for categorization
        """
        timing_metric = TimingMetric(
            operation=operation,
            duration_ms=duration_ms,
            timestamp=datetime.now(timezone.utc),
            success=success,
            error=error,
            tags=tags or {}
        )
        
        with self.lock:
            self.timing_metrics.append(timing_metric)
            self.histograms[f"{operation}_duration_ms"].append(duration_ms)
            
            # Update counters
            self.counters[f"{operation}_total"] += 1
            if success:
                self.counters[f"{operation}_success"] += 1
            else:
                self.counters[f"{operation}_error"] += 1
    
    def increment_counter(self, name: str, value: int = 1, tags: Optional[Dict[str, str]] = None):
        """
        Increment a counter metric.
        
        Args:
            name: Counter name
            value: Value to increment by
            tags: Optional tags
        """
        with self.lock:
            self.counters[name] += value
            
        # Also record as a metric
        self.record_metric(name, value, "count", tags)
    
    def set_gauge(self, name: str, value: float, tags: Optional[Dict[str, str]] = None):
        """
        Set a gauge metric value.
        
        Args:
            name: Gauge name
            value: Current value
            tags: Optional tags
        """
        with self.lock:
            self.gauges[name] = value
            
        # Also record as a metric
        self.record_metric(name, value, "gauge", tags)
    
    @contextmanager
    def time_operation(self, operation: str, tags: Optional[Dict[str, str]] = None):
        """
        Context manager for timing operations.
        
        Args:
            operation: Operation name
            tags: Optional tags
            
        Usage:
            with monitor.time_operation("phrase_processing"):
                # Code to time
                pass
        """
        start_time = time.time()
        success = True
        error = None
        
        try:
            yield
        except Exception as e:
            success = False
            error = str(e)
            raise
        finally:
            duration_ms = (time.time() - start_time) * 1000
            self.record_timing(operation, duration_ms, success, error, tags)
    
    def time_function(self, operation: Optional[str] = None, tags: Optional[Dict[str, str]] = None):
        """
        Decorator for timing function calls.
        
        Args:
            operation: Operation name (defaults to function name)
            tags: Optional tags
            
        Usage:
            @monitor.time_function("phrase_processing")
            def process_phrase(phrase):
                # Function implementation
                pass
        """
        def decorator(func):
            op_name = operation or func.__name__
            
            @wraps(func)
            def wrapper(*args, **kwargs):
                with self.time_operation(op_name, tags):
                    return func(*args, **kwargs)
            
            @wraps(func)
            async def async_wrapper(*args, **kwargs):
                with self.time_operation(op_name, tags):
                    return await func(*args, **kwargs)
            
            return async_wrapper if asyncio.iscoroutinefunction(func) else wrapper
        return decorator
    
    def get_metrics_summary(self) -> Dict[str, Any]:
        """
        Get a summary of current metrics.
        
        Returns:
            Dictionary containing metrics summary
        """
        with self.lock:
            now = datetime.now(timezone.utc)
            uptime_seconds = (now - self.start_time).total_seconds()
            
            summary = {
                'uptime_seconds': uptime_seconds,
                'total_metrics': len(self.metrics),
                'total_timing_metrics': len(self.timing_metrics),
                'total_resource_metrics': len(self.resource_metrics),
                'counters': dict(self.counters),
                'gauges': dict(self.gauges),
                'timestamp': now.isoformat()
            }
            
            # Add histogram summaries
            histogram_summaries = {}
            for name, values in self.histograms.items():
                if values:
                    histogram_summaries[name] = {
                        'count': len(values),
                        'min': min(values),
                        'max': max(values),
                        'avg': sum(values) / len(values),
                        'p50': self._percentile(values, 50),
                        'p95': self._percentile(values, 95),
                        'p99': self._percentile(values, 99)
                    }
            
            summary['histograms'] = histogram_summaries
            
            return summary
    
    def get_operation_stats(self, operation: str) -> Dict[str, Any]:
        """
        Get statistics for a specific operation.
        
        Args:
            operation: Operation name
            
        Returns:
            Dictionary containing operation statistics
        """
        with self.lock:
            # Filter timing metrics for this operation
            op_metrics = [t for t in self.timing_metrics if t.operation == operation]
            
            if not op_metrics:
                return {'operation': operation, 'count': 0}
            
            durations = [m.duration_ms for m in op_metrics]
            success_count = sum(1 for m in op_metrics if m.success)
            error_count = len(op_metrics) - success_count
            
            return {
                'operation': operation,
                'count': len(op_metrics),
                'success_count': success_count,
                'error_count': error_count,
                'success_rate': success_count / len(op_metrics) if op_metrics else 0,
                'duration_ms': {
                    'min': min(durations),
                    'max': max(durations),
                    'avg': sum(durations) / len(durations),
                    'p50': self._percentile(durations, 50),
                    'p95': self._percentile(durations, 95),
                    'p99': self._percentile(durations, 99)
                }
            }
    
    def get_resource_stats(self) -> Dict[str, Any]:
        """
        Get current resource utilization statistics.
        
        Returns:
            Dictionary containing resource statistics
        """
        with self.lock:
            if not self.resource_metrics:
                return {'error': 'No resource metrics available'}
            
            # Get recent metrics (last 5 minutes)
            recent_time = datetime.now(timezone.utc) - timedelta(minutes=5)
            recent_metrics = [r for r in self.resource_metrics if r.timestamp > recent_time]
            
            if not recent_metrics:
                recent_metrics = list(self.resource_metrics)[-10:]  # Last 10 if no recent data
            
            # Calculate averages
            avg_cpu = sum(r.cpu_percent for r in recent_metrics) / len(recent_metrics)
            avg_memory = sum(r.memory_percent for r in recent_metrics) / len(recent_metrics)
            avg_memory_mb = sum(r.memory_mb for r in recent_metrics) / len(recent_metrics)
            
            return {
                'cpu_percent': {
                    'current': recent_metrics[-1].cpu_percent,
                    'average': avg_cpu,
                    'max': max(r.cpu_percent for r in recent_metrics)
                },
                'memory_percent': {
                    'current': recent_metrics[-1].memory_percent,
                    'average': avg_memory,
                    'max': max(r.memory_percent for r in recent_metrics)
                },
                'memory_mb': {
                    'current': recent_metrics[-1].memory_mb,
                    'average': avg_memory_mb,
                    'max': max(r.memory_mb for r in recent_metrics)
                },
                'sample_count': len(recent_metrics),
                'timestamp': recent_metrics[-1].timestamp.isoformat()
            }
    
    def _percentile(self, values: List[float], percentile: int) -> float:
        """Calculate percentile value from a list of values."""
        if not values:
            return 0.0
        
        sorted_values = sorted(values)
        k = (len(sorted_values) - 1) * percentile / 100
        f = int(k)
        c = k - f
        
        if f == len(sorted_values) - 1:
            return sorted_values[f]
        
        return sorted_values[f] * (1 - c) + sorted_values[f + 1] * c
    
    def export_metrics(self, format: str = 'json') -> str:
        """
        Export metrics in specified format.
        
        Args:
            format: Export format ('json' or 'prometheus')
            
        Returns:
            Formatted metrics string
        """
        if format == 'json':
            return json.dumps(self.get_metrics_summary(), indent=2)
        elif format == 'prometheus':
            return self._export_prometheus()
        else:
            raise ValueError(f"Unsupported format: {format}")
    
    def _export_prometheus(self) -> str:
        """Export metrics in Prometheus format."""
        lines = []
        
        with self.lock:
            # Export counters
            for name, value in self.counters.items():
                lines.append(f'# TYPE {name} counter')
                lines.append(f'{name} {value}')
            
            # Export gauges
            for name, value in self.gauges.items():
                lines.append(f'# TYPE {name} gauge')
                lines.append(f'{name} {value}')
            
            # Export histograms
            for name, values in self.histograms.items():
                if values:
                    lines.append(f'# TYPE {name} histogram')
                    lines.append(f'{name}_count {len(values)}')
                    lines.append(f'{name}_sum {sum(values)}')
                    
                    # Add percentiles
                    for p in [50, 95, 99]:
                        percentile_value = self._percentile(values, p)
                        lines.append(f'{name}{{quantile="0.{p:02d}"}} {percentile_value}')
        
        return '\n'.join(lines)
    
    def health_check(self) -> Dict[str, Any]:
        """
        Perform a health check of the monitoring system.
        
        Returns:
            Dictionary containing health status
        """
        try:
            with self.lock:
                now = datetime.now(timezone.utc)
                uptime = (now - self.start_time).total_seconds()
                
                # Check if monitoring is active
                monitoring_status = "active" if self.monitoring_active else "inactive"
                
                # Check memory usage
                memory_usage = len(self.metrics) + len(self.timing_metrics) + len(self.resource_metrics)
                memory_status = "ok" if memory_usage < self.max_metrics * 0.8 else "high"
                
                # Check recent activity
                recent_time = now - timedelta(minutes=5)
                recent_metrics = sum(1 for m in self.metrics if m.timestamp > recent_time)
                activity_status = "active" if recent_metrics > 0 else "idle"
                
                return {
                    'status': 'healthy',
                    'uptime_seconds': uptime,
                    'monitoring_status': monitoring_status,
                    'memory_usage': memory_usage,
                    'memory_status': memory_status,
                    'activity_status': activity_status,
                    'recent_metrics': recent_metrics,
                    'timestamp': now.isoformat()
                }
        except Exception as e:
            return {
                'status': 'unhealthy',
                'error': str(e),
                'timestamp': datetime.now(timezone.utc).isoformat()
            }

# Global performance monitor instance
_global_monitor = None

def get_performance_monitor() -> PerformanceMonitor:
    """Get the global performance monitor instance."""
    global _global_monitor
    if _global_monitor is None:
        _global_monitor = PerformanceMonitor()
        _global_monitor.start_monitoring()
    return _global_monitor

# Convenience decorators and context managers
def time_function(operation: Optional[str] = None, tags: Optional[Dict[str, str]] = None):
    """Decorator for timing function calls using global monitor."""
    return get_performance_monitor().time_function(operation, tags)

@contextmanager
def time_operation(operation: str, tags: Optional[Dict[str, str]] = None):
    """Context manager for timing operations using global monitor."""
    with get_performance_monitor().time_operation(operation, tags):
        yield

def record_metric(name: str, value: float, unit: str = "", tags: Optional[Dict[str, str]] = None):
    """Record a metric using global monitor."""
    get_performance_monitor().record_metric(name, value, unit, tags)

def increment_counter(name: str, value: int = 1, tags: Optional[Dict[str, str]] = None):
    """Increment a counter using global monitor."""
    get_performance_monitor().increment_counter(name, value, tags)

def set_gauge(name: str, value: float, tags: Optional[Dict[str, str]] = None):
    """Set a gauge value using global monitor."""
    get_performance_monitor().set_gauge(name, value, tags) 