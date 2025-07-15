"""
Enhanced rate limiting service with sophisticated attack detection and adaptive rate limiting.

This module provides comprehensive rate limiting capabilities with multiple strategies,
attack pattern detection, and adaptive rate limiting based on threat analysis.
"""

import time
import asyncio
import json
import redis
import hashlib
from typing import Dict, List, Optional, Tuple, Any, Union
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict, deque
import logging
import statistics
from contextlib import asynccontextmanager
import math

logger = logging.getLogger(__name__)

# Rate limiting constants
DEFAULT_WINDOW_SIZE = 60  # seconds
DEFAULT_MAX_REQUESTS = 100
DEFAULT_ATTACK_THRESHOLD = 0.8
DEFAULT_ADAPTIVE_FACTOR = 1.5
MIN_RATE_LIMIT = 10
MAX_RATE_LIMIT = 1000


class RateLimitStrategy(Enum):
    """Rate limiting strategies."""
    FIXED_WINDOW = "fixed_window"
    SLIDING_WINDOW = "sliding_window"
    TOKEN_BUCKET = "token_bucket"
    LEAKY_BUCKET = "leaky_bucket"
    ADAPTIVE = "adaptive"


class AttackType(Enum):
    """Types of attacks that can be detected."""
    BRUTE_FORCE = "brute_force"
    CREDENTIAL_STUFFING = "credential_stuffing"
    TIMING_ATTACK = "timing_attack"
    ENUMERATION = "enumeration"
    DDOS = "ddos"
    SCRAPING = "scraping"


@dataclass
class RateLimitConfig:
    """Configuration for rate limiting."""
    strategy: RateLimitStrategy = RateLimitStrategy.SLIDING_WINDOW
    window_size: int = DEFAULT_WINDOW_SIZE
    max_requests: int = DEFAULT_MAX_REQUESTS
    burst_size: int = 0  # 0 means no burst
    decay_rate: float = 0.1  # for token bucket
    attack_threshold: float = DEFAULT_ATTACK_THRESHOLD
    adaptive_factor: float = DEFAULT_ADAPTIVE_FACTOR
    enable_attack_detection: bool = True
    enable_adaptive_limiting: bool = True
    cleanup_interval: int = 300  # seconds


@dataclass
class AttackPattern:
    """Detected attack pattern."""
    attack_type: AttackType
    confidence: float
    severity: int  # 1-10 scale
    details: Dict[str, Any]
    timestamp: float = field(default_factory=time.time)


@dataclass
class RateLimitResult:
    """Result of rate limiting check."""
    allowed: bool
    remaining_requests: int
    reset_time: float
    retry_after: Optional[float] = None
    attack_detected: bool = False
    attack_patterns: List[AttackPattern] = field(default_factory=list)


