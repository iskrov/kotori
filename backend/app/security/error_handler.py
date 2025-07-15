"""
Production-ready error handling with security-aware error processing.

This module provides comprehensive error handling, structured responses,
and graceful degradation capabilities for production environments.
"""

import re
import json
import logging
import traceback
import time
from typing import Dict, List, Any, Optional, Union, Type, Callable
from dataclasses import dataclass, field
from enum import Enum
from contextlib import contextmanager
import asyncio
from concurrent.futures import ThreadPoolExecutor
import threading
from collections import defaultdict, deque


logger = logging.getLogger(__name__)


class ErrorSeverity(Enum):
    """Error severity levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ErrorCategory(Enum):
    """Error categories for classification."""
    AUTHENTICATION = "authentication"
    AUTHORIZATION = "authorization"
    VALIDATION = "validation"
    BUSINESS_LOGIC = "business_logic"
    SYSTEM = "system"
    NETWORK = "network"
    DATABASE = "database"
    EXTERNAL_SERVICE = "external_service"
    SECURITY = "security"
    UNKNOWN = "unknown"


@dataclass
class ErrorInfo:
    """Structured error information."""
    error_id: str
    category: ErrorCategory
    severity: ErrorSeverity
    message: str
    details: Dict[str, Any] = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)
    context: Dict[str, Any] = field(default_factory=dict)
    is_sensitive: bool = False
    should_log: bool = True
    retry_after: Optional[int] = None


@dataclass
class ErrorResponse:
    """Structured error response."""
    error_id: str
    message: str
    status_code: int
    details: Optional[Dict[str, Any]] = None
    timestamp: float = field(default_factory=time.time)
    retry_after: Optional[int] = None


class SecurityAwareErrorFilter:
    """Filter for removing sensitive information from error messages."""
    
    def __init__(self):
        self.sensitive_patterns = [
            # Database connection strings
            r'(?:postgres|mysql|sqlite)://[^:\s]+:[^@\s]+@[^/\s]+',
            # JWT tokens
            r'eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+',
            # API keys
            r'[Aa]pi[_\-]?[Kk]ey[\'"\s:=]+[A-Za-z0-9-_]{16,}',
            # Secrets
            r'[Ss]ecret[\'"\s:=]+[A-Za-z0-9-_]{16,}',
            # Passwords
            r'[Pp]assword[\'"\s:=]+[^\s\'"]+',
            # Session tokens
            r'[Ss]ession[\'"\s:=]+[A-Za-z0-9-_]{16,}',
            # File paths
            r'[C-Z]:\\[^\\/:*?"<>|\r\n]+',
            r'/(?:home|root|etc|var|usr)/[^\s]+',
            # IP addresses (internal)
            r'(?:10\.|192\.168\.|172\.(?:1[6-9]|2[0-9]|3[01])\.|127\.0\.0\.1)',
            # Email addresses
            r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
            # Stack traces (sensitive parts)
            r'File "[^"]+", line \d+, in [^\n]+',
            # SQL query fragments
            r'(?:SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)[^;]+;?',
        ]
        
        self.compiled_patterns = [re.compile(pattern, re.IGNORECASE) for pattern in self.sensitive_patterns]
        
        # Replacement patterns
        self.replacements = {
            'connection_string': '[DATABASE_CONNECTION_FILTERED]',
            'jwt_token': '[JWT_TOKEN_FILTERED]',
            'api_key': '[API_KEY_FILTERED]',
            'secret': '[SECRET_FILTERED]',
            'password': '[PASSWORD_FILTERED]',
            'session_token': '[SESSION_TOKEN_FILTERED]',
            'file_path': '[FILE_PATH_FILTERED]',
            'ip_address': '[IP_ADDRESS_FILTERED]',
            'email': '[EMAIL_FILTERED]',
            'stack_trace': '[STACK_TRACE_FILTERED]',
            'sql_query': '[SQL_QUERY_FILTERED]',
        }
    
    def filter_message(self, message: str) -> str:
        """
        Filter sensitive information from error message.
        
        Args:
            message: Original error message
            
        Returns:
            str: Filtered error message
        """
        if not message:
            return message
        
        filtered_message = message
        
        # Apply each pattern
        for i, pattern in enumerate(self.compiled_patterns):
            replacement_key = list(self.replacements.keys())[i % len(self.replacements)]
            replacement = self.replacements[replacement_key]
            filtered_message = pattern.sub(replacement, filtered_message)
        
        return filtered_message
    
    def filter_stack_trace(self, stack_trace: str) -> str:
        """
        Filter sensitive information from stack trace.
        
        Args:
            stack_trace: Original stack trace
            
        Returns:
            str: Filtered stack trace
        """
        if not stack_trace:
            return stack_trace
        
        lines = stack_trace.split('\n')
        filtered_lines = []
        
        for line in lines:
            # Filter file paths but keep function names
            if 'File "' in line:
                # Extract just the filename, not the full path
                file_match = re.search(r'File "([^"]+)"', line)
                if file_match:
                    full_path = file_match.group(1)
                    filename = full_path.split('/')[-1].split('\\')[-1]
                    line = line.replace(full_path, filename)
            
            # Filter sensitive content from the line
            filtered_line = self.filter_message(line)
            filtered_lines.append(filtered_line)
        
        return '\n'.join(filtered_lines)
    
    def is_sensitive_error(self, error: Exception) -> bool:
        """
        Check if error contains sensitive information.
        
        Args:
            error: Exception to check
            
        Returns:
            bool: True if error is sensitive
        """
        error_str = str(error)
        
        # Check if any sensitive patterns match
        for pattern in self.compiled_patterns:
            if pattern.search(error_str):
                return True
        
        # Check specific exception types
        sensitive_types = [
            'DatabaseError',
            'AuthenticationError',
            'CredentialError',
            'ConfigurationError'
        ]
        
        return any(sensitive_type in str(type(error)) for sensitive_type in sensitive_types)


class ErrorLogger:
    """Enhanced error logging with structured format and security filtering."""
    
    def __init__(self, filter_instance: SecurityAwareErrorFilter):
        self.filter = filter_instance
        self.log_queue = deque(maxlen=1000)
        self.error_counts: Dict[str, int] = defaultdict(int)
        self.error_patterns: Dict[str, List[float]] = defaultdict(list)
        self.security_events: List[Dict[str, Any]] = []
        
    def log_error(self, error_info: ErrorInfo, exception: Optional[Exception] = None):
        """
        Log error with security filtering and structured format.
        
        Args:
            error_info: Structured error information
            exception: Optional exception object
        """
        if not error_info.should_log:
            return
        
        # Filter sensitive information
        filtered_message = self.filter.filter_message(error_info.message)
        
        # Create log entry
        log_entry = {
            'error_id': error_info.error_id,
            'category': error_info.category.value,
            'severity': error_info.severity.value,
            'message': filtered_message,
            'timestamp': error_info.timestamp,
            'context': self._filter_context(error_info.context),
            'is_sensitive': error_info.is_sensitive
        }
        
        # Add exception details if available
        if exception:
            log_entry['exception_type'] = type(exception).__name__
            log_entry['exception_message'] = self.filter.filter_message(str(exception))
            
            # Add filtered stack trace for high severity errors
            if error_info.severity in [ErrorSeverity.HIGH, ErrorSeverity.CRITICAL]:
                stack_trace = traceback.format_exc()
                log_entry['stack_trace'] = self.filter.filter_stack_trace(stack_trace)
        
        # Log based on severity
        if error_info.severity == ErrorSeverity.CRITICAL:
            logger.critical(json.dumps(log_entry))
        elif error_info.severity == ErrorSeverity.HIGH:
            logger.error(json.dumps(log_entry))
        elif error_info.severity == ErrorSeverity.MEDIUM:
            logger.warning(json.dumps(log_entry))
        else:
            logger.info(json.dumps(log_entry))
        
        # Add to internal queue for analysis
        self.log_queue.append(log_entry)
        
        # Track error patterns
        self._track_error_patterns(error_info)
        
        # Log security events
        if error_info.category == ErrorCategory.SECURITY:
            self._log_security_event(error_info, log_entry)
    
    def _filter_context(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Filter sensitive information from context."""
        filtered_context = {}
        
        for key, value in context.items():
            if key.lower() in ['password', 'secret', 'token', 'key', 'auth']:
                filtered_context[key] = '[FILTERED]'
            elif isinstance(value, str):
                filtered_context[key] = self.filter.filter_message(value)
            elif isinstance(value, dict):
                filtered_context[key] = self._filter_context(value)
            else:
                filtered_context[key] = value
        
        return filtered_context
    
    def _track_error_patterns(self, error_info: ErrorInfo):
        """Track error patterns for analysis."""
        pattern_key = f"{error_info.category.value}:{error_info.severity.value}"
        current_time = time.time()
        
        self.error_counts[pattern_key] += 1
        self.error_patterns[pattern_key].append(current_time)
        
        # Keep only recent patterns (last hour)
        cutoff_time = current_time - 3600
        self.error_patterns[pattern_key] = [
            t for t in self.error_patterns[pattern_key] if t > cutoff_time
        ]
    
    def _log_security_event(self, error_info: ErrorInfo, log_entry: Dict[str, Any]):
        """Log security-related events."""
        security_event = {
            'event_id': error_info.error_id,
            'event_type': 'security_error',
            'severity': error_info.severity.value,
            'timestamp': error_info.timestamp,
            'details': log_entry,
            'requires_investigation': error_info.severity in [ErrorSeverity.HIGH, ErrorSeverity.CRITICAL]
        }
        
        self.security_events.append(security_event)
        
        # Keep only recent security events
        cutoff_time = time.time() - 86400  # 24 hours
        self.security_events = [
            event for event in self.security_events 
            if event['timestamp'] > cutoff_time
        ]
    
    def get_error_statistics(self) -> Dict[str, Any]:
        """Get error statistics for monitoring."""
        current_time = time.time()
        
        # Calculate error rates
        error_rates = {}
        for pattern, timestamps in self.error_patterns.items():
            recent_errors = [t for t in timestamps if current_time - t < 3600]
            error_rates[pattern] = len(recent_errors)
        
        return {
            'total_errors': len(self.log_queue),
            'error_rates_per_hour': error_rates,
            'error_counts': dict(self.error_counts),
            'security_events': len(self.security_events),
            'recent_critical_errors': len([
                entry for entry in self.log_queue 
                if entry['severity'] == 'critical' and current_time - entry['timestamp'] < 3600
            ])
        }


