"""
Security headers middleware for comprehensive web application security.

This module implements various security headers including CSP, CORS, HSTS,
and other security policies to protect against common web vulnerabilities.
"""

import secrets
import time
from typing import Dict, List, Optional, Set, Union, Any
from dataclasses import dataclass, field
from enum import Enum
import logging
from urllib.parse import urlparse
import json
import re

logger = logging.getLogger(__name__)


class CSPDirective(Enum):
    """Content Security Policy directives."""
    DEFAULT_SRC = "default-src"
    SCRIPT_SRC = "script-src"
    STYLE_SRC = "style-src"
    IMG_SRC = "img-src"
    FONT_SRC = "font-src"
    CONNECT_SRC = "connect-src"
    MEDIA_SRC = "media-src"
    OBJECT_SRC = "object-src"
    CHILD_SRC = "child-src"
    FRAME_SRC = "frame-src"
    WORKER_SRC = "worker-src"
    MANIFEST_SRC = "manifest-src"
    BASE_URI = "base-uri"
    FORM_ACTION = "form-action"
    FRAME_ANCESTORS = "frame-ancestors"
    PLUGIN_TYPES = "plugin-types"
    SANDBOX = "sandbox"
    UPGRADE_INSECURE_REQUESTS = "upgrade-insecure-requests"
    BLOCK_ALL_MIXED_CONTENT = "block-all-mixed-content"
    REQUIRE_SRI_FOR = "require-sri-for"
    REPORT_URI = "report-uri"
    REPORT_TO = "report-to"


@dataclass
class SecurityConfig:
    """Configuration for security headers."""
    # HSTS configuration
    hsts_max_age: int = 31536000  # 1 year
    hsts_include_subdomains: bool = True
    hsts_preload: bool = True
    
    # CSP configuration
    csp_report_only: bool = False
    csp_report_uri: Optional[str] = None
    csp_nonce_length: int = 16
    
    # CORS configuration
    cors_allow_origins: List[str] = field(default_factory=lambda: ["*"])
    cors_allow_methods: List[str] = field(default_factory=lambda: ["GET", "POST", "PUT", "DELETE", "OPTIONS"])
    cors_allow_headers: List[str] = field(default_factory=lambda: ["*"])
    cors_expose_headers: List[str] = field(default_factory=list)
    cors_allow_credentials: bool = False
    cors_max_age: int = 86400
    
    # Feature Policy configuration
    feature_policy_enabled: bool = True
    
    # Referrer Policy
    referrer_policy: str = "strict-origin-when-cross-origin"
    
    # X-Frame-Options
    frame_options: str = "DENY"
    
    # X-Content-Type-Options
    content_type_options: str = "nosniff"
    
    # X-XSS-Protection
    xss_protection: str = "1; mode=block"
    
    # Expect-CT
    expect_ct_max_age: int = 86400
    expect_ct_enforce: bool = True
    expect_ct_report_uri: Optional[str] = None


