"""
Unified security middleware that orchestrates all security components.

This middleware provides a comprehensive security pipeline that integrates
rate limiting, input validation, error handling, and other security measures.
"""

import time
import secrets
import logging
import asyncio
from typing import Dict, Any, List, Optional, Callable
from dataclasses import dataclass, field
from contextlib import asynccontextmanager
from collections import defaultdict

from fastapi import Request, Response, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.security.rate_limiter import RateLimitConfig, RateLimiterService
from app.security.input_validator import InputValidator
from app.security.constant_time import ConstantTimeOperations
from app.security.memory_protection import SecureMemoryManager
from app.security.security_headers import SecurityHeadersManager, SecurityConfig as HeadersSecurityConfig
from app.security.error_handler import ProductionErrorHandler, ErrorCategory, ErrorSeverity
from app.core.config import Settings
from app.core.security import audit_security_event
from app.utils.secure_utils import SecureTokenGenerator, SecureHasher

logger = logging.getLogger(__name__)

# Simple SecurityConfig class for backwards compatibility
@dataclass
class SecurityConfig:
    """Security configuration for middleware."""
    enable_rate_limiting: bool = True
    enable_input_validation: bool = True
    enable_timing_protection: bool = True
    enable_memory_protection: bool = True
    enable_ip_blocking: bool = True
    block_threshold: float = 0.8
    max_requests_per_minute: int = 100
    max_failed_attempts: int = 5

# Utility functions
def generate_nonce(length: int = 16) -> str:
    """Generate a secure nonce."""
    return SecureTokenGenerator.generate_nonce(length)

def hash_client_identifier(identifier: str) -> str:
    """Hash a client identifier for privacy."""
    return SecureHasher.hash_data(identifier)

# Class aliases for backward compatibility
# RateLimiterService = RateLimitStrategy
SecurityHeadersMiddleware = SecurityHeadersManager
TimingAttackProtection = ConstantTimeOperations
TimingProtection = ConstantTimeOperations
IPBlockingManager = None  # Will implement as needed
AttackDetector = None  # Will implement as needed


@dataclass
class SecurityContext:
    """Security context for request processing."""
    request_id: str
    client_ip: str
    user_agent: str
    timestamp: float
    nonce: str
    threat_level: int = 0
    is_authenticated: bool = False
    user_id: Optional[str] = None
    blocked_reasons: List[str] = None
    rate_limit_remaining: int = 0
    security_events: List[Dict[str, Any]] = None
    
    def __post_init__(self):
        if self.blocked_reasons is None:
            self.blocked_reasons = []
        if self.security_events is None:
            self.security_events = []


@dataclass
class SecurityMetrics:
    """Security metrics for monitoring."""
    total_requests: int = 0
    blocked_requests: int = 0
    rate_limited_requests: int = 0
    validation_failures: int = 0
    security_events: int = 0
    attack_attempts: int = 0
    average_response_time: float = 0.0
    threat_scores: Dict[str, float] = None
    
    def __post_init__(self):
        if self.threat_scores is None:
            self.threat_scores = {}