class AttackDetector:
    """Sophisticated attack pattern detection."""
    
    def __init__(self, config: RateLimitConfig):
        self.config = config
        self.request_patterns: Dict[str, deque] = defaultdict(lambda: deque(maxlen=1000))
        self.failure_rates: Dict[str, deque] = defaultdict(lambda: deque(maxlen=100))
        self.timing_patterns: Dict[str, deque] = defaultdict(lambda: deque(maxlen=100))
        self.user_agent_patterns: Dict[str, int] = defaultdict(int)
        self.ip_reputation: Dict[str, float] = defaultdict(float)
    
    def analyze_request_pattern(
        self, 
        identifier: str, 
        request_info: Dict[str, Any]
    ) -> List[AttackPattern]:
        """
        Analyze request patterns for attacks.
        
        Args:
            identifier: Unique identifier for the requester
            request_info: Information about the request
            
        Returns:
            List[AttackPattern]: Detected attack patterns
        """
        patterns = []
        current_time = time.time()
        
        # Record request
        self.request_patterns[identifier].append({
            'timestamp': current_time,
            'endpoint': request_info.get('endpoint', ''),
            'method': request_info.get('method', ''),
            'user_agent': request_info.get('user_agent', ''),
            'success': request_info.get('success', True),
            'response_time': request_info.get('response_time', 0)
        })
        
        # Analyze different attack patterns
        patterns.extend(self._detect_brute_force(identifier))
        patterns.extend(self._detect_credential_stuffing(identifier))
        patterns.extend(self._detect_timing_attacks(identifier))
        patterns.extend(self._detect_enumeration(identifier))
        patterns.extend(self._detect_ddos(identifier))
        patterns.extend(self._detect_scraping(identifier))
        
        return patterns
    
    def _detect_brute_force(self, identifier: str) -> List[AttackPattern]:
        """Detect brute force attacks."""
        patterns = []
        requests = self.request_patterns[identifier]
        
        if len(requests) < 10:
            return patterns
        
        # Check for rapid successive failures
        recent_requests = [r for r in requests if time.time() - r['timestamp'] < 60]
        failures = [r for r in recent_requests if not r['success']]
        
        if len(failures) > 5:
            failure_rate = len(failures) / len(recent_requests)
            if failure_rate > 0.7:
                patterns.append(AttackPattern(
                    attack_type=AttackType.BRUTE_FORCE,
                    confidence=min(failure_rate, 1.0),
                    severity=7,
                    details={
                        'failure_rate': failure_rate,
                        'failures': len(failures),
                        'requests': len(recent_requests)
                    }
                ))
        
        return patterns
    
    def _detect_credential_stuffing(self, identifier: str) -> List[AttackPattern]:
        """Detect credential stuffing attacks."""
        patterns = []
        requests = self.request_patterns[identifier]
        
        if len(requests) < 20:
            return patterns
        
        # Check for requests from different user agents
        user_agents = set(r['user_agent'] for r in requests)
        auth_endpoints = [r for r in requests if 'auth' in r.get('endpoint', '')]
        
        if len(auth_endpoints) > 10 and len(user_agents) > 3:
            confidence = min(len(auth_endpoints) / 20, 1.0)
            patterns.append(AttackPattern(
                attack_type=AttackType.CREDENTIAL_STUFFING,
                confidence=confidence,
                severity=8,
                details={
                    'auth_requests': len(auth_endpoints),
                    'user_agents': len(user_agents),
                    'diversity_score': len(user_agents) / len(auth_endpoints)
                }
            ))
        
        return patterns
    
    def _detect_timing_attacks(self, identifier: str) -> List[AttackPattern]:
        """Detect timing attacks."""
        patterns = []
        requests = self.request_patterns[identifier]
        
        if len(requests) < 15:
            return patterns
        
        # Analyze response time patterns
        response_times = [r['response_time'] for r in requests if r['response_time'] > 0]
        
        if len(response_times) > 10:
            # Check for unusually consistent timing patterns
            std_dev = statistics.stdev(response_times)
            mean_time = statistics.mean(response_times)
            
            # Very low standard deviation might indicate timing analysis
            if std_dev < mean_time * 0.1 and mean_time > 0.1:
                confidence = max(0, 1 - (std_dev / mean_time))
                patterns.append(AttackPattern(
                    attack_type=AttackType.TIMING_ATTACK,
                    confidence=confidence,
                    severity=6,
                    details={
                        'std_deviation': std_dev,
                        'mean_response_time': mean_time,
                        'consistency_score': confidence
                    }
                ))
        
        return patterns
    
    def _detect_enumeration(self, identifier: str) -> List[AttackPattern]:
        """Detect enumeration attacks."""
        patterns = []
        requests = self.request_patterns[identifier]
        
        if len(requests) < 10:
            return patterns
        
        # Check for sequential or pattern-based endpoint access
        endpoints = [r['endpoint'] for r in requests]
        unique_endpoints = set(endpoints)
        
        # High diversity in endpoints might indicate enumeration
        if len(unique_endpoints) > 10 and len(endpoints) > 20:
            diversity_score = len(unique_endpoints) / len(endpoints)
            if diversity_score > 0.7:
                patterns.append(AttackPattern(
                    attack_type=AttackType.ENUMERATION,
                    confidence=diversity_score,
                    severity=5,
                    details={
                        'unique_endpoints': len(unique_endpoints),
                        'total_requests': len(endpoints),
                        'diversity_score': diversity_score
                    }
                ))
        
        return patterns
    
    def _detect_ddos(self, identifier: str) -> List[AttackPattern]:
        """Detect DDoS attacks."""
        patterns = []
        requests = self.request_patterns[identifier]
        
        if len(requests) < 50:
            return patterns
        
        # Check for high request volume in short time
        recent_requests = [r for r in requests if time.time() - r['timestamp'] < 10]
        
        if len(recent_requests) > 30:
            rate = len(recent_requests) / 10  # requests per second
            if rate > 3:
                patterns.append(AttackPattern(
                    attack_type=AttackType.DDOS,
                    confidence=min(rate / 10, 1.0),
                    severity=9,
                    details={
                        'requests_per_second': rate,
                        'recent_requests': len(recent_requests)
                    }
                ))
        
        return patterns
    
    def _detect_scraping(self, identifier: str) -> List[AttackPattern]:
        """Detect web scraping."""
        patterns = []
        requests = self.request_patterns[identifier]
        
        if len(requests) < 20:
            return patterns
        
        # Check for automated request patterns
        user_agents = [r['user_agent'] for r in requests]
        methods = [r['method'] for r in requests]
        
        # Check for consistent user agent and method patterns
        if len(set(user_agents)) == 1 and len(set(methods)) == 1:
            # Check for regular intervals
            timestamps = [r['timestamp'] for r in requests[-20:]]
            if len(timestamps) > 3:
                intervals = [timestamps[i+1] - timestamps[i] for i in range(len(timestamps)-1)]
                if intervals:
                    interval_std = statistics.stdev(intervals) if len(intervals) > 1 else 0
                    mean_interval = statistics.mean(intervals)
                    
                    if interval_std < mean_interval * 0.2 and mean_interval < 10:
                        confidence = max(0, 1 - (interval_std / mean_interval))
                        patterns.append(AttackPattern(
                            attack_type=AttackType.SCRAPING,
                            confidence=confidence,
                            severity=4,
                            details={
                                'interval_consistency': confidence,
                                'mean_interval': mean_interval,
                                'std_deviation': interval_std
                            }
                        ))
        
        return patterns
    
    def update_ip_reputation(self, identifier: str, patterns: List[AttackPattern]):
        """Update IP reputation based on attack patterns."""
        if not patterns:
            # Slowly improve reputation for clean requests
            self.ip_reputation[identifier] = max(0, self.ip_reputation[identifier] - 0.01)
            return
        
        # Decrease reputation based on attack patterns
        for pattern in patterns:
            reputation_penalty = pattern.confidence * pattern.severity * 0.1
            self.ip_reputation[identifier] += reputation_penalty
        
        # Cap reputation at 10
        self.ip_reputation[identifier] = min(10, self.ip_reputation[identifier])
    
    def get_threat_score(self, identifier: str) -> float:
        """Get overall threat score for an identifier."""
        return self.ip_reputation.get(identifier, 0.0)


