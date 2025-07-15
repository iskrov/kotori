"""
Comprehensive input validation framework with security protections.

This module provides extensive input validation, SQL injection prevention,
XSS protection, and sanitization capabilities.
"""

import re
import json
import html
import urllib.parse
from typing import Any, Dict, List, Optional, Union, Callable, Tuple
from dataclasses import dataclass, field
from enum import Enum
import logging
from datetime import datetime
import ipaddress
import email_validator
import bleach
from phonenumbers import NumberParseException
import phonenumbers
import validators
import hashlib
import base64

logger = logging.getLogger(__name__)


class ValidationSeverity(Enum):
    """Validation severity levels."""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class ValidationResult:
    """Result of validation operation."""
    is_valid: bool
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    sanitized_value: Optional[Any] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ValidationRule:
    """Validation rule definition."""
    name: str
    validator: Callable[[Any], bool]
    message: str
    severity: ValidationSeverity = ValidationSeverity.ERROR
    sanitizer: Optional[Callable[[Any], Any]] = None


class SQLInjectionDetector:
    """Detector for SQL injection attempts."""
    
    def __init__(self):
        self.sql_keywords = {
            'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER',
            'EXEC', 'EXECUTE', 'UNION', 'JOIN', 'WHERE', 'FROM', 'INTO',
            'VALUES', 'SET', 'ORDER', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET',
            'GRANT', 'REVOKE', 'COMMIT', 'ROLLBACK', 'TRUNCATE', 'REPLACE'
        }
        
        self.sql_patterns = [
            # Union-based injection
            r'(?i)\b(union\s+select|union\s+all\s+select)',
            # Comment-based injection
            r'(?i)(--|#|/\*|\*/)',
            # Boolean-based injection
            r'(?i)\b(or\s+1\s*=\s*1|and\s+1\s*=\s*1|or\s+\'1\'\s*=\s*\'1\'|and\s+\'1\'\s*=\s*\'1\')',
            # Time-based injection
            r'(?i)\b(waitfor\s+delay|sleep\s*\(|benchmark\s*\()',
            # Stacked queries
            r'(?i);\s*(drop|delete|insert|update|create|alter|exec|execute)',
            # Information schema
            r'(?i)\b(information_schema|sysobjects|syscolumns|pg_tables)',
            # Function calls
            r'(?i)\b(load_file|into\s+outfile|into\s+dumpfile|xp_cmdshell)',
            # Hex encoding attempts
            r'(?i)\b(0x[0-9a-f]+|char\s*\(|ascii\s*\(|hex\s*\()',
            # Conditional statements
            r'(?i)\b(if\s*\(|case\s+when|when\s+then|else\s+end)',
            # Quotes and escaping
            r'(?:\'\s*;\s*|\'\s*--|\'\s*#|\\\x27|\\\x22)',
        ]
        
        self.compiled_patterns = [re.compile(pattern) for pattern in self.sql_patterns]
    
    def detect_sql_injection(self, value: str) -> Tuple[bool, List[str]]:
        """
        Detect potential SQL injection attempts.
        
        Args:
            value: Input value to check
            
        Returns:
            Tuple[bool, List[str]]: (is_injection_detected, list_of_detected_patterns)
        """
        if not isinstance(value, str):
            return False, []
        
        detected_patterns = []
        
        # Check for SQL keywords in suspicious contexts
        normalized_value = value.upper()
        suspicious_keywords = []
        
        for keyword in self.sql_keywords:
            if keyword in normalized_value:
                suspicious_keywords.append(keyword)
        
        # If multiple SQL keywords are present, it's suspicious
        if len(suspicious_keywords) > 2:
            detected_patterns.append(f"Multiple SQL keywords detected: {', '.join(suspicious_keywords)}")
        
        # Check regex patterns
        for pattern in self.compiled_patterns:
            if pattern.search(value):
                detected_patterns.append(f"SQL injection pattern detected: {pattern.pattern}")
        
        return len(detected_patterns) > 0, detected_patterns
    
    def sanitize_sql_input(self, value: str) -> str:
        """
        Sanitize input to prevent SQL injection.
        
        Args:
            value: Input value to sanitize
            
        Returns:
            str: Sanitized value
        """
        if not isinstance(value, str):
            return str(value)
        
        # Remove or escape dangerous characters
        sanitized = value
        
        # Remove SQL comments
        sanitized = re.sub(r'--.*$', '', sanitized, flags=re.MULTILINE)
        sanitized = re.sub(r'/\*.*?\*/', '', sanitized, flags=re.DOTALL)
        sanitized = re.sub(r'#.*$', '', sanitized, flags=re.MULTILINE)
        
        # Escape quotes
        sanitized = sanitized.replace("'", "''")
        sanitized = sanitized.replace('"', '""')
        
        # Remove null bytes
        sanitized = sanitized.replace('\x00', '')
        
        # Remove control characters
        sanitized = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', sanitized)
        
        return sanitized


