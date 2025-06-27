/**
 * Core error handling utilities for the OPAQUE security system
 * Provides secure error classification, logging, and recovery mechanisms
 */

import { 
  ErrorType, 
  ErrorCategory, 
  ErrorSeverity, 
  BaseError, 
  InternalError, 
  ErrorInfo, 
  ErrorRecoveryOptions,
  ErrorContext,
  SecurityEvent
} from '../types/errorTypes';
import { 
  getUserMessage, 
  getRecoverySuggestions, 
  getHelpUrl, 
  generateSupportCode 
} from './secureErrorMessages';

// Constants for error handling configuration
const MAX_RETRY_COUNT = 3;
const BASE_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 30000; // 30 seconds
const ERROR_ID_LENGTH = 16;

/**
 * Generate a unique error ID for correlation
 */
export function generateErrorId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

/**
 * Classify error severity based on error type
 */
export function classifyErrorSeverity(errorType: ErrorType): ErrorSeverity {
  switch (errorType) {
    // Critical errors that require immediate attention
    case ErrorType.CRYPTO_KEY_DERIVATION_FAILED:
    case ErrorType.CRYPTO_ENCRYPTION_FAILED:
    case ErrorType.CRYPTO_DECRYPTION_FAILED:
    case ErrorType.CRYPTO_MEMORY_ALLOCATION_FAILED:
    case ErrorType.SYSTEM_MEMORY_ERROR:
    case ErrorType.SYSTEM_RESOURCE_EXHAUSTED:
      return ErrorSeverity.CRITICAL;

    // High severity errors that significantly impact functionality
    case ErrorType.AUTH_OPAQUE_REGISTRATION_FAILED:
    case ErrorType.AUTH_OPAQUE_LOGIN_FAILED:
    case ErrorType.AUTH_DEVICE_FINGERPRINT_MISMATCH:
    case ErrorType.CRYPTO_INVALID_KEY_FORMAT:
    case ErrorType.CRYPTO_SECURE_RANDOM_FAILED:
    case ErrorType.SYSTEM_CONFIGURATION_ERROR:
    case ErrorType.SYSTEM_UNEXPECTED_STATE:
    case ErrorType.SESSION_RECOVERY_FAILED:
      return ErrorSeverity.HIGH;

    // Medium severity errors that affect user experience
    case ErrorType.AUTH_SESSION_EXPIRED:
    case ErrorType.AUTH_REAUTHENTICATION_REQUIRED:
    case ErrorType.NETWORK_CONNECTION_FAILED:
    case ErrorType.NETWORK_SERVER_UNAVAILABLE:
    case ErrorType.SYSTEM_STORAGE_ERROR:
    case ErrorType.SYSTEM_PERMISSION_DENIED:
    case ErrorType.SESSION_NOT_FOUND:
    case ErrorType.SESSION_INVALID_STATE:
    case ErrorType.VOICE_TRANSCRIPTION_FAILED:
    case ErrorType.VOICE_MICROPHONE_ACCESS_DENIED:
      return ErrorSeverity.MEDIUM;

    // Low severity errors that are recoverable
    case ErrorType.AUTH_INVALID_CREDENTIALS:
    case ErrorType.AUTH_RATE_LIMITED:
    case ErrorType.NETWORK_TIMEOUT:
    case ErrorType.NETWORK_API_RATE_LIMITED:
    case ErrorType.NETWORK_OFFLINE:
    case ErrorType.NETWORK_INVALID_RESPONSE:
    case ErrorType.VALIDATION_INPUT_INVALID:
    case ErrorType.VALIDATION_FORMAT_INVALID:
    case ErrorType.VALIDATION_CONSTRAINT_VIOLATION:
    case ErrorType.VALIDATION_BUSINESS_RULE_VIOLATION:
    case ErrorType.VALIDATION_DATA_INTEGRITY_FAILED:
    case ErrorType.SESSION_EXTENSION_FAILED:
    case ErrorType.SESSION_DEACTIVATION_FAILED:
    case ErrorType.VOICE_PHRASE_DETECTION_FAILED:
    case ErrorType.VOICE_AUDIO_PROCESSING_ERROR:
      return ErrorSeverity.LOW;

    default:
      return ErrorSeverity.MEDIUM;
  }
}