class AdaptiveRateLimiter:
    """Adaptive rate limiter that adjusts limits based on threat analysis."""
    
    def __init__(self, config: RateLimitConfig):
        self.config = config
        self.attack_detector = AttackDetector(config)
        self.current_limits: Dict[str, int] = {}
        self.last_cleanup = time.time()
    
    def get_current_limit(self, identifier: str, patterns: List[AttackPattern]) -> int:
        """Get current rate limit for identifier based on attack patterns."""
        base_limit = self.config.max_requests
        
        if not patterns:
            # Gradually restore normal limits
            current = self.current_limits.get(identifier, base_limit)
            self.current_limits[identifier] = min(base_limit, current + 1)
            return self.current_limits[identifier]
        
        # Reduce limits based on attack patterns
        threat_score = sum(p.confidence * p.severity for p in patterns)
        reduction_factor = 1 - (threat_score / 100)  # Normalize threat score
        
        new_limit = max(MIN_RATE_LIMIT, int(base_limit * reduction_factor))
        self.current_limits[identifier] = new_limit
        
        return new_limit
    
    def analyze_and_limit(
        self, 
        identifier: str, 
        request_info: Dict[str, Any]
    ) -> Tuple[int, List[AttackPattern]]:
        """
        Analyze request and return current rate limit.
        
        Args:
            identifier: Unique identifier for the requester
            request_info: Information about the request
            
        Returns:
            Tuple[int, List[AttackPattern]]: (current_limit, attack_patterns)
        """
        patterns = self.attack_detector.analyze_request_pattern(identifier, request_info)
        current_limit = self.get_current_limit(identifier, patterns)
        
        # Update IP reputation
        self.attack_detector.update_ip_reputation(identifier, patterns)
        
        return current_limit, patterns
    
    def cleanup_old_data(self):
        """Clean up old data to prevent memory leaks."""
        current_time = time.time()
        
        if current_time - self.last_cleanup < self.config.cleanup_interval:
            return
        
        # Clean up request patterns
        for identifier, requests in self.attack_detector.request_patterns.items():
            cutoff_time = current_time - 3600  # Keep 1 hour of data
            while requests and requests[0]['timestamp'] < cutoff_time:
                requests.popleft()
        
        # Clean up IP reputation (decay over time)
        for identifier in list(self.attack_detector.ip_reputation.keys()):
            self.attack_detector.ip_reputation[identifier] *= 0.99
            if self.attack_detector.ip_reputation[identifier] < 0.01:
                del self.attack_detector.ip_reputation[identifier]
        
        self.last_cleanup = current_time