class GracefulDegradationManager:
    """Manager for graceful degradation of services under error conditions."""
    
    def __init__(self):
        self.circuit_breakers: Dict[str, Dict[str, Any]] = {}
        self.service_health: Dict[str, float] = {}
        self.degradation_levels: Dict[str, int] = {}
        self.recovery_strategies: Dict[str, Callable] = {}
        self.lock = threading.RLock()
        
    def register_service(
        self, 
        service_name: str, 
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
        recovery_strategy: Optional[Callable] = None
    ):
        """
        Register service for graceful degradation.
        
        Args:
            service_name: Name of the service
            failure_threshold: Number of failures before circuit breaks
            recovery_timeout: Timeout before attempting recovery
            recovery_strategy: Optional recovery strategy function
        """
        with self.lock:
            self.circuit_breakers[service_name] = {
                'state': 'closed',  # closed, open, half-open
                'failure_count': 0,
                'failure_threshold': failure_threshold,
                'last_failure_time': 0,
                'recovery_timeout': recovery_timeout,
                'success_count': 0
            }
            
            self.service_health[service_name] = 1.0
            self.degradation_levels[service_name] = 0
            
            if recovery_strategy:
                self.recovery_strategies[service_name] = recovery_strategy
    
    def record_success(self, service_name: str):
        """Record successful service call."""
        with self.lock:
            if service_name not in self.circuit_breakers:
                return
            
            breaker = self.circuit_breakers[service_name]
            
            if breaker['state'] == 'half-open':
                breaker['success_count'] += 1
                
                # If enough successes, close the circuit
                if breaker['success_count'] >= 3:
                    breaker['state'] = 'closed'
                    breaker['failure_count'] = 0
                    breaker['success_count'] = 0
                    self.service_health[service_name] = 1.0
                    self.degradation_levels[service_name] = 0
                    
                    logger.info(f"Circuit breaker closed for {service_name}")
            
            elif breaker['state'] == 'closed':
                # Reset failure count on success
                breaker['failure_count'] = max(0, breaker['failure_count'] - 1)
                
                # Improve service health
                self.service_health[service_name] = min(1.0, self.service_health[service_name] + 0.1)
    
    def record_failure(self, service_name: str, error_info: ErrorInfo):
        """Record service failure."""
        with self.lock:
            if service_name not in self.circuit_breakers:
                return
            
            breaker = self.circuit_breakers[service_name]
            breaker['failure_count'] += 1
            breaker['last_failure_time'] = time.time()
            
            # Degrade service health
            degradation_factor = 0.2 if error_info.severity == ErrorSeverity.CRITICAL else 0.1
            self.service_health[service_name] = max(0.0, self.service_health[service_name] - degradation_factor)
            
            # Check if circuit should open
            if breaker['failure_count'] >= breaker['failure_threshold']:
                breaker['state'] = 'open'
                self.degradation_levels[service_name] = min(3, self.degradation_levels[service_name] + 1)
                
                logger.warning(f"Circuit breaker opened for {service_name}")
    
    def should_allow_request(self, service_name: str) -> bool:
        """Check if request should be allowed based on circuit breaker state."""
        with self.lock:
            if service_name not in self.circuit_breakers:
                return True
            
            breaker = self.circuit_breakers[service_name]
            current_time = time.time()
            
            if breaker['state'] == 'closed':
                return True
            
            elif breaker['state'] == 'open':
                # Check if recovery timeout has passed
                if current_time - breaker['last_failure_time'] > breaker['recovery_timeout']:
                    breaker['state'] = 'half-open'
                    breaker['success_count'] = 0
                    logger.info(f"Circuit breaker half-open for {service_name}")
                    return True
                else:
                    return False
            
            elif breaker['state'] == 'half-open':
                return True
            
            return False
    
    def get_degraded_response(self, service_name: str) -> Dict[str, Any]:
        """Get degraded response for service."""
        degradation_level = self.degradation_levels.get(service_name, 0)
        
        if degradation_level == 0:
            return {'status': 'normal', 'message': 'Service operating normally'}
        
        elif degradation_level == 1:
            return {
                'status': 'degraded',
                'message': 'Service operating with reduced functionality',
                'features_disabled': ['non-essential-features']
            }
        
        elif degradation_level == 2:
            return {
                'status': 'limited',
                'message': 'Service operating with limited functionality',
                'features_disabled': ['non-essential-features', 'advanced-features']
            }
        
        else:
            return {
                'status': 'unavailable',
                'message': 'Service temporarily unavailable',
                'retry_after': 60
            }
    
    def attempt_recovery(self, service_name: str) -> bool:
        """Attempt to recover service."""
        if service_name in self.recovery_strategies:
            try:
                success = self.recovery_strategies[service_name]()
                if success:
                    self.record_success(service_name)
                    return True
            except Exception as e:
                logger.error(f"Recovery strategy failed for {service_name}: {e}")
        
        return False
    
    def get_service_status(self) -> Dict[str, Any]:
        """Get status of all services."""
        with self.lock:
            return {
                'services': {
                    name: {
                        'health': self.service_health.get(name, 0.0),
                        'degradation_level': self.degradation_levels.get(name, 0),
                        'circuit_state': self.circuit_breakers.get(name, {}).get('state', 'unknown')
                    }
                    for name in self.circuit_breakers.keys()
                }
            }


