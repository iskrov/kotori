"""
Enhanced Rate Limiting Middleware

This module provides comprehensive rate limiting capabilities for the secret phrase
processing system. It includes per-user and IP-based rate limiting, exponential
backoff, abuse detection, and Redis-based distributed rate limiting.

Security features:
- Distributed rate limiting with Redis
- Per-user and IP-based rate limiting
- Exponential backoff for failed attempts
- Abuse detection and alerting
- Configurable rate limits and time windows
"""

import logging
import time
import hashlib
import json
from typing import Dict, Optional, Tuple, List
from datetime import datetime, timedelta, UTC
from dataclasses import dataclass
from enum import Enum
import redis
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
import asyncio
from collections import defaultdict
import threading

logger = logging.getLogger(__name__)

class RateLimitType(Enum):
    """Types of rate limiting"""
    USER = "user"
    IP = "ip"
    GLOBAL = "global"
    OPERATION = "operation"

@dataclass
class RateLimitConfig:
    """Configuration for rate limiting"""
    requests_per_minute: int
    requests_per_hour: int
    burst_size: int
    cooldown_minutes: int
    enabled: bool = True

@dataclass
class RateLimitRule:
    """Rate limiting rule definition"""
    limit_type: RateLimitType
    identifier: str
    config: RateLimitConfig
    window_start: datetime
    request_count: int
    last_request: datetime
    violation_count: int = 0
    blocked_until: Optional[datetime] = None

class RateLimitViolation(Exception):
    """Exception raised when rate limit is exceeded"""
    def __init__(self, limit_type: RateLimitType, retry_after: int, message: str):
        self.limit_type = limit_type
        self.retry_after = retry_after
        self.message = message
        super().__init__(message)