class ContentSecurityPolicyBuilder:
    """Builder for Content Security Policy headers."""
    
    def __init__(self, config: SecurityConfig):
        self.config = config
        self.directives: Dict[str, Set[str]] = {}
        self.nonce: Optional[str] = None
        self.report_only = config.csp_report_only
    
    def add_directive(self, directive: CSPDirective, values: Union[str, List[str]]) -> 'ContentSecurityPolicyBuilder':
        """
        Add CSP directive.
        
        Args:
            directive: CSP directive to add
            values: Values for the directive
            
        Returns:
            ContentSecurityPolicyBuilder: Self for method chaining
        """
        if directive.value not in self.directives:
            self.directives[directive.value] = set()
        
        if isinstance(values, str):
            values = [values]
        
        self.directives[directive.value].update(values)
        return self
    
    def add_nonce(self, nonce: str) -> 'ContentSecurityPolicyBuilder':
        """
        Add nonce to appropriate directives.
        
        Args:
            nonce: Nonce value
            
        Returns:
            ContentSecurityPolicyBuilder: Self for method chaining
        """
        self.nonce = nonce
        
        # Add nonce to script-src and style-src if they exist
        script_nonce = f"'nonce-{nonce}'"
        style_nonce = f"'nonce-{nonce}'"
        
        if CSPDirective.SCRIPT_SRC.value in self.directives:
            self.directives[CSPDirective.SCRIPT_SRC.value].add(script_nonce)
        
        if CSPDirective.STYLE_SRC.value in self.directives:
            self.directives[CSPDirective.STYLE_SRC.value].add(style_nonce)
        
        return self
    
    def set_report_only(self, report_only: bool) -> 'ContentSecurityPolicyBuilder':
        """
        Set report-only mode.
        
        Args:
            report_only: Whether to use report-only mode
            
        Returns:
            ContentSecurityPolicyBuilder: Self for method chaining
        """
        self.report_only = report_only
        return self
    
    def add_report_uri(self, report_uri: str) -> 'ContentSecurityPolicyBuilder':
        """
        Add report URI.
        
        Args:
            report_uri: URI to report violations to
            
        Returns:
            ContentSecurityPolicyBuilder: Self for method chaining
        """
        self.add_directive(CSPDirective.REPORT_URI, report_uri)
        return self
    
    def build_default_policy(self) -> 'ContentSecurityPolicyBuilder':
        """
        Build a secure default policy.
        
        Returns:
            ContentSecurityPolicyBuilder: Self for method chaining
        """
        # Default secure policy
        self.add_directive(CSPDirective.DEFAULT_SRC, "'self'")
        self.add_directive(CSPDirective.SCRIPT_SRC, ["'self'", "'unsafe-inline'"])
        self.add_directive(CSPDirective.STYLE_SRC, ["'self'", "'unsafe-inline'"])
        self.add_directive(CSPDirective.IMG_SRC, ["'self'", "data:", "https:"])
        self.add_directive(CSPDirective.FONT_SRC, ["'self'", "https:", "data:"])
        self.add_directive(CSPDirective.CONNECT_SRC, "'self'")
        self.add_directive(CSPDirective.MEDIA_SRC, "'self'")
        self.add_directive(CSPDirective.OBJECT_SRC, "'none'")
        self.add_directive(CSPDirective.CHILD_SRC, "'none'")
        self.add_directive(CSPDirective.FRAME_SRC, "'none'")
        self.add_directive(CSPDirective.WORKER_SRC, "'self'")
        self.add_directive(CSPDirective.MANIFEST_SRC, "'self'")
        self.add_directive(CSPDirective.BASE_URI, "'self'")
        self.add_directive(CSPDirective.FORM_ACTION, "'self'")
        self.add_directive(CSPDirective.FRAME_ANCESTORS, "'none'")
        self.add_directive(CSPDirective.UPGRADE_INSECURE_REQUESTS, "")
        self.add_directive(CSPDirective.BLOCK_ALL_MIXED_CONTENT, "")
        
        # Add report URI if configured
        if self.config.csp_report_uri:
            self.add_report_uri(self.config.csp_report_uri)
        
        return self
    
    def build_strict_policy(self) -> 'ContentSecurityPolicyBuilder':
        """
        Build a strict security policy.
        
        Returns:
            ContentSecurityPolicyBuilder: Self for method chaining
        """
        # Very strict policy
        self.add_directive(CSPDirective.DEFAULT_SRC, "'none'")
        self.add_directive(CSPDirective.SCRIPT_SRC, "'self'")
        self.add_directive(CSPDirective.STYLE_SRC, "'self'")
        self.add_directive(CSPDirective.IMG_SRC, "'self'")
        self.add_directive(CSPDirective.FONT_SRC, "'self'")
        self.add_directive(CSPDirective.CONNECT_SRC, "'self'")
        self.add_directive(CSPDirective.MEDIA_SRC, "'none'")
        self.add_directive(CSPDirective.OBJECT_SRC, "'none'")
        self.add_directive(CSPDirective.CHILD_SRC, "'none'")
        self.add_directive(CSPDirective.FRAME_SRC, "'none'")
        self.add_directive(CSPDirective.WORKER_SRC, "'none'")
        self.add_directive(CSPDirective.MANIFEST_SRC, "'self'")
        self.add_directive(CSPDirective.BASE_URI, "'none'")
        self.add_directive(CSPDirective.FORM_ACTION, "'self'")
        self.add_directive(CSPDirective.FRAME_ANCESTORS, "'none'")
        self.add_directive(CSPDirective.UPGRADE_INSECURE_REQUESTS, "")
        self.add_directive(CSPDirective.BLOCK_ALL_MIXED_CONTENT, "")
        
        if self.config.csp_report_uri:
            self.add_report_uri(self.config.csp_report_uri)
        
        return self
    
    def build(self) -> str:
        """
        Build the CSP header value.
        
        Returns:
            str: CSP header value
        """
        if not self.directives:
            self.build_default_policy()
        
        policy_parts = []
        
        for directive, values in self.directives.items():
            if values:
                if directive in ['upgrade-insecure-requests', 'block-all-mixed-content']:
                    policy_parts.append(directive)
                else:
                    policy_parts.append(f"{directive} {' '.join(values)}")
            else:
                policy_parts.append(directive)
        
        return '; '.join(policy_parts)
    
    def get_header_name(self) -> str:
        """
        Get the appropriate header name.
        
        Returns:
            str: Header name
        """
        return "Content-Security-Policy-Report-Only" if self.report_only else "Content-Security-Policy"