class XSSProtector:
    """Protector against Cross-Site Scripting (XSS) attacks."""
    
    def __init__(self):
        self.allowed_tags = {
            'p', 'br', 'strong', 'em', 'u', 'i', 'b', 'span', 'div',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
            'blockquote', 'pre', 'code'
        }
        
        self.allowed_attributes = {
            '*': ['class', 'id'],
            'span': ['style'],
            'div': ['style'],
            'p': ['style']
        }
        
        self.dangerous_patterns = [
            r'(?i)<script[^>]*>.*?</script>',
            r'(?i)<iframe[^>]*>.*?</iframe>',
            r'(?i)<object[^>]*>.*?</object>',
            r'(?i)<embed[^>]*>.*?</embed>',
            r'(?i)<applet[^>]*>.*?</applet>',
            r'(?i)<form[^>]*>.*?</form>',
            r'(?i)<meta[^>]*>',
            r'(?i)<link[^>]*>',
            r'(?i)javascript:',
            r'(?i)vbscript:',
            r'(?i)data:',
            r'(?i)on\w+\s*=',
            r'(?i)expression\s*\(',
            r'(?i)eval\s*\(',
            r'(?i)alert\s*\(',
            r'(?i)confirm\s*\(',
            r'(?i)prompt\s*\(',
        ]
        
        self.compiled_patterns = [re.compile(pattern) for pattern in self.dangerous_patterns]
    
    def detect_xss(self, value: str) -> Tuple[bool, List[str]]:
        """
        Detect potential XSS attempts.
        
        Args:
            value: Input value to check
            
        Returns:
            Tuple[bool, List[str]]: (is_xss_detected, list_of_detected_patterns)
        """
        if not isinstance(value, str):
            return False, []
        
        detected_patterns = []
        
        # Check for dangerous patterns
        for pattern in self.compiled_patterns:
            if pattern.search(value):
                detected_patterns.append(f"XSS pattern detected: {pattern.pattern}")
        
        # Check for HTML entities that might be used for obfuscation
        if '&' in value and ';' in value:
            # Check for suspicious entity combinations
            suspicious_entities = [
                '&lt;script&gt;', '&lt;iframe&gt;', '&lt;object&gt;',
                '&quot;javascript:', '&quot;vbscript:', '&quot;data:'
            ]
            
            for entity in suspicious_entities:
                if entity in value.lower():
                    detected_patterns.append(f"Suspicious HTML entity: {entity}")
        
        return len(detected_patterns) > 0, detected_patterns
    
    def sanitize_html(self, value: str, strict: bool = False) -> str:
        """
        Sanitize HTML to prevent XSS.
        
        Args:
            value: HTML string to sanitize
            strict: If True, remove all HTML tags
            
        Returns:
            str: Sanitized HTML string
        """
        if not isinstance(value, str):
            return str(value)
        
        if strict:
            # Remove all HTML tags
            return bleach.clean(value, tags=[], attributes={}, strip=True)
        else:
            # Allow safe tags only
            return bleach.clean(
                value,
                tags=self.allowed_tags,
                attributes=self.allowed_attributes,
                strip=True
            )
    
    def escape_html(self, value: str) -> str:
        """
        Escape HTML special characters.
        
        Args:
            value: String to escape
            
        Returns:
            str: HTML-escaped string
        """
        if not isinstance(value, str):
            return str(value)
        
        return html.escape(value, quote=True)