/**
 * Determine error category from error type
 */
export function getErrorCategory(errorType: ErrorType): ErrorCategory {
  if (errorType.startsWith('AUTH_')) {
    return ErrorCategory.AUTHENTICATION;
  }
  if (errorType.startsWith('NETWORK_')) {
    return ErrorCategory.NETWORK;
  }
  if (errorType.startsWith('CRYPTO_')) {
    return ErrorCategory.CRYPTOGRAPHIC;
  }
  if (errorType.startsWith('VALIDATION_')) {
    return ErrorCategory.VALIDATION;
  }
  if (errorType.startsWith('SYSTEM_')) {
    return ErrorCategory.SYSTEM;
  }
  if (errorType.startsWith('SESSION_')) {
    return ErrorCategory.SESSION;
  }
  if (errorType.startsWith('VOICE_')) {
    return ErrorCategory.VOICE_PROCESSING;
  }
  return ErrorCategory.SYSTEM; // Default fallback
}

/**
 * Determine if an error is retryable based on its type
 */
export function isRetryableError(errorType: ErrorType): boolean {
  const retryableErrors = [
    ErrorType.NETWORK_CONNECTION_FAILED,
    ErrorType.NETWORK_TIMEOUT,
    ErrorType.NETWORK_SERVER_UNAVAILABLE,
    ErrorType.NETWORK_INVALID_RESPONSE,
    ErrorType.CRYPTO_MEMORY_ALLOCATION_FAILED,
    ErrorType.SYSTEM_MEMORY_ERROR,
    ErrorType.SYSTEM_RESOURCE_EXHAUSTED,
    ErrorType.SESSION_EXTENSION_FAILED,
    ErrorType.VOICE_TRANSCRIPTION_FAILED,
    ErrorType.VOICE_AUDIO_PROCESSING_ERROR
  ];
  
  return retryableErrors.includes(errorType);
}

/**
 * Calculate retry delay with exponential backoff
 */
export function calculateRetryDelay(retryCount: number, baseDelay: number = BASE_RETRY_DELAY): number {
  const delay = baseDelay * Math.pow(2, retryCount);
  return Math.min(delay, MAX_RETRY_DELAY);
}

/**
 * Create error recovery options based on error type
 */
export function createRecoveryOptions(errorType: ErrorType): ErrorRecoveryOptions {
  const canRetry = isRetryableError(errorType);
  const maxRetries = canRetry ? MAX_RETRY_COUNT : 0;
  
  return {
    canRetry,
    maxRetries,
    retryDelay: canRetry ? BASE_RETRY_DELAY : undefined,
    exponentialBackoff: canRetry,
    userAction: getUserAction(errorType)
  };
}

/**
 * Get user action for specific error types
 */
function getUserAction(errorType: ErrorType): { label: string; action: () => void } | undefined {
  switch (errorType) {
    case ErrorType.AUTH_SESSION_EXPIRED:
    case ErrorType.AUTH_REAUTHENTICATION_REQUIRED:
      return {
        label: 'Sign In Again',
        action: () => {
          // This will be implemented by the consuming component
          console.log('Navigate to sign in');
        }
      };
    
    case ErrorType.SYSTEM_PERMISSION_DENIED:
    case ErrorType.VOICE_MICROPHONE_ACCESS_DENIED:
      return {
        label: 'Check Permissions',
        action: () => {
          // This will be implemented by the consuming component
          console.log('Navigate to app settings');
        }
      };
    
    case ErrorType.NETWORK_OFFLINE:
      return {
        label: 'Check Connection',
        action: () => {
          // This will be implemented by the consuming component
          console.log('Navigate to network settings');
        }
      };
    
    default:
      return undefined;
  }
}

/**
 * Create a complete ErrorInfo object from an error type and context
 */
export function createErrorInfo(
  errorType: ErrorType,
  context: Partial<ErrorContext> = {},
  originalError?: Error
): ErrorInfo {
  const errorId = generateErrorId();
  const category = getErrorCategory(errorType);
  const severity = classifyErrorSeverity(errorType);
  const recovery = createRecoveryOptions(errorType);
  
  return {
    id: errorId,
    type: errorType,
    category,
    severity,
    timestamp: new Date(),
    message: getUserMessage(errorType),
    context: {
      component: context.component || 'unknown',
      operation: context.operation || 'unknown',
      platform: context.platform || getPlatform()
    },
    recovery,
    helpUrl: getHelpUrl(category),
    supportCode: generateSupportCode(errorId)
  };
}