class PermissionsPolicyBuilder:
    """Builder for Permissions Policy (formerly Feature Policy)."""
    
    def __init__(self):
        self.policies: Dict[str, List[str]] = {}
    
    def add_policy(self, feature: str, allowlist: Union[str, List[str]]) -> 'PermissionsPolicyBuilder':
        """
        Add permissions policy.
        
        Args:
            feature: Feature name
            allowlist: Allowlist for the feature
            
        Returns:
            PermissionsPolicyBuilder: Self for method chaining
        """
        if isinstance(allowlist, str):
            allowlist = [allowlist]
        
        self.policies[feature] = allowlist
        return self
    
    def build_default_policy(self) -> 'PermissionsPolicyBuilder':
        """
        Build default permissions policy.
        
        Returns:
            PermissionsPolicyBuilder: Self for method chaining
        """
        # Restrict dangerous features
        self.add_policy('camera', [])
        self.add_policy('microphone', [])
        self.add_policy('geolocation', [])
        self.add_policy('usb', [])
        self.add_policy('bluetooth', [])
        self.add_policy('midi', [])
        self.add_policy('payment', [])
        self.add_policy('gyroscope', [])
        self.add_policy('accelerometer', [])
        self.add_policy('magnetometer', [])
        self.add_policy('ambient-light-sensor', [])
        self.add_policy('fullscreen', ['self'])
        self.add_policy('autoplay', [])
        self.add_policy('picture-in-picture', [])
        self.add_policy('clipboard-read', [])
        self.add_policy('clipboard-write', ['self'])
        
        return self
    
    def build(self) -> str:
        """
        Build the Permissions Policy header value.
        
        Returns:
            str: Permissions Policy header value
        """
        if not self.policies:
            self.build_default_policy()
        
        policy_parts = []
        
        for feature, allowlist in self.policies.items():
            if allowlist:
                origins = ', '.join(f'"{origin}"' if origin != 'self' else origin for origin in allowlist)
                policy_parts.append(f'{feature}=({origins})')
            else:
                policy_parts.append(f'{feature}=()')
        
        return ', '.join(policy_parts)


class SecurityHeadersManager:
    """Manager for all security headers."""
    
    def __init__(self, config: SecurityConfig):
        self.config = config
        self.nonce_cache: Dict[str, str] = {}
    
    def generate_nonce(self, request_id: str) -> str:
        """
        Generate or retrieve nonce for request.
        
        Args:
            request_id: Unique request identifier
            
        Returns:
            str: Nonce value
        """
        if request_id not in self.nonce_cache:
            self.nonce_cache[request_id] = secrets.token_urlsafe(self.config.csp_nonce_length)
        
        return self.nonce_cache[request_id]
    
    def get_hsts_header(self) -> str:
        """
        Get HSTS header value.
        
        Returns:
            str: HSTS header value
        """
        hsts_value = f"max-age={self.config.hsts_max_age}"
        
        if self.config.hsts_include_subdomains:
            hsts_value += "; includeSubDomains"
        
        if self.config.hsts_preload:
            hsts_value += "; preload"
        
        return hsts_value
    
    def get_expect_ct_header(self) -> str:
        """
        Get Expect-CT header value.
        
        Returns:
            str: Expect-CT header value
        """
        ct_value = f"max-age={self.config.expect_ct_max_age}"
        
        if self.config.expect_ct_enforce:
            ct_value += ", enforce"
        
        if self.config.expect_ct_report_uri:
            ct_value += f', report-uri="{self.config.expect_ct_report_uri}"'
        
        return ct_value
    
    def get_security_headers(self, request_id: str, is_https: bool = True) -> Dict[str, str]:
        """
        Get all security headers.
        
        Args:
            request_id: Unique request identifier
            is_https: Whether the request is over HTTPS
            
        Returns:
            Dict[str, str]: Security headers
        """
        headers = {}
        
        # HSTS (only for HTTPS)
        if is_https:
            headers['Strict-Transport-Security'] = self.get_hsts_header()
        
        # CSP
        nonce = self.generate_nonce(request_id)
        csp_builder = ContentSecurityPolicyBuilder(self.config)
        csp_builder.build_default_policy().add_nonce(nonce)
        headers[csp_builder.get_header_name()] = csp_builder.build()
        
        # Permissions Policy
        if self.config.feature_policy_enabled:
            permissions_builder = PermissionsPolicyBuilder()
            headers['Permissions-Policy'] = permissions_builder.build()
        
        # Other security headers
        headers['X-Frame-Options'] = self.config.frame_options
        headers['X-Content-Type-Options'] = self.config.content_type_options
        headers['X-XSS-Protection'] = self.config.xss_protection
        headers['Referrer-Policy'] = self.config.referrer_policy
        
        # Expect-CT (only for HTTPS)
        if is_https:
            headers['Expect-CT'] = self.get_expect_ct_header()
        
        # Remove server information
        headers['Server'] = 'WebServer'
        
        # Prevent MIME type sniffing
        headers['X-Robots-Tag'] = 'noindex, nofollow'
        
        return headers
    
    def cleanup_nonce_cache(self, max_age: int = 3600):
        """
        Clean up old nonces from cache.
        
        Args:
            max_age: Maximum age of nonces in seconds
        """
        # Simple cleanup - in production, you'd want to track timestamps
        if len(self.nonce_cache) > 1000:
            # Keep only the most recent 500 nonces
            recent_nonces = dict(list(self.nonce_cache.items())[-500:])
            self.nonce_cache = recent_nonces