class SecurityMiddleware(BaseHTTPMiddleware):
    """Comprehensive security middleware."""
    
    def __init__(
        self,
        app,
        rate_limit_config: Optional[RateLimitConfig] = None,
        security_config: Optional[SecurityConfig] = None,
        enable_timing_protection: bool = True,
        enable_memory_protection: bool = True,
        enable_ip_blocking: bool = True,
        block_threshold: float = 0.8
    ):
        super().__init__(app)
        
        # Initialize components
        self.rate_limiter = RateLimiterService(rate_limit_config or RateLimitConfig())
        self.input_validator = InputValidator()
        self.error_handler = ProductionErrorHandler()
        self.headers_middleware = SecurityHeadersManager(HeadersSecurityConfig())
        self.memory_manager = SecureMemoryManager() if enable_memory_protection else None
        self.timing_protection = TimingAttackProtection() if enable_timing_protection else None
        
        # Configuration
        self.enable_timing_protection = enable_timing_protection
        self.enable_memory_protection = enable_memory_protection
        self.enable_ip_blocking = enable_ip_blocking
        self.block_threshold = block_threshold
        
        # Security state
        self.blocked_ips: Dict[str, Dict[str, Any]] = {}
        self.request_contexts: Dict[str, SecurityContext] = {}
        self.security_metrics = SecurityMetrics()
        self.suspicious_patterns: Dict[str, List[float]] = defaultdict(list)
        
        # Rate limiting for sensitive endpoints
        self.sensitive_endpoints = {
            '/auth/login': {'limit': 5, 'window': 900},  # 5 attempts per 15 min
            '/auth/register': {'limit': 3, 'window': 3600},  # 3 attempts per hour
            '/auth/password-reset': {'limit': 3, 'window': 3600},
            '/api/admin/': {'limit': 10, 'window': 60},  # Admin endpoints
        }
        
        # Initialize monitoring
        self.start_time = time.time()
        self.cleanup_interval = 300  # 5 minutes
        self.last_cleanup = time.time()

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Main security middleware processing pipeline.
        
        Args:
            request: HTTP request
            call_next: Next middleware in chain
            
        Returns:
            Response: Processed response
        """
        start_time = time.time()
        
        # Phase 1: Pre-processing and initialization
        context = await self._initialize_security_context(request)
        
        try:
            # Phase 2-4: Security checks (bypass in dev for localhost to prevent CORS-like failures)
            from app.core.config import settings
            dev_localhost = settings.ENVIRONMENT == "development" and context.client_ip in {"127.0.0.1", "::1"}

            # IP blocking
            if not dev_localhost:
                await self._check_ip_blocking(context)

            # Rate limiting
            if not dev_localhost:
                await self._apply_rate_limiting(request, context)

            # Input validation
            if not dev_localhost:
                await self._validate_input(request, context)
            
            # Phase 5: Timing attack protection
            if self.enable_timing_protection:
                await self._apply_timing_protection(request, context)
            
            # Phase 6: Process request
            response = await call_next(request)
            
            # Phase 7: Post-processing
            await self._post_process_response(request, response, context)
            
            # Update metrics
            self._update_metrics(context, time.time() - start_time)
            
            return response
            
        except HTTPException as e:
            # Handle HTTP exceptions
            await self._handle_security_violation(request, context, e)
            raise
            
        except Exception as e:
            # Handle other exceptions
            error_response = self.error_handler.handle_error(e, context.__dict__)
            await self._log_security_event(context, 'error', {'error': str(e)})
            
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
        
        finally:
            # Cleanup
            await self._cleanup_request_context(context)
    
    async def _initialize_security_context(self, request: Request) -> SecurityContext:
        """Initialize security context for request."""
        request_id = secrets.token_urlsafe(16)
        client_ip = self._get_client_ip(request)
        user_agent = request.headers.get('user-agent', '')
        nonce = secrets.token_urlsafe(16)
        
        context = SecurityContext(
            request_id=request_id,
            client_ip=client_ip,
            user_agent=user_agent,
            timestamp=time.time(),
            nonce=nonce
        )
        
        self.request_contexts[request_id] = context
        
        # Set request attributes
        request.state.security_context = context
        request.state.request_id = request_id
        request.state.nonce = nonce
        
        return context
    
    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address from request."""
        # Check X-Forwarded-For header first
        forwarded_for = request.headers.get('X-Forwarded-For')
        if forwarded_for:
            # Take the first IP in the chain
            return forwarded_for.split(',')[0].strip()
        
        # Check X-Real-IP header
        real_ip = request.headers.get('X-Real-IP')
        if real_ip:
            return real_ip
        
        # Fall back to client host
        return request.client.host if request.client else 'unknown'
    
    async def _check_ip_blocking(self, context: SecurityContext):
        """Check if IP is blocked."""
        if not self.enable_ip_blocking:
            return
        
        ip_info = self.blocked_ips.get(context.client_ip)
        if ip_info:
            current_time = time.time()
            
            # Check if block has expired
            if current_time < ip_info['blocked_until']:
                context.blocked_reasons.append(f"IP blocked until {ip_info['blocked_until']}")
                await self._log_security_event(context, 'ip_blocked', ip_info)
                raise HTTPException(
                    status_code=429,
                    detail={
                        'error': 'IP address temporarily blocked',
                        'retry_after': int(ip_info['blocked_until'] - current_time)
                    }
                )
            else:
                # Block expired, remove from list
                del self.blocked_ips[context.client_ip]
    
    async def _apply_rate_limiting(self, request: Request, context: SecurityContext):
        """Apply rate limiting to request."""
        # Get rate limit configuration for endpoint
        endpoint_path = request.url.path
        rate_config = self._get_rate_limit_config(endpoint_path)
        
        # Create request info for rate limiter
        request_info = {
            'endpoint': endpoint_path,
            'method': request.method,
            'user_agent': context.user_agent,
            'timestamp': context.timestamp,
            'is_authenticated': context.is_authenticated
        }
        
        # Check rate limit
        result = await self.rate_limiter.check_rate_limit(context.client_ip, request_info)
        
        context.rate_limit_remaining = result.remaining_requests
        
        if not result.allowed:
            context.blocked_reasons.append('Rate limit exceeded')
            
            # Check for attack patterns
            if result.attack_detected:
                context.threat_level += 3
                await self._process_attack_patterns(context, result.attack_patterns)
            
            await self._log_security_event(context, 'rate_limited', {
                'remaining': result.remaining_requests,
                'reset_time': result.reset_time,
                'attack_detected': result.attack_detected
            })
            
            raise HTTPException(
                status_code=429,
                detail={
                    'error': 'Rate limit exceeded',
                    'retry_after': result.retry_after
                }
            )
    
    def _get_rate_limit_config(self, endpoint: str) -> Dict[str, Any]:
        """Get rate limit configuration for endpoint."""
        # Check for specific endpoint configuration
        for pattern, config in self.sensitive_endpoints.items():
            if endpoint.startswith(pattern):
                return config
        
        # Default configuration
        return {'limit': 100, 'window': 60}
    
    async def _validate_input(self, request: Request, context: SecurityContext):
        """Validate request input."""
        # Validate headers
        await self._validate_headers(request, context)
        
        # Validate query parameters
        if request.query_params:
            await self._validate_query_params(request, context)
        
        # Validate body if present
        if request.method in ['POST', 'PUT', 'PATCH']:
            await self._validate_request_body(request, context)
    
    async def _validate_headers(self, request: Request, context: SecurityContext):
        """Validate request headers."""
        dangerous_headers = ['x-forwarded-host', 'x-originating-ip', 'x-remote-ip']
        
        for header_name, header_value in request.headers.items():
            # Check for dangerous headers
            if header_name.lower() in dangerous_headers:
                context.threat_level += 1
                await self._log_security_event(context, 'dangerous_header', {
                    'header': header_name,
                    'value': header_value[:100]  # Log first 100 chars only
                })
            
            # Validate header value
            if isinstance(header_value, str):
                result = self.input_validator.validate_input(header_value, 'string')
                if not result.is_valid:
                    context.threat_level += 2
                    await self._log_security_event(context, 'invalid_header', {
                        'header': header_name,
                        'errors': result.errors
                    })
    
    async def _validate_query_params(self, request: Request, context: SecurityContext):
        """Validate query parameters."""
        for param_name, param_value in request.query_params.items():
            result = self.input_validator.validate_input(param_value, 'string')
            if not result.is_valid:
                context.threat_level += 1
                await self._log_security_event(context, 'invalid_query_param', {
                    'param': param_name,
                    'errors': result.errors
                })
    
    async def _validate_request_body(self, request: Request, context: SecurityContext):
        """Validate request body."""
        try:
            # Get content type
            content_type = request.headers.get('content-type', '')
            
            if 'application/json' in content_type:
                # For JSON, we'll validate after parsing
                pass
            elif 'application/x-www-form-urlencoded' in content_type:
                # For form data, validate each field
                pass
            elif 'multipart/form-data' in content_type:
                # For file uploads, validate file data
                pass
            
        except Exception as e:
            context.threat_level += 1
            await self._log_security_event(context, 'body_validation_error', {
                'error': str(e)
            })
    
    async def _apply_timing_protection(self, request: Request, context: SecurityContext):
        """Apply timing attack protection."""
        if not self.timing_protection:
            return
        
        # Apply timing protection for sensitive endpoints
        endpoint_path = request.url.path
        if any(endpoint_path.startswith(pattern) for pattern in self.sensitive_endpoints.keys()):
            # Add timing protection delay
            delay = self.timing_protection.get_delay_for_attempt(context.client_ip)
            if delay > 0:
                await asyncio.sleep(delay)
    
    async def _post_process_response(self, request: Request, response: Response, context: SecurityContext):
        """Post-process response with security measures."""
        # Apply security headers
        security_headers = self.headers_middleware.get_security_headers(
            context.request_id,
            request.url.scheme == 'https'
        )
        
        for header_name, header_value in security_headers.items():
            response.headers[header_name] = header_value
        
        # Add security context to response
        response.headers['X-Request-ID'] = context.request_id
        response.headers['X-Security-Level'] = str(context.threat_level)
        
        # Log successful request
        await self._log_security_event(context, 'request_processed', {
            'status_code': response.status_code,
            'threat_level': context.threat_level
        })
    
    async def _process_attack_patterns(self, context: SecurityContext, attack_patterns):
        """Process detected attack patterns."""
        for pattern in attack_patterns:
            context.threat_level += pattern.severity
            
            await self._log_security_event(context, 'attack_pattern', {
                'type': pattern.attack_type.value,
                'confidence': pattern.confidence,
                'severity': pattern.severity,
                'details': pattern.details
            })
            
            # Check if IP should be blocked
            if pattern.confidence > self.block_threshold:
                await self._block_ip(context.client_ip, pattern)
    
    async def _block_ip(self, ip_address: str, attack_pattern):
        """Block IP address based on attack pattern."""
        if not self.enable_ip_blocking:
            return
        
        # Calculate block duration based on severity
        base_duration = 300  # 5 minutes
        duration = base_duration * (attack_pattern.severity / 5)
        
        block_until = time.time() + duration
        
        self.blocked_ips[ip_address] = {
            'blocked_at': time.time(),
            'blocked_until': block_until,
            'reason': attack_pattern.attack_type.value,
            'confidence': attack_pattern.confidence,
            'severity': attack_pattern.severity
        }
        
        logger.warning(f"Blocked IP {ip_address} for {duration} seconds due to {attack_pattern.attack_type.value}")
    
    async def _handle_security_violation(self, request: Request, context: SecurityContext, exception: HTTPException):
        """Handle security violations."""
        await self._log_security_event(context, 'security_violation', {
            'status_code': exception.status_code,
            'detail': exception.detail,
            'blocked_reasons': context.blocked_reasons
        })
        
        # Update metrics
        self.security_metrics.blocked_requests += 1
        if exception.status_code == 429:
            self.security_metrics.rate_limited_requests += 1
    
    async def _log_security_event(self, context: SecurityContext, event_type: str, event_data: Dict[str, Any]):
        """Log security event."""
        event = {
            'timestamp': time.time(),
            'request_id': context.request_id,
            'client_ip': context.client_ip,
            'user_agent': context.user_agent,
            'event_type': event_type,
            'threat_level': context.threat_level,
            'data': event_data
        }
        
        context.security_events.append(event)
        
        # Log to application logger
        logger.info(f"Security event: {event_type}", extra={
            'security_event': event,
            'request_id': context.request_id
        })
        
        # Update metrics
        self.security_metrics.security_events += 1
    
    def _update_metrics(self, context: SecurityContext, response_time: float):
        """Update security metrics."""
        self.security_metrics.total_requests += 1
        
        # Update average response time
        total_time = self.security_metrics.average_response_time * (self.security_metrics.total_requests - 1)
        self.security_metrics.average_response_time = (total_time + response_time) / self.security_metrics.total_requests
        
        # Update threat scores
        self.security_metrics.threat_scores[context.client_ip] = context.threat_level
    
    async def _cleanup_request_context(self, context: SecurityContext):
        """Clean up request context."""
        # Remove from active contexts
        if context.request_id in self.request_contexts:
            del self.request_contexts[context.request_id]
        
        # Periodic cleanup
        current_time = time.time()
        if current_time - self.last_cleanup > self.cleanup_interval:
            await self._periodic_cleanup()
            self.last_cleanup = current_time
    
    async def _periodic_cleanup(self):
        """Perform periodic cleanup tasks."""
        current_time = time.time()
        
        # Clean up expired IP blocks
        expired_ips = []
        for ip, info in self.blocked_ips.items():
            if current_time > info['blocked_until']:
                expired_ips.append(ip)
        
        for ip in expired_ips:
            del self.blocked_ips[ip]
        
        # Clean up old request contexts
        expired_contexts = []
        for request_id, context in self.request_contexts.items():
            if current_time - context.timestamp > 3600:  # 1 hour
                expired_contexts.append(request_id)
        
        for request_id in expired_contexts:
            del self.request_contexts[request_id]
        
        # Clean up suspicious patterns
        cutoff_time = current_time - 3600  # 1 hour
        for pattern_key in list(self.suspicious_patterns.keys()):
            self.suspicious_patterns[pattern_key] = [
                t for t in self.suspicious_patterns[pattern_key] if t > cutoff_time
            ]
            if not self.suspicious_patterns[pattern_key]:
                del self.suspicious_patterns[pattern_key]
        
        # Clean up nonce cache
        if hasattr(self.headers_middleware, 'cleanup_nonce_cache'):
            self.headers_middleware.cleanup_nonce_cache()
        
        # Memory cleanup
        if self.memory_manager:
            self.memory_manager.cleanup_all()
    
    def get_security_status(self) -> Dict[str, Any]:
        """Get current security status."""
        current_time = time.time()
        uptime = current_time - self.start_time
        
        return {
            'uptime': uptime,
            'metrics': {
                'total_requests': self.security_metrics.total_requests,
                'blocked_requests': self.security_metrics.blocked_requests,
                'rate_limited_requests': self.security_metrics.rate_limited_requests,
                'security_events': self.security_metrics.security_events,
                'average_response_time': self.security_metrics.average_response_time,
                'block_rate': self.security_metrics.blocked_requests / max(1, self.security_metrics.total_requests)
            },
            'blocked_ips': len(self.blocked_ips),
            'active_contexts': len(self.request_contexts),
            'threat_scores': dict(list(self.security_metrics.threat_scores.items())[:10]),  # Top 10
            'system_health': {
                'status': 'healthy' if self.security_metrics.blocked_requests / max(1, self.security_metrics.total_requests) < 0.1 else 'degraded',
                'memory_usage': self.memory_manager.get_memory_stats() if self.memory_manager else {},
                'rate_limiter_stats': self.rate_limiter.get_attack_summary('system') if hasattr(self.rate_limiter, 'get_attack_summary') else {}
            }
        }
    
    def reset_metrics(self):
        """Reset security metrics."""
        self.security_metrics = SecurityMetrics()
        self.start_time = time.time()
    
    async def force_cleanup(self):
        """Force immediate cleanup."""
        await self._periodic_cleanup()


# Context manager for security middleware
@asynccontextmanager
async def security_context(request: Request):
    """Context manager for security operations."""
    context = getattr(request.state, 'security_context', None)
    if context is None:
        raise RuntimeError("Security context not available. Ensure SecurityMiddleware is installed.")
    
    try:
        yield context
    finally:
        # Could add cleanup logic here if needed
        pass


def create_security_middleware(
    app,
    rate_limit_config: Optional[RateLimitConfig] = None,
    security_config: Optional[SecurityConfig] = None,
    **kwargs
) -> SecurityMiddleware:
    """
    Create security middleware with custom configuration.
    
    Args:
        app: FastAPI application instance
        rate_limit_config: Rate limiting configuration
        security_config: Security headers configuration
        **kwargs: Additional configuration options
        
    Returns:
        SecurityMiddleware: Configured security middleware
    """
    return SecurityMiddleware(
        app=app,
        rate_limit_config=rate_limit_config,
        security_config=security_config,
        **kwargs
    ) 