/**
 * Create an internal error for debugging purposes
 */
export function createInternalError(
  errorType: ErrorType,
  internalMessage: string,
  context: ErrorContext,
  originalError?: Error,
  metadata?: Record<string, any>
): InternalError {
  const errorInfo = createErrorInfo(errorType, context, originalError);
  
  return {
    ...errorInfo,
    internalMessage,
    stackTrace: originalError?.stack,
    component: context.component,
    operation: context.operation,
    metadata
  };
}

/**
 * Create a security event for audit logging
 */
export function createSecurityEvent(
  errorType: ErrorType,
  action: string,
  outcome: 'success' | 'failure' | 'blocked',
  context: Partial<ErrorContext> = {},
  riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'medium'
): SecurityEvent {
  const errorInfo = createErrorInfo(errorType, context);
  
  return {
    ...errorInfo,
    userId: context.userId,
    deviceId: getDeviceId(),
    ipAddress: getClientIP(),
    userAgent: getUserAgent(),
    action,
    outcome,
    riskLevel
  };
}

/**
 * Sanitize error for user display (remove sensitive information)
 */
export function sanitizeErrorForUser(error: InternalError): ErrorInfo {
  const { internalMessage, stackTrace, metadata, ...safeError } = error;
  return safeError;
}

/**
 * Check if error contains sensitive information
 */
export function containsSensitiveInfo(error: Error): boolean {
  const sensitivePatterns = [
    /key/i,
    /password/i,
    /token/i,
    /secret/i,
    /private/i,
    /credential/i,
    /opaque/i,
    /crypto/i,
    /hash/i,
    /salt/i
  ];
  
  const errorString = error.message + (error.stack || '');
  return sensitivePatterns.some(pattern => pattern.test(errorString));
}

/**
 * Wrap a function with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => any>(
  fn: T,
  context: ErrorContext,
  errorType?: ErrorType
): T {
  return ((...args: any[]) => {
    try {
      const result = fn(...args);
      
      // Handle promise rejections
      if (result instanceof Promise) {
        return result.catch((error) => {
          const errorInfo = createInternalError(
            errorType || ErrorType.SYSTEM_UNEXPECTED_STATE,
            error.message,
            context,
            error
          );
          throw errorInfo;
        });
      }
      
      return result;
    } catch (error) {
      const errorInfo = createInternalError(
        errorType || ErrorType.SYSTEM_UNEXPECTED_STATE,
        error instanceof Error ? error.message : String(error),
        context,
        error instanceof Error ? error : undefined
      );
      throw errorInfo;
    }
  }) as T;
}

/**
 * Async wrapper for error handling
 */
export async function withAsyncErrorHandling<T>(
  operation: () => Promise<T>,
  context: ErrorContext,
  errorType?: ErrorType
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const errorInfo = createInternalError(
      errorType || ErrorType.SYSTEM_UNEXPECTED_STATE,
      error instanceof Error ? error.message : String(error),
      context,
      error instanceof Error ? error : undefined
    );
    throw errorInfo;
  }
}

// Platform detection utilities
function getPlatform(): string {
  if (typeof window !== 'undefined') {
    return 'web';
  }
  // React Native platform detection would go here
  return 'unknown';
}

function getDeviceId(): string {
  // This would be implemented based on the platform
  return 'device-id-placeholder';
}

function getClientIP(): string {
  // This would be implemented based on the platform
  return 'ip-placeholder';
}

function getUserAgent(): string {
  if (typeof navigator !== 'undefined') {
    return navigator.userAgent;
  }
  return 'unknown';
}

/**
 * Error boundary helper for React components
 */
export function handleComponentError(
  error: Error,
  errorInfo: React.ErrorInfo,
  componentName: string
): ErrorInfo {
  const context: ErrorContext = {
    component: componentName,
    operation: 'render',
    timestamp: new Date(),
    platform: getPlatform()
  };
  
  return createErrorInfo(
    ErrorType.SYSTEM_UNEXPECTED_STATE,
    context,
    error
  );
} 