class CORSSecurityManager:
    """Manager for CORS security policies."""
    
    def __init__(self, config: SecurityConfig):
        self.config = config
        self.allowed_origins_set = set(config.cors_allow_origins)
        self.allowed_methods_set = set(config.cors_allow_methods)
        self.allowed_headers_set = set(h.lower() for h in config.cors_allow_headers)
    
    def is_origin_allowed(self, origin: str) -> bool:
        """
        Check if origin is allowed.
        
        Args:
            origin: Origin to check
            
        Returns:
            bool: True if origin is allowed
        """
        if "*" in self.allowed_origins_set:
            return True
        
        if origin in self.allowed_origins_set:
            return True
        
        # Check for wildcard patterns
        for allowed_origin in self.allowed_origins_set:
            if allowed_origin.startswith("*."):
                domain = allowed_origin[2:]
                if origin.endswith(domain):
                    return True
        
        return False
    
    def is_method_allowed(self, method: str) -> bool:
        """
        Check if method is allowed.
        
        Args:
            method: HTTP method to check
            
        Returns:
            bool: True if method is allowed
        """
        return method.upper() in self.allowed_methods_set
    
    def are_headers_allowed(self, headers: List[str]) -> bool:
        """
        Check if headers are allowed.
        
        Args:
            headers: List of headers to check
            
        Returns:
            bool: True if all headers are allowed
        """
        if "*" in self.allowed_headers_set:
            return True
        
        for header in headers:
            if header.lower() not in self.allowed_headers_set:
                return False
        
        return True
    
    def get_cors_headers(self, request_origin: str, request_method: str, request_headers: List[str]) -> Dict[str, str]:
        """
        Get CORS headers for request.
        
        Args:
            request_origin: Origin of the request
            request_method: Method of the request
            request_headers: Headers of the request
            
        Returns:
            Dict[str, str]: CORS headers
        """
        headers = {}
        
        # Check origin
        if self.is_origin_allowed(request_origin):
            if "*" in self.allowed_origins_set and not self.config.cors_allow_credentials:
                headers['Access-Control-Allow-Origin'] = '*'
            else:
                headers['Access-Control-Allow-Origin'] = request_origin
        else:
            return {}  # Origin not allowed, return empty headers
        
        # Check method
        if self.is_method_allowed(request_method):
            headers['Access-Control-Allow-Methods'] = ', '.join(self.config.cors_allow_methods)
        
        # Check headers
        if self.are_headers_allowed(request_headers):
            if "*" in self.allowed_headers_set:
                headers['Access-Control-Allow-Headers'] = '*'
            else:
                headers['Access-Control-Allow-Headers'] = ', '.join(self.config.cors_allow_headers)
        
        # Credentials
        if self.config.cors_allow_credentials:
            headers['Access-Control-Allow-Credentials'] = 'true'
        
        # Expose headers
        if self.config.cors_expose_headers:
            headers['Access-Control-Expose-Headers'] = ', '.join(self.config.cors_expose_headers)
        
        # Max age
        headers['Access-Control-Max-Age'] = str(self.config.cors_max_age)
        
        return headers