class ProductionErrorHandler:
    """Main error handler for production environments."""
    
    def __init__(self):
        self.filter = SecurityAwareErrorFilter()
        self.logger = ErrorLogger(self.filter)
        self.degradation_manager = GracefulDegradationManager()
        self.error_mapping = self._initialize_error_mapping()
        
    def _initialize_error_mapping(self) -> Dict[Type[Exception], Dict[str, Any]]:
        """Initialize error mapping for common exceptions."""
        return {
            ValueError: {
                'category': ErrorCategory.VALIDATION,
                'severity': ErrorSeverity.MEDIUM,
                'status_code': 400,
                'message': 'Invalid input provided'
            },
            KeyError: {
                'category': ErrorCategory.VALIDATION,
                'severity': ErrorSeverity.MEDIUM,
                'status_code': 400,
                'message': 'Required field missing'
            },
            PermissionError: {
                'category': ErrorCategory.AUTHORIZATION,
                'severity': ErrorSeverity.HIGH,
                'status_code': 403,
                'message': 'Access denied'
            },
            ConnectionError: {
                'category': ErrorCategory.NETWORK,
                'severity': ErrorSeverity.HIGH,
                'status_code': 503,
                'message': 'Service temporarily unavailable'
            },
            TimeoutError: {
                'category': ErrorCategory.SYSTEM,
                'severity': ErrorSeverity.MEDIUM,
                'status_code': 504,
                'message': 'Request timeout'
            }
        }
    
    def handle_error(
        self, 
        exception: Exception, 
        context: Optional[Dict[str, Any]] = None,
        service_name: Optional[str] = None
    ) -> ErrorResponse:
        """
        Handle error with comprehensive processing.
        
        Args:
            exception: Exception to handle
            context: Optional context information
            service_name: Optional service name for circuit breaker
            
        Returns:
            ErrorResponse: Structured error response
        """
        context = context or {}
        
        # Generate error ID
        error_id = self._generate_error_id(exception)
        
        # Determine error info
        error_info = self._classify_error(exception, error_id, context)
        
        # Record failure for circuit breaker
        if service_name:
            self.degradation_manager.record_failure(service_name, error_info)
        
        # Log the error
        self.logger.log_error(error_info, exception)
        
        # Create response
        response = self._create_error_response(error_info, exception)
        
        return response
    
    def _generate_error_id(self, exception: Exception) -> str:
        """Generate unique error ID."""
        import uuid
        import hashlib
        
        # Create deterministic but unique ID
        error_content = f"{type(exception).__name__}:{str(exception)[:100]}:{time.time()}"
        error_hash = hashlib.md5(error_content.encode()).hexdigest()[:8]
        
        return f"ERR_{error_hash}_{int(time.time())}"
    
    def _classify_error(self, exception: Exception, error_id: str, context: Dict[str, Any]) -> ErrorInfo:
        """Classify error and create ErrorInfo."""
        exception_type = type(exception)
        
        # Check if we have a mapping for this exception type
        if exception_type in self.error_mapping:
            mapping = self.error_mapping[exception_type]
            category = mapping['category']
            severity = mapping['severity']
            message = mapping['message']
        else:
            # Default classification
            category = ErrorCategory.UNKNOWN
            severity = ErrorSeverity.MEDIUM
            message = "An error occurred"
        
        # Check if error contains sensitive information
        is_sensitive = self.filter.is_sensitive_error(exception)
        
        # Create error info
        error_info = ErrorInfo(
            error_id=error_id,
            category=category,
            severity=severity,
            message=message,
            details={'original_message': str(exception)},
            context=context,
            is_sensitive=is_sensitive
        )
        
        return error_info
    
    def _create_error_response(self, error_info: ErrorInfo, exception: Exception) -> ErrorResponse:
        """Create error response."""
        # Get status code from mapping
        status_code = 500  # default
        exception_type = type(exception)
        
        if exception_type in self.error_mapping:
            status_code = self.error_mapping[exception_type]['status_code']
        
        # Create safe message for response
        if error_info.is_sensitive:
            public_message = "An error occurred. Please contact support."
        else:
            public_message = self.filter.filter_message(error_info.message)
        
        return ErrorResponse(
            error_id=error_info.error_id,
            message=public_message,
            status_code=status_code,
            retry_after=error_info.retry_after,
            timestamp=error_info.timestamp
        )
    
    def get_error_statistics(self) -> Dict[str, Any]:
        """Get comprehensive error statistics."""
        return {
            'error_logging': self.logger.get_error_statistics(),
            'service_health': self.degradation_manager.get_service_status(),
            'system_health': self._get_system_health()
        }
    
    def _get_system_health(self) -> Dict[str, Any]:
        """Get overall system health metrics."""
        stats = self.logger.get_error_statistics()
        
        # Calculate health score
        total_errors = stats['total_errors']
        critical_errors = stats['recent_critical_errors']
        
        if total_errors == 0:
            health_score = 1.0
        else:
            health_score = max(0.0, 1.0 - (critical_errors / total_errors))
        
        return {
            'health_score': health_score,
            'status': 'healthy' if health_score > 0.8 else 'degraded' if health_score > 0.5 else 'unhealthy',
            'uptime': time.time() - self._start_time if hasattr(self, '_start_time') else 0
        }