class RateLimiterService:
    """Main rate limiting service with multiple strategies and Redis support."""
    
    def __init__(self, config: RateLimitConfig, redis_client: Optional[redis.Redis] = None):
        self.config = config
        self.redis_client = redis_client
        self.local_cache: Dict[str, List[float]] = defaultdict(list)
        self.adaptive_limiter = AdaptiveRateLimiter(config) if config.enable_adaptive_limiting else None
        self.token_buckets: Dict[str, Dict[str, float]] = {}
        self.leaky_buckets: Dict[str, Dict[str, float]] = {}
    
    async def check_rate_limit(
        self, 
        identifier: str, 
        request_info: Optional[Dict[str, Any]] = None
    ) -> RateLimitResult:
        """
        Check if request is within rate limits.
        
        Args:
            identifier: Unique identifier for the requester
            request_info: Optional request information for attack detection
            
        Returns:
            RateLimitResult: Result of rate limiting check
        """
        request_info = request_info or {}
        current_time = time.time()
        
        # Analyze for attacks if enabled
        attack_patterns = []
        current_limit = self.config.max_requests
        
        if self.adaptive_limiter and self.config.enable_attack_detection:
            current_limit, attack_patterns = self.adaptive_limiter.analyze_and_limit(
                identifier, request_info
            )
        
        # Check rate limit based on strategy
        if self.config.strategy == RateLimitStrategy.FIXED_WINDOW:
            result = await self._check_fixed_window(identifier, current_limit)
        elif self.config.strategy == RateLimitStrategy.SLIDING_WINDOW:
            result = await self._check_sliding_window(identifier, current_limit)
        elif self.config.strategy == RateLimitStrategy.TOKEN_BUCKET:
            result = await self._check_token_bucket(identifier, current_limit)
        elif self.config.strategy == RateLimitStrategy.LEAKY_BUCKET:
            result = await self._check_leaky_bucket(identifier, current_limit)
        else:
            result = await self._check_sliding_window(identifier, current_limit)
        
        # Add attack information to result
        result.attack_detected = len(attack_patterns) > 0
        result.attack_patterns = attack_patterns
        
        # Block request if high-confidence attack detected
        if attack_patterns:
            high_confidence_attacks = [p for p in attack_patterns if p.confidence > 0.8]
            if high_confidence_attacks:
                result.allowed = False
                result.retry_after = 300  # 5 minutes
        
        # Periodic cleanup
        if self.adaptive_limiter:
            self.adaptive_limiter.cleanup_old_data()
        
        return result
    
    async def _check_fixed_window(self, identifier: str, limit: int) -> RateLimitResult:
        """Check rate limit using fixed window strategy."""
        current_time = time.time()
        window_start = int(current_time // self.config.window_size) * self.config.window_size
        
        key = f"rate_limit:fixed:{identifier}:{window_start}"
        
        if self.redis_client:
            try:
                count = await self._redis_increment(key, self.config.window_size)
                remaining = max(0, limit - count)
                allowed = count <= limit
            except Exception as e:
                logger.warning(f"Redis rate limit check failed: {e}")
                # Fallback to local cache
                allowed, remaining = self._local_fixed_window_check(identifier, limit, window_start)
        else:
            allowed, remaining = self._local_fixed_window_check(identifier, limit, window_start)
        
        reset_time = window_start + self.config.window_size
        
        return RateLimitResult(
            allowed=allowed,
            remaining_requests=remaining,
            reset_time=reset_time
        )
    
    async def _check_sliding_window(self, identifier: str, limit: int) -> RateLimitResult:
        """Check rate limit using sliding window strategy."""
        current_time = time.time()
        window_start = current_time - self.config.window_size
        
        if self.redis_client:
            try:
                count = await self._redis_sliding_window_check(identifier, window_start, current_time)
                remaining = max(0, limit - count)
                allowed = count <= limit
            except Exception as e:
                logger.warning(f"Redis sliding window check failed: {e}")
                # Fallback to local cache
                allowed, remaining = self._local_sliding_window_check(identifier, limit, window_start)
        else:
            allowed, remaining = self._local_sliding_window_check(identifier, limit, window_start)
        
        reset_time = current_time + self.config.window_size
        
        return RateLimitResult(
            allowed=allowed,
            remaining_requests=remaining,
            reset_time=reset_time
        )
    
    async def _check_token_bucket(self, identifier: str, limit: int) -> RateLimitResult:
        """Check rate limit using token bucket strategy."""
        current_time = time.time()
        
        if identifier not in self.token_buckets:
            self.token_buckets[identifier] = {
                'tokens': float(limit),
                'last_refill': current_time
            }
        
        bucket = self.token_buckets[identifier]
        
        # Refill tokens
        time_passed = current_time - bucket['last_refill']
        tokens_to_add = time_passed * (limit / self.config.window_size)
        bucket['tokens'] = min(limit, bucket['tokens'] + tokens_to_add)
        bucket['last_refill'] = current_time
        
        # Check if tokens available
        if bucket['tokens'] >= 1:
            bucket['tokens'] -= 1
            allowed = True
        else:
            allowed = False
        
        remaining = int(bucket['tokens'])
        reset_time = current_time + (1 - bucket['tokens']) * (self.config.window_size / limit)
        
        return RateLimitResult(
            allowed=allowed,
            remaining_requests=remaining,
            reset_time=reset_time
        )
    
    async def _check_leaky_bucket(self, identifier: str, limit: int) -> RateLimitResult:
        """Check rate limit using leaky bucket strategy."""
        current_time = time.time()
        
        if identifier not in self.leaky_buckets:
            self.leaky_buckets[identifier] = {
                'volume': 0.0,
                'last_leak': current_time
            }
        
        bucket = self.leaky_buckets[identifier]
        
        # Leak tokens
        time_passed = current_time - bucket['last_leak']
        leak_amount = time_passed * (limit / self.config.window_size)
        bucket['volume'] = max(0, bucket['volume'] - leak_amount)
        bucket['last_leak'] = current_time
        
        # Check if bucket has capacity
        if bucket['volume'] < limit:
            bucket['volume'] += 1
            allowed = True
        else:
            allowed = False
        
        remaining = int(limit - bucket['volume'])
        reset_time = current_time + (bucket['volume'] - limit + 1) * (self.config.window_size / limit)
        
        return RateLimitResult(
            allowed=allowed,
            remaining_requests=remaining,
            reset_time=reset_time
        )
    
    def _local_fixed_window_check(self, identifier: str, limit: int, window_start: float) -> Tuple[bool, int]:
        """Local cache implementation of fixed window check."""
        key = f"{identifier}:{window_start}"
        
        if key not in self.local_cache:
            self.local_cache[key] = []
        
        count = len(self.local_cache[key])
        
        if count < limit:
            self.local_cache[key].append(time.time())
            return True, limit - count - 1
        else:
            return False, 0
    
    def _local_sliding_window_check(self, identifier: str, limit: int, window_start: float) -> Tuple[bool, int]:
        """Local cache implementation of sliding window check."""
        if identifier not in self.local_cache:
            self.local_cache[identifier] = []
        
        # Remove old entries
        current_time = time.time()
        self.local_cache[identifier] = [
            t for t in self.local_cache[identifier] 
            if current_time - t < self.config.window_size
        ]
        
        count = len(self.local_cache[identifier])
        
        if count < limit:
            self.local_cache[identifier].append(current_time)
            return True, limit - count - 1
        else:
            return False, 0
    
    async def _redis_increment(self, key: str, expire_time: int) -> int:
        """Increment Redis counter with expiration."""
        pipe = self.redis_client.pipeline()
        pipe.incr(key)
        pipe.expire(key, expire_time)
        results = await pipe.execute()
        return results[0]
    
    async def _redis_sliding_window_check(self, identifier: str, window_start: float, current_time: float) -> int:
        """Redis implementation of sliding window check."""
        key = f"rate_limit:sliding:{identifier}"
        
        pipe = self.redis_client.pipeline()
        pipe.zremrangebyscore(key, 0, window_start)
        pipe.zadd(key, {str(current_time): current_time})
        pipe.zcard(key)
        pipe.expire(key, self.config.window_size)
        results = await pipe.execute()
        
        return results[2]  # zcard result
    
    def get_attack_summary(self, identifier: str) -> Dict[str, Any]:
        """Get attack summary for identifier."""
        if not self.adaptive_limiter:
            return {}
        
        threat_score = self.adaptive_limiter.attack_detector.get_threat_score(identifier)
        current_limit = self.adaptive_limiter.current_limits.get(identifier, self.config.max_requests)
        
        return {
            'threat_score': threat_score,
            'current_limit': current_limit,
            'base_limit': self.config.max_requests,
            'reputation': self.adaptive_limiter.attack_detector.ip_reputation.get(identifier, 0)
        }


# Global rate limiter instance
rate_limiter_config = RateLimitConfig()
rate_limiter = RateLimiterService(rate_limiter_config)


@asynccontextmanager
async def rate_limit_context(identifier: str, request_info: Optional[Dict[str, Any]] = None):
    """Context manager for rate limiting."""
    result = await rate_limiter.check_rate_limit(identifier, request_info)
    
    if not result.allowed:
        raise Exception(f"Rate limit exceeded. Retry after {result.retry_after} seconds")
    
    try:
        yield result
    finally:
        # Could add cleanup logic here if needed
        pass 