class SecurityHeadersMiddleware:
    """Middleware to add security headers to responses."""
    
    def __init__(self, config: Optional[SecurityConfig] = None):
        self.config = config or SecurityConfig()
        self.headers_manager = SecurityHeadersManager(self.config)
        self.cors_manager = CORSSecurityManager(self.config)
        
        # Headers to remove for security
        self.dangerous_headers = {
            'server', 'x-powered-by', 'x-aspnet-version', 'x-aspnetmvc-version',
            'x-sourcefiles', 'x-drupal-cache', 'x-varnish', 'via'
        }
    
    async def __call__(self, request, call_next):
        """
        Process request and add security headers.
        
        Args:
            request: HTTP request
            call_next: Next middleware in chain
            
        Returns:
            Response with security headers
        """
        # Generate request ID for nonce
        request_id = getattr(request, 'id', secrets.token_urlsafe(8))
        
        # Check if HTTPS
        is_https = request.url.scheme == 'https'
        
        # Handle CORS preflight
        if request.method == 'OPTIONS':
            response = await self._handle_cors_preflight(request)
            if response:
                return response
        
        # Process request
        response = await call_next(request)
        
        # Add security headers
        security_headers = self.headers_manager.get_security_headers(request_id, is_https)
        
        for header_name, header_value in security_headers.items():
            response.headers[header_name] = header_value
        
        # Add CORS headers
        origin = request.headers.get('origin', '')
        method = request.method
        request_headers = request.headers.get('access-control-request-headers', '').split(',')
        request_headers = [h.strip() for h in request_headers if h.strip()]
        
        cors_headers = self.cors_manager.get_cors_headers(origin, method, request_headers)
        
        for header_name, header_value in cors_headers.items():
            response.headers[header_name] = header_value
        
        # Remove dangerous headers
        for header_name in self.dangerous_headers:
            if header_name in response.headers:
                del response.headers[header_name]
        
        # Add security metadata to response
        response.headers['X-Request-ID'] = request_id
        response.headers['X-Content-Security-Policy-Nonce'] = self.headers_manager.generate_nonce(request_id)
        
        return response
    
    async def _handle_cors_preflight(self, request):
        """
        Handle CORS preflight requests.
        
        Args:
            request: HTTP request
            
        Returns:
            Response or None
        """
        from fastapi.responses import Response
        
        origin = request.headers.get('origin', '')
        method = request.headers.get('access-control-request-method', '')
        headers = request.headers.get('access-control-request-headers', '').split(',')
        headers = [h.strip() for h in headers if h.strip()]
        
        # Check if this is a valid CORS preflight request
        if not origin or not method:
            return None
        
        # Get CORS headers
        cors_headers = self.cors_manager.get_cors_headers(origin, method, headers)
        
        if not cors_headers:
            # Origin not allowed
            return Response(status_code=403)
        
        # Create preflight response
        response = Response(status_code=200)
        
        for header_name, header_value in cors_headers.items():
            response.headers[header_name] = header_value
        
        return response
    
    def get_csp_nonce(self, request_id: str) -> str:
        """
        Get CSP nonce for request.
        
        Args:
            request_id: Request identifier
            
        Returns:
            str: CSP nonce
        """
        return self.headers_manager.generate_nonce(request_id)


# Global instances
security_config = SecurityConfig()
security_headers_middleware = SecurityHeadersMiddleware(security_config)


def create_security_headers_middleware(config: Optional[SecurityConfig] = None) -> SecurityHeadersMiddleware:
    """
    Create security headers middleware with custom configuration.
    
    Args:
        config: Optional security configuration
        
    Returns:
        SecurityHeadersMiddleware: Configured middleware
    """
    return SecurityHeadersMiddleware(config or SecurityConfig())


def get_default_csp_builder() -> ContentSecurityPolicyBuilder:
    """
    Get default CSP builder.
    
    Returns:
        ContentSecurityPolicyBuilder: Default CSP builder
    """
    return ContentSecurityPolicyBuilder(security_config).build_default_policy()


def get_strict_csp_builder() -> ContentSecurityPolicyBuilder:
    """
    Get strict CSP builder.
    
    Returns:
        ContentSecurityPolicyBuilder: Strict CSP builder
    """
    return ContentSecurityPolicyBuilder(security_config).build_strict_policy() 