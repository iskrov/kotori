/**
 * Comprehensive error type definitions for the OPAQUE security system
 * Provides secure error classification without leaking sensitive information
 */

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Error categories for classification
export enum ErrorCategory {
  AUTHENTICATION = 'authentication',
  NETWORK = 'network',
  CRYPTOGRAPHIC = 'cryptographic',
  VALIDATION = 'validation',
  SYSTEM = 'system',
  SESSION = 'session',
  VOICE_PROCESSING = 'voice_processing'
}

// Error types for specific error scenarios
export enum ErrorType {
  // Authentication errors
  AUTH_OPAQUE_REGISTRATION_FAILED = 'auth_opaque_registration_failed',
  AUTH_OPAQUE_LOGIN_FAILED = 'auth_opaque_login_failed',
  AUTH_INVALID_CREDENTIALS = 'auth_invalid_credentials',
  AUTH_SESSION_EXPIRED = 'auth_session_expired',
  AUTH_DEVICE_FINGERPRINT_MISMATCH = 'auth_device_fingerprint_mismatch',
  AUTH_RATE_LIMITED = 'auth_rate_limited',
  AUTH_REAUTHENTICATION_REQUIRED = 'auth_reauthentication_required',

  // Network errors
  NETWORK_CONNECTION_FAILED = 'network_connection_failed',
  NETWORK_TIMEOUT = 'network_timeout',
  NETWORK_SERVER_UNAVAILABLE = 'network_server_unavailable',
  NETWORK_API_RATE_LIMITED = 'network_api_rate_limited',
  NETWORK_OFFLINE = 'network_offline',
  NETWORK_INVALID_RESPONSE = 'network_invalid_response',

  // Cryptographic errors
  CRYPTO_KEY_DERIVATION_FAILED = 'crypto_key_derivation_failed',
  CRYPTO_ENCRYPTION_FAILED = 'crypto_encryption_failed',
  CRYPTO_DECRYPTION_FAILED = 'crypto_decryption_failed',
  CRYPTO_MEMORY_ALLOCATION_FAILED = 'crypto_memory_allocation_failed',
  CRYPTO_INVALID_KEY_FORMAT = 'crypto_invalid_key_format',
  CRYPTO_SECURE_RANDOM_FAILED = 'crypto_secure_random_failed',

  // Validation errors
  VALIDATION_INPUT_INVALID = 'validation_input_invalid',
  VALIDATION_FORMAT_INVALID = 'validation_format_invalid',
  VALIDATION_CONSTRAINT_VIOLATION = 'validation_constraint_violation',
  VALIDATION_BUSINESS_RULE_VIOLATION = 'validation_business_rule_violation',
  VALIDATION_DATA_INTEGRITY_FAILED = 'validation_data_integrity_failed',

  // System errors
  SYSTEM_MEMORY_ERROR = 'system_memory_error',
  SYSTEM_STORAGE_ERROR = 'system_storage_error',
  SYSTEM_PERMISSION_DENIED = 'system_permission_denied',
  SYSTEM_CONFIGURATION_ERROR = 'system_configuration_error',
  SYSTEM_UNEXPECTED_STATE = 'system_unexpected_state',
  SYSTEM_RESOURCE_EXHAUSTED = 'system_resource_exhausted',

  // Session errors
  SESSION_NOT_FOUND = 'session_not_found',
  SESSION_INVALID_STATE = 'session_invalid_state',
  SESSION_EXTENSION_FAILED = 'session_extension_failed',
  SESSION_DEACTIVATION_FAILED = 'session_deactivation_failed',
  SESSION_RECOVERY_FAILED = 'session_recovery_failed',

  // Voice processing errors
  VOICE_TRANSCRIPTION_FAILED = 'voice_transcription_failed',
  VOICE_PHRASE_DETECTION_FAILED = 'voice_phrase_detection_failed',
  VOICE_AUDIO_PROCESSING_ERROR = 'voice_audio_processing_error',
  VOICE_MICROPHONE_ACCESS_DENIED = 'voice_microphone_access_denied'
}

// Base error interface
export interface BaseError {
  id: string; // Unique error correlation ID
  type: ErrorType;
  category: ErrorCategory;
  severity: ErrorSeverity;
  timestamp: Date;
  message: string; // User-facing message
  context?: Record<string, any>; // Additional context (non-sensitive)
}

// Internal error interface with debugging information
export interface InternalError extends BaseError {
  internalMessage: string; // Detailed internal message for debugging
  stackTrace?: string;
  component: string; // Component where error occurred
  operation: string; // Operation that failed
  metadata?: Record<string, any>; // Internal metadata (may contain sensitive info)
}

// Security event interface for audit logging
export interface SecurityEvent extends BaseError {
  userId?: string;
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
  action: string; // Action that triggered the security event
  outcome: 'success' | 'failure' | 'blocked';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

// Error recovery options
export interface ErrorRecoveryOptions {
  canRetry: boolean;
  maxRetries?: number;
  retryDelay?: number;
  exponentialBackoff?: boolean;
  fallbackAction?: () => Promise<void>;
  userAction?: {
    label: string;
    action: () => void;
  };
}

// Complete error information
export interface ErrorInfo extends BaseError {
  recovery?: ErrorRecoveryOptions;
  helpUrl?: string;
  supportCode?: string; // Support reference code
}

// Error handler configuration
export interface ErrorHandlerConfig {
  enableLogging: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  enableRetry: boolean;
  defaultRetryCount: number;
  enableUserFeedback: boolean;
  enableSecurityLogging: boolean;
}

// Error metrics for monitoring
export interface ErrorMetrics {
  errorCount: number;
  errorRate: number;
  recoverySuccessRate: number;
  averageRecoveryTime: number;
  criticalErrorCount: number;
  securityEventCount: number;
}

// Error context for tracking
export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  component: string;
  operation: string;
  timestamp: Date;
  userAgent?: string;
  platform?: string;
}

// Error boundary state
export interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId?: string;
}

// User-facing error display props
export interface ErrorDisplayProps {
  error: ErrorInfo;
  onRetry?: () => void;
  onDismiss?: () => void;
  showDetails?: boolean;
  compact?: boolean;
}

// Error recovery result
export interface ErrorRecoveryResult {
  success: boolean;
  error?: ErrorInfo;
  retryCount: number;
  recoveryTime: number;
} 