class ErrorHandlerMiddleware:
    """Middleware for handling errors at the application level."""
    
    def __init__(self, error_handler: ProductionErrorHandler):
        self.error_handler = error_handler
        self.start_time = time.time()
        self.error_handler._start_time = self.start_time
    
    async def __call__(self, request, call_next):
        """Process request with error handling."""
        try:
            response = await call_next(request)
            return response
        
        except Exception as e:
            # Extract context from request
            context = {
                'method': request.method,
                'path': request.url.path,
                'client_ip': request.client.host if hasattr(request, 'client') else None,
                'user_agent': request.headers.get('user-agent', ''),
                'request_id': request.headers.get('x-request-id', '')
            }
            
            # Handle error
            error_response = self.error_handler.handle_error(e, context)
            
            # Return appropriate HTTP response
            from fastapi import HTTPException
            from fastapi.responses import JSONResponse
            
            return JSONResponse(
                status_code=error_response.status_code,
                content={
                    'error': {
                        'id': error_response.error_id,
                        'message': error_response.message,
                        'timestamp': error_response.timestamp
                    }
                }
            )


# Global error handler instance
production_error_handler = ProductionErrorHandler()


@contextmanager
def error_handling_context(service_name: Optional[str] = None):
    """Context manager for error handling."""
    try:
        yield
    except Exception as e:
        error_response = production_error_handler.handle_error(e, service_name=service_name)
        raise HTTPException(
            status_code=error_response.status_code,
            detail=error_response.message
        ) from e 