class InputValidator:
    """Comprehensive input validator with multiple validation types."""
    
    def __init__(self):
        self.sql_detector = SQLInjectionDetector()
        self.xss_protector = XSSProtector()
        self.validation_rules: Dict[str, List[ValidationRule]] = {}
        
        # Initialize default rules
        self._initialize_default_rules()
    
    def _initialize_default_rules(self):
        """Initialize default validation rules."""
        self.validation_rules = {
            'string': [
                ValidationRule(
                    name='max_length',
                    validator=lambda x: len(str(x)) <= 1000,
                    message='String too long (max 1000 characters)',
                    sanitizer=lambda x: str(x)[:1000]
                ),
                ValidationRule(
                    name='no_null_bytes',
                    validator=lambda x: '\x00' not in str(x),
                    message='Null bytes not allowed',
                    sanitizer=lambda x: str(x).replace('\x00', '')
                ),
                ValidationRule(
                    name='no_control_chars',
                    validator=lambda x: not re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]', str(x)),
                    message='Control characters not allowed',
                    sanitizer=lambda x: re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]', '', str(x))
                )
            ],
            'email': [
                ValidationRule(
                    name='valid_email',
                    validator=self._is_valid_email,
                    message='Invalid email format'
                )
            ],
            'url': [
                ValidationRule(
                    name='valid_url',
                    validator=self._is_valid_url,
                    message='Invalid URL format'
                )
            ],
            'integer': [
                ValidationRule(
                    name='valid_integer',
                    validator=self._is_valid_integer,
                    message='Invalid integer format',
                    sanitizer=lambda x: int(x) if str(x).isdigit() else None
                )
            ],
            'phone': [
                ValidationRule(
                    name='valid_phone',
                    validator=self._is_valid_phone,
                    message='Invalid phone number format'
                )
            ],
            'json': [
                ValidationRule(
                    name='valid_json',
                    validator=self._is_valid_json,
                    message='Invalid JSON format'
                )
            ],
            'password': [
                ValidationRule(
                    name='min_length',
                    validator=lambda x: len(str(x)) >= 8,
                    message='Password must be at least 8 characters long'
                ),
                ValidationRule(
                    name='has_uppercase',
                    validator=lambda x: any(c.isupper() for c in str(x)),
                    message='Password must contain at least one uppercase letter'
                ),
                ValidationRule(
                    name='has_lowercase',
                    validator=lambda x: any(c.islower() for c in str(x)),
                    message='Password must contain at least one lowercase letter'
                ),
                ValidationRule(
                    name='has_digit',
                    validator=lambda x: any(c.isdigit() for c in str(x)),
                    message='Password must contain at least one digit'
                ),
                ValidationRule(
                    name='has_special',
                    validator=lambda x: any(c in '!@#$%^&*()_+-=[]{}|;:,.<>?' for c in str(x)),
                    message='Password must contain at least one special character'
                )
            ]
        }
    
    def validate_input(
        self,
        value: Any,
        input_type: str,
        custom_rules: Optional[List[ValidationRule]] = None,
        check_security: bool = True
    ) -> ValidationResult:
        """
        Validate input value with comprehensive checks.
        
        Args:
            value: Value to validate
            input_type: Type of input (string, email, url, etc.)
            custom_rules: Optional custom validation rules
            check_security: Whether to check for security issues
            
        Returns:
            ValidationResult: Validation result with errors and sanitized value
        """
        result = ValidationResult(is_valid=True, sanitized_value=value)
        
        # Security checks
        if check_security and isinstance(value, str):
            self._check_security_issues(value, result)
        
        # Apply type-specific rules
        if input_type in self.validation_rules:
            for rule in self.validation_rules[input_type]:
                if not rule.validator(value):
                    if rule.severity == ValidationSeverity.ERROR:
                        result.errors.append(rule.message)
                        result.is_valid = False
                    elif rule.severity == ValidationSeverity.WARNING:
                        result.warnings.append(rule.message)
                    
                    # Apply sanitizer if available
                    if rule.sanitizer:
                        result.sanitized_value = rule.sanitizer(value)
        
        # Apply custom rules
        if custom_rules:
            for rule in custom_rules:
                if not rule.validator(value):
                    if rule.severity == ValidationSeverity.ERROR:
                        result.errors.append(rule.message)
                        result.is_valid = False
                    elif rule.severity == ValidationSeverity.WARNING:
                        result.warnings.append(rule.message)
                    
                    if rule.sanitizer:
                        result.sanitized_value = rule.sanitizer(value)
        
        return result
    
    def _check_security_issues(self, value: str, result: ValidationResult):
        """Check for security issues in input."""
        # SQL injection check
        is_sql_injection, sql_patterns = self.sql_detector.detect_sql_injection(value)
        if is_sql_injection:
            result.errors.extend([f"SQL injection detected: {pattern}" for pattern in sql_patterns])
            result.is_valid = False
            result.sanitized_value = self.sql_detector.sanitize_sql_input(value)
        
        # XSS check
        is_xss, xss_patterns = self.xss_protector.detect_xss(value)
        if is_xss:
            result.errors.extend([f"XSS attempt detected: {pattern}" for pattern in xss_patterns])
            result.is_valid = False
            result.sanitized_value = self.xss_protector.sanitize_html(value)
    
    def _is_valid_email(self, value: str) -> bool:
        """Check if value is a valid email."""
        try:
            email_validator.validate_email(value)
            return True
        except email_validator.EmailNotValidError:
            return False
    
    def _is_valid_url(self, value: str) -> bool:
        """Check if value is a valid URL."""
        return validators.url(value) is True
    
    def _is_valid_integer(self, value: Any) -> bool:
        """Check if value is a valid integer."""
        try:
            int(value)
            return True
        except (ValueError, TypeError):
            return False
    
    def _is_valid_phone(self, value: str) -> bool:
        """Check if value is a valid phone number."""
        try:
            parsed = phonenumbers.parse(value, None)
            return phonenumbers.is_valid_number(parsed)
        except NumberParseException:
            return False
    
    def _is_valid_json(self, value: str) -> bool:
        """Check if value is valid JSON."""
        try:
            json.loads(value)
            return True
        except (json.JSONDecodeError, TypeError):
            return False
    
    def validate_multiple_fields(
        self,
        fields: Dict[str, Any],
        field_types: Dict[str, str],
        custom_rules: Optional[Dict[str, List[ValidationRule]]] = None
    ) -> Dict[str, ValidationResult]:
        """
        Validate multiple fields at once.
        
        Args:
            fields: Dictionary of field names and values
            field_types: Dictionary of field names and their types
            custom_rules: Optional custom rules per field
            
        Returns:
            Dict[str, ValidationResult]: Validation results per field
        """
        results = {}
        
        for field_name, value in fields.items():
            field_type = field_types.get(field_name, 'string')
            field_rules = custom_rules.get(field_name, []) if custom_rules else []
            
            results[field_name] = self.validate_input(
                value=value,
                input_type=field_type,
                custom_rules=field_rules
            )
        
        return results
    
    def sanitize_recursive(self, data: Any, max_depth: int = 10) -> Any:
        """
        Recursively sanitize nested data structures.
        
        Args:
            data: Data to sanitize
            max_depth: Maximum recursion depth
            
        Returns:
            Any: Sanitized data
        """
        if max_depth <= 0:
            return data
        
        if isinstance(data, dict):
            return {
                key: self.sanitize_recursive(value, max_depth - 1)
                for key, value in data.items()
            }
        elif isinstance(data, list):
            return [
                self.sanitize_recursive(item, max_depth - 1)
                for item in data
            ]
        elif isinstance(data, str):
            # Basic sanitization for strings
            result = self.validate_input(data, 'string')
            return result.sanitized_value
        else:
            return data
    
    def add_custom_rule(self, input_type: str, rule: ValidationRule):
        """
        Add custom validation rule for input type.
        
        Args:
            input_type: Type of input
            rule: Validation rule to add
        """
        if input_type not in self.validation_rules:
            self.validation_rules[input_type] = []
        
        self.validation_rules[input_type].append(rule)
    
    def validate_ip_address(self, value: str) -> ValidationResult:
        """
        Validate IP address.
        
        Args:
            value: IP address string
            
        Returns:
            ValidationResult: Validation result
        """
        result = ValidationResult(is_valid=True, sanitized_value=value)
        
        try:
            ip = ipaddress.ip_address(value)
            
            # Check for private/internal addresses
            if ip.is_private:
                result.warnings.append("Private IP address detected")
            
            if ip.is_loopback:
                result.warnings.append("Loopback IP address detected")
            
            if ip.is_multicast:
                result.warnings.append("Multicast IP address detected")
            
            result.metadata['ip_version'] = ip.version
            result.metadata['is_private'] = ip.is_private
            result.metadata['is_global'] = ip.is_global
            
        except ValueError:
            result.is_valid = False
            result.errors.append("Invalid IP address format")
        
        return result
    
    def validate_file_upload(
        self,
        filename: str,
        file_content: bytes,
        allowed_extensions: Optional[List[str]] = None,
        max_size: int = 10 * 1024 * 1024  # 10MB default
    ) -> ValidationResult:
        """
        Validate file upload.
        
        Args:
            filename: Name of the file
            file_content: File content as bytes
            allowed_extensions: List of allowed file extensions
            max_size: Maximum file size in bytes
            
        Returns:
            ValidationResult: Validation result
        """
        result = ValidationResult(is_valid=True, sanitized_value=filename)
        
        # Check file size
        if len(file_content) > max_size:
            result.errors.append(f"File size exceeds maximum allowed size ({max_size} bytes)")
            result.is_valid = False
        
        # Check file extension
        if allowed_extensions:
            file_ext = filename.split('.')[-1].lower() if '.' in filename else ''
            if file_ext not in [ext.lower() for ext in allowed_extensions]:
                result.errors.append(f"File extension '{file_ext}' not allowed")
                result.is_valid = False
        
        # Check for dangerous filenames
        dangerous_patterns = [
            r'\.\./',  # Path traversal
            r'\.exe$',  # Executable
            r'\.bat$',  # Batch file
            r'\.cmd$',  # Command file
            r'\.com$',  # Command file
            r'\.scr$',  # Screen saver
            r'\.pif$',  # Program information file
        ]
        
        for pattern in dangerous_patterns:
            if re.search(pattern, filename, re.IGNORECASE):
                result.errors.append(f"Dangerous filename pattern detected: {pattern}")
                result.is_valid = False
        
        # Sanitize filename
        # Remove dangerous characters
        sanitized_filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
        # Remove null bytes
        sanitized_filename = sanitized_filename.replace('\x00', '')
        # Limit length
        sanitized_filename = sanitized_filename[:255]
        
        result.sanitized_value = sanitized_filename
        
        # Add metadata
        result.metadata['file_size'] = len(file_content)
        result.metadata['file_extension'] = filename.split('.')[-1].lower() if '.' in filename else ''
        result.metadata['file_hash'] = hashlib.sha256(file_content).hexdigest()
        
        return result


# Global validator instance
input_validator = InputValidator()


def validate_request_data(data: Dict[str, Any], validation_schema: Dict[str, str]) -> Dict[str, ValidationResult]:
    """
    Convenience function to validate request data.
    
    Args:
        data: Request data to validate
        validation_schema: Schema mapping field names to validation types
        
    Returns:
        Dict[str, ValidationResult]: Validation results
    """
    return input_validator.validate_multiple_fields(data, validation_schema)


def sanitize_user_input(value: Any) -> Any:
    """
    Convenience function to sanitize user input.
    
    Args:
        value: Value to sanitize
        
    Returns:
        Any: Sanitized value
    """
    if isinstance(value, str):
        result = input_validator.validate_input(value, 'string')
        return result.sanitized_value
    elif isinstance(value, (dict, list)):
        return input_validator.sanitize_recursive(value)
    else:
        return value 