class EnhancedRateLimiter:
    """
    Enhanced rate limiting system with Redis support and abuse detection.
    
    This class provides comprehensive rate limiting capabilities including:
    - Per-user and IP-based rate limiting
    - Distributed rate limiting with Redis
    - Exponential backoff for repeated violations
    - Abuse detection and alerting
    - Configurable rate limits and time windows
    """
    
    # Default rate limit configurations
    DEFAULT_CONFIGS = {
        RateLimitType.USER: RateLimitConfig(
            requests_per_minute=10,
            requests_per_hour=100,
            burst_size=5,
            cooldown_minutes=5
        ),
        RateLimitType.IP: RateLimitConfig(
            requests_per_minute=20,
            requests_per_hour=200,
            burst_size=10,
            cooldown_minutes=15
        ),
        RateLimitType.OPERATION: RateLimitConfig(
            requests_per_minute=5,
            requests_per_hour=50,
            burst_size=3,
            cooldown_minutes=10
        ),
        RateLimitType.GLOBAL: RateLimitConfig(
            requests_per_minute=1000,
            requests_per_hour=10000,
            burst_size=100,
            cooldown_minutes=1
        )
    }
    
    def __init__(self, redis_client: Optional[redis.Redis] = None, 
                 use_redis: bool = True, configs: Optional[Dict[RateLimitType, RateLimitConfig]] = None):
        """
        Initialize enhanced rate limiter.
        
        Args:
            redis_client: Redis client for distributed rate limiting
            use_redis: Whether to use Redis for storage
            configs: Custom rate limit configurations
        """
        self.redis_client = redis_client
        self.use_redis = use_redis and redis_client is not None
        self.configs = configs or self.DEFAULT_CONFIGS.copy()
        
        # In-memory storage for non-Redis mode
        self.memory_store: Dict[str, RateLimitRule] = {}
        self.lock = threading.RLock()
        
        # Abuse detection
        self.abuse_threshold = 5  # Number of violations before marking as abuse
        self.abuse_cooldown_hours = 24  # Hours to block after abuse detection
        
        # Statistics
        self.stats = {
            'total_requests': 0,
            'blocked_requests': 0,
            'abuse_detections': 0,
            'last_reset': datetime.now(UTC)
        }
        
        logger.info(f"Rate limiter initialized with Redis: {self.use_redis}")
    
    def _get_key(self, limit_type: RateLimitType, identifier: str) -> str:
        """Generate storage key for rate limit rule."""
        return f"rate_limit:{limit_type.value}:{identifier}"
    
    def _hash_identifier(self, identifier: str) -> str:
        """Hash identifier for privacy."""
        return hashlib.sha256(identifier.encode()).hexdigest()[:16]
    
    def _get_rule_from_redis(self, key: str) -> Optional[RateLimitRule]:
        """Retrieve rate limit rule from Redis."""
        try:
            data = self.redis_client.get(key)
            if data:
                rule_data = json.loads(data)
                rule = RateLimitRule(
                    limit_type=RateLimitType(rule_data['limit_type']),
                    identifier=rule_data['identifier'],
                    config=RateLimitConfig(**rule_data['config']),
                    window_start=datetime.fromisoformat(rule_data['window_start']),
                    request_count=rule_data['request_count'],
                    last_request=datetime.fromisoformat(rule_data['last_request']),
                    violation_count=rule_data.get('violation_count', 0),
                    blocked_until=datetime.fromisoformat(rule_data['blocked_until']) if rule_data.get('blocked_until') else None
                )
                return rule
        except Exception as e:
            logger.error(f"Error retrieving rule from Redis: {e}")
        return None
    
    def _store_rule_in_redis(self, key: str, rule: RateLimitRule):
        """Store rate limit rule in Redis."""
        try:
            rule_data = {
                'limit_type': rule.limit_type.value,
                'identifier': rule.identifier,
                'config': {
                    'requests_per_minute': rule.config.requests_per_minute,
                    'requests_per_hour': rule.config.requests_per_hour,
                    'burst_size': rule.config.burst_size,
                    'cooldown_minutes': rule.config.cooldown_minutes,
                    'enabled': rule.config.enabled
                },
                'window_start': rule.window_start.isoformat(),
                'request_count': rule.request_count,
                'last_request': rule.last_request.isoformat(),
                'violation_count': rule.violation_count,
                'blocked_until': rule.blocked_until.isoformat() if rule.blocked_until else None
            }
            
            # Store with TTL
            ttl = 3600  # 1 hour TTL
            self.redis_client.setex(key, ttl, json.dumps(rule_data))
            
        except Exception as e:
            logger.error(f"Error storing rule in Redis: {e}")
    
    def _get_rule(self, limit_type: RateLimitType, identifier: str) -> RateLimitRule:
        """Get or create rate limit rule."""
        key = self._get_key(limit_type, identifier)
        
        if self.use_redis:
            rule = self._get_rule_from_redis(key)
            if rule:
                return rule
        else:
            with self.lock:
                if key in self.memory_store:
                    return self.memory_store[key]
        
        # Create new rule
        config = self.configs.get(limit_type, self.DEFAULT_CONFIGS[limit_type])
        rule = RateLimitRule(
            limit_type=limit_type,
            identifier=identifier,
            config=config,
            window_start=datetime.now(UTC),
            request_count=0,
            last_request=datetime.now(UTC),
            violation_count=0,
            blocked_until=None
        )
        
        self._store_rule(key, rule)
        return rule
    
    def _store_rule(self, key: str, rule: RateLimitRule):
        """Store rate limit rule."""
        if self.use_redis:
            self._store_rule_in_redis(key, rule)
        else:
            with self.lock:
                self.memory_store[key] = rule
    
    def _is_window_expired(self, rule: RateLimitRule) -> bool:
        """Check if the current time window has expired."""
        now = datetime.now(UTC)
        return (now - rule.window_start).total_seconds() >= 60  # 1 minute window
    
    def _reset_window(self, rule: RateLimitRule):
        """Reset the rate limit window."""
        now = datetime.now(UTC)
        rule.window_start = now
        rule.request_count = 0
        rule.last_request = now
    
    def _calculate_backoff(self, violation_count: int) -> int:
        """Calculate exponential backoff time in minutes."""
        base_cooldown = 5  # 5 minutes base
        max_cooldown = 60  # 1 hour max
        
        backoff = min(base_cooldown * (2 ** violation_count), max_cooldown)
        return int(backoff)
    
    def _detect_abuse(self, rule: RateLimitRule) -> bool:
        """Detect if the rule represents abusive behavior."""
        return rule.violation_count >= self.abuse_threshold
    
    def _apply_abuse_block(self, rule: RateLimitRule):
        """Apply long-term block for abusive behavior."""
        now = datetime.now(UTC)
        rule.blocked_until = now + timedelta(hours=self.abuse_cooldown_hours)
        
        # Log abuse detection
        logger.warning(f"Abuse detected for {rule.limit_type.value} {rule.identifier[:8]}... "
                      f"Blocking until {rule.blocked_until}")
        
        self.stats['abuse_detections'] += 1
    
    def check_rate_limit(self, limit_type: RateLimitType, identifier: str, 
                        operation: Optional[str] = None) -> Tuple[bool, Optional[int]]:
        """
        Check if request is within rate limits.
        
        Args:
            limit_type: Type of rate limit to check
            identifier: Unique identifier (user ID, IP address, etc.)
            operation: Optional operation name for operation-specific limits
            
        Returns:
            Tuple of (allowed, retry_after_seconds)
        """
        try:
            self.stats['total_requests'] += 1
            
            # Create composite identifier for operation-specific limits
            if operation and limit_type == RateLimitType.OPERATION:
                identifier = f"{identifier}:{operation}"
            
            rule = self._get_rule(limit_type, identifier)
            now = datetime.now(UTC)
            
            # Check if currently blocked
            if rule.blocked_until and now < rule.blocked_until:
                retry_after = int((rule.blocked_until - now).total_seconds())
                self.stats['blocked_requests'] += 1
                return False, retry_after
            
            # Reset window if expired
            if self._is_window_expired(rule):
                self._reset_window(rule)
            
            # Check rate limits
            minute_limit = rule.config.requests_per_minute
            hour_limit = rule.config.requests_per_hour
            
            # Check minute limit
            if rule.request_count >= minute_limit:
                rule.violation_count += 1
                
                # Calculate backoff
                backoff_minutes = self._calculate_backoff(rule.violation_count)
                rule.blocked_until = now + timedelta(minutes=backoff_minutes)
                
                # Check for abuse
                if self._detect_abuse(rule):
                    self._apply_abuse_block(rule)
                
                self._store_rule(self._get_key(limit_type, identifier), rule)
                
                retry_after = int((rule.blocked_until - now).total_seconds())
                self.stats['blocked_requests'] += 1
                return False, retry_after
            
            # Check hourly limit (simplified - would need more sophisticated windowing)
            hour_window_start = now - timedelta(hours=1)
            if rule.window_start < hour_window_start:
                # For simplicity, reset hourly count if window is very old
                # In production, this would use a sliding window
                pass
            
            # Allow request
            rule.request_count += 1
            rule.last_request = now
            
            # Reset blocked status if block period expired
            if rule.blocked_until and now >= rule.blocked_until:
                rule.blocked_until = None
                rule.violation_count = max(0, rule.violation_count - 1)  # Reduce violation count
            
            self._store_rule(self._get_key(limit_type, identifier), rule)
            
            return True, None
            
        except Exception as e:
            logger.error(f"Error checking rate limit: {e}")
            # Fail open - allow request if there's an error
            return True, None
    
    def get_rate_limit_info(self, limit_type: RateLimitType, identifier: str) -> Dict:
        """
        Get current rate limit information for an identifier.
        
        Args:
            limit_type: Type of rate limit
            identifier: Unique identifier
            
        Returns:
            Dictionary containing rate limit information
        """
        try:
            rule = self._get_rule(limit_type, identifier)
            now = datetime.now(UTC)
            
            # Calculate remaining requests
            remaining = max(0, rule.config.requests_per_minute - rule.request_count)
            
            # Calculate reset time
            reset_time = rule.window_start + timedelta(minutes=1)
            reset_seconds = max(0, int((reset_time - now).total_seconds()))
            
            return {
                'limit_type': limit_type.value,
                'requests_per_minute': rule.config.requests_per_minute,
                'requests_used': rule.request_count,
                'requests_remaining': remaining,
                'reset_time_seconds': reset_seconds,
                'blocked': rule.blocked_until is not None and now < rule.blocked_until,
                'blocked_until': rule.blocked_until.isoformat() if rule.blocked_until else None,
                'violation_count': rule.violation_count,
                'last_request': rule.last_request.isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting rate limit info: {e}")
            return {'error': str(e)}
    
    def reset_rate_limit(self, limit_type: RateLimitType, identifier: str):
        """
        Reset rate limit for an identifier (admin function).
        
        Args:
            limit_type: Type of rate limit
            identifier: Unique identifier
        """
        try:
            key = self._get_key(limit_type, identifier)
            
            if self.use_redis:
                self.redis_client.delete(key)
            else:
                with self.lock:
                    if key in self.memory_store:
                        del self.memory_store[key]
            
            logger.info(f"Rate limit reset for {limit_type.value} {identifier[:8]}...")
            
        except Exception as e:
            logger.error(f"Error resetting rate limit: {e}")
    
    def get_statistics(self) -> Dict:
        """Get rate limiter statistics."""
        return {
            'total_requests': self.stats['total_requests'],
            'blocked_requests': self.stats['blocked_requests'],
            'abuse_detections': self.stats['abuse_detections'],
            'block_rate': self.stats['blocked_requests'] / max(1, self.stats['total_requests']),
            'last_reset': self.stats['last_reset'].isoformat(),
            'storage_backend': 'redis' if self.use_redis else 'memory',
            'rules_count': len(self.memory_store) if not self.use_redis else 'unknown'
        }
    
    def cleanup_expired_rules(self):
        """Clean up expired rate limit rules (for memory storage)."""
        if self.use_redis:
            return  # Redis handles TTL automatically
        
        try:
            now = datetime.now(UTC)
            expired_keys = []
            
            with self.lock:
                for key, rule in self.memory_store.items():
                    # Remove rules that haven't been accessed in 1 hour
                    if (now - rule.last_request).total_seconds() > 3600:
                        expired_keys.append(key)
                
                for key in expired_keys:
                    del self.memory_store[key]
            
            if expired_keys:
                logger.info(f"Cleaned up {len(expired_keys)} expired rate limit rules")
                
        except Exception as e:
            logger.error(f"Error cleaning up expired rules: {e}")

# FastAPI middleware
class RateLimitMiddleware:
    """FastAPI middleware for rate limiting."""
    
    def __init__(self, rate_limiter: EnhancedRateLimiter):
        self.rate_limiter = rate_limiter
    
    async def __call__(self, request: Request, call_next):
        """Process request with rate limiting."""
        try:
            # Get client IP
            client_ip = self._get_client_ip(request)
            
            # Get user ID if available
            user_id = self._get_user_id(request)
            
            # Check IP-based rate limit
            ip_allowed, ip_retry_after = self.rate_limiter.check_rate_limit(
                RateLimitType.IP, client_ip
            )
            
            if not ip_allowed:
                return self._create_rate_limit_response(
                    "IP rate limit exceeded", ip_retry_after
                )
            
            # Check user-based rate limit if user is authenticated
            if user_id:
                user_allowed, user_retry_after = self.rate_limiter.check_rate_limit(
                    RateLimitType.USER, str(user_id)
                )
                
                if not user_allowed:
                    return self._create_rate_limit_response(
                        "User rate limit exceeded", user_retry_after
                    )
            
            # Check operation-specific rate limits for sensitive endpoints
            if self._is_sensitive_endpoint(request):
                operation = self._get_operation_name(request)
                identifier = str(user_id) if user_id else client_ip
                
                op_allowed, op_retry_after = self.rate_limiter.check_rate_limit(
                    RateLimitType.OPERATION, identifier, operation
                )
                
                if not op_allowed:
                    return self._create_rate_limit_response(
                        f"Operation rate limit exceeded for {operation}", op_retry_after
                    )
            
            # Process request
            response = await call_next(request)
            
            # Add rate limit headers
            if user_id:
                rate_info = self.rate_limiter.get_rate_limit_info(
                    RateLimitType.USER, str(user_id)
                )
                response.headers["X-RateLimit-Limit"] = str(rate_info['requests_per_minute'])
                response.headers["X-RateLimit-Remaining"] = str(rate_info['requests_remaining'])
                response.headers["X-RateLimit-Reset"] = str(rate_info['reset_time_seconds'])
            
            return response
            
        except Exception as e:
            logger.error(f"Error in rate limit middleware: {e}")
            # Continue processing on error
            return await call_next(request)
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address from request."""
        # Check for forwarded headers
        forwarded_for = request.headers.get('X-Forwarded-For')
        if forwarded_for:
            return forwarded_for.split(',')[0].strip()
        
        real_ip = request.headers.get('X-Real-IP')
        if real_ip:
            return real_ip
        
        # Fallback to direct connection
        return request.client.host if request.client else '127.0.0.1'
    
    def _get_user_id(self, request: Request) -> Optional[int]:
        """Extract user ID from request if available."""
        # This would typically come from JWT token or session
        # For now, return None - implement based on your auth system
        return getattr(request.state, 'user_id', None)
    
    def _is_sensitive_endpoint(self, request: Request) -> bool:
        """Check if endpoint requires operation-specific rate limiting."""
        sensitive_paths = [
            '/api/v1/phrase-processing',
            '/api/v1/opaque/auth',
            '/api/v1/secret-tags',
            '/api/v1/speech/process'
        ]
        
        return any(request.url.path.startswith(path) for path in sensitive_paths)
    
    def _get_operation_name(self, request: Request) -> str:
        """Get operation name for rate limiting."""
        path = request.url.path
        method = request.method
        
        # Map paths to operation names
        operation_map = {
            '/api/v1/phrase-processing': 'phrase_processing',
            '/api/v1/opaque/auth': 'opaque_auth',
            '/api/v1/secret-tags': 'secret_tags',
            '/api/v1/speech/process': 'speech_processing'
        }
        
        for path_prefix, operation in operation_map.items():
            if path.startswith(path_prefix):
                return f"{operation}_{method.lower()}"
        
        return f"unknown_{method.lower()}"
    
    def _create_rate_limit_response(self, message: str, retry_after: int) -> JSONResponse:
        """Create rate limit exceeded response."""
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={
                "error": "Rate limit exceeded",
                "message": message,
                "retry_after": retry_after
            },
            headers={
                "Retry-After": str(retry_after),
                "X-RateLimit-Limit": "N/A",
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(retry_after)
            }
        )

# Factory functions
def create_redis_rate_limiter(redis_url: str = "redis://localhost:6379", 
                             configs: Optional[Dict[RateLimitType, RateLimitConfig]] = None) -> EnhancedRateLimiter:
    """Create rate limiter with Redis backend."""
    try:
        redis_client = redis.from_url(redis_url)
        redis_client.ping()  # Test connection
        return EnhancedRateLimiter(redis_client=redis_client, use_redis=True, configs=configs)
    except Exception as e:
        logger.warning(f"Failed to connect to Redis: {e}. Using memory backend.")
        return EnhancedRateLimiter(use_redis=False, configs=configs)

def create_memory_rate_limiter(configs: Optional[Dict[RateLimitType, RateLimitConfig]] = None) -> EnhancedRateLimiter:
    """Create rate limiter with in-memory backend."""
    return EnhancedRateLimiter(use_redis=False, configs=configs)

# Global rate limiter instance
_global_rate_limiter = None

def get_rate_limiter() -> EnhancedRateLimiter:
    """Get global rate limiter instance."""
    global _global_rate_limiter
    if _global_rate_limiter is None:
        _global_rate_limiter = create_redis_rate_limiter()
    return _global_rate_limiter 