/**
 * Security-aware error message mapping
 * Provides user-friendly messages without leaking sensitive implementation details
 */

import { ErrorType, ErrorSeverity, ErrorCategory } from '../types/errorTypes';

// User-friendly error messages that don't expose internal details
export const ERROR_MESSAGES: Record<ErrorType, string> = {
  // Authentication errors - Generic messages to prevent information leakage
  [ErrorType.AUTH_OPAQUE_REGISTRATION_FAILED]: 'Unable to create your account. Please try again.',
  [ErrorType.AUTH_OPAQUE_LOGIN_FAILED]: 'Sign in failed. Please check your credentials and try again.',
  [ErrorType.AUTH_INVALID_CREDENTIALS]: 'Invalid credentials. Please check your information and try again.',
  [ErrorType.AUTH_SESSION_EXPIRED]: 'Your session has expired. Please sign in again.',
  [ErrorType.AUTH_DEVICE_FINGERPRINT_MISMATCH]: 'Device verification failed. Please sign in again.',
  [ErrorType.AUTH_RATE_LIMITED]: 'Too many attempts. Please wait a moment before trying again.',
  [ErrorType.AUTH_REAUTHENTICATION_REQUIRED]: 'Please sign in again to continue.',

  // Network errors - Helpful but not revealing internal architecture
  [ErrorType.NETWORK_CONNECTION_FAILED]: 'Connection failed. Please check your internet connection.',
  [ErrorType.NETWORK_TIMEOUT]: 'Request timed out. Please try again.',
  [ErrorType.NETWORK_SERVER_UNAVAILABLE]: 'Service temporarily unavailable. Please try again later.',
  [ErrorType.NETWORK_API_RATE_LIMITED]: 'Too many requests. Please wait a moment and try again.',
  [ErrorType.NETWORK_OFFLINE]: 'You appear to be offline. Please check your connection.',
  [ErrorType.NETWORK_INVALID_RESPONSE]: 'Unexpected response from server. Please try again.',

  // Cryptographic errors - Generic messages to prevent crypto implementation leakage
  [ErrorType.CRYPTO_KEY_DERIVATION_FAILED]: 'Security operation failed. Please try again.',
  [ErrorType.CRYPTO_ENCRYPTION_FAILED]: 'Unable to secure your data. Please try again.',
  [ErrorType.CRYPTO_DECRYPTION_FAILED]: 'Unable to access your data. Please try again.',
  [ErrorType.CRYPTO_MEMORY_ALLOCATION_FAILED]: 'System resources unavailable. Please try again.',
  [ErrorType.CRYPTO_INVALID_KEY_FORMAT]: 'Security verification failed. Please sign in again.',
  [ErrorType.CRYPTO_SECURE_RANDOM_FAILED]: 'Security system error. Please try again.',

  // Validation errors - Helpful guidance without exposing validation logic
  [ErrorType.VALIDATION_INPUT_INVALID]: 'Please check your input and try again.',
  [ErrorType.VALIDATION_FORMAT_INVALID]: 'Please enter information in the correct format.',
  [ErrorType.VALIDATION_CONSTRAINT_VIOLATION]: 'Input doesn\'t meet requirements. Please check and try again.',
  [ErrorType.VALIDATION_BUSINESS_RULE_VIOLATION]: 'This action is not allowed. Please check your input.',
  [ErrorType.VALIDATION_DATA_INTEGRITY_FAILED]: 'Data verification failed. Please try again.',

  // System errors - Generic messages without exposing system details
  [ErrorType.SYSTEM_MEMORY_ERROR]: 'System resources low. Please close other apps and try again.',
  [ErrorType.SYSTEM_STORAGE_ERROR]: 'Storage access failed. Please check available space.',
  [ErrorType.SYSTEM_PERMISSION_DENIED]: 'Permission required. Please check app permissions.',
  [ErrorType.SYSTEM_CONFIGURATION_ERROR]: 'Configuration error. Please restart the app.',
  [ErrorType.SYSTEM_UNEXPECTED_STATE]: 'Unexpected error occurred. Please restart the app.',
  [ErrorType.SYSTEM_RESOURCE_EXHAUSTED]: 'System resources unavailable. Please try again later.',

  // Session errors - Clear guidance without exposing session internals
  [ErrorType.SESSION_NOT_FOUND]: 'Session not found. Please sign in again.',
  [ErrorType.SESSION_INVALID_STATE]: 'Session error. Please sign in again.',
  [ErrorType.SESSION_EXTENSION_FAILED]: 'Unable to extend session. Please sign in again.',
  [ErrorType.SESSION_DEACTIVATION_FAILED]: 'Unable to end session. Please try again.',
  [ErrorType.SESSION_RECOVERY_FAILED]: 'Session recovery failed. Please sign in again.',

  // Voice processing errors - User-friendly without technical details
  [ErrorType.VOICE_TRANSCRIPTION_FAILED]: 'Voice transcription failed. Please try recording again.',
  [ErrorType.VOICE_PHRASE_DETECTION_FAILED]: 'Voice phrase not recognized. Please try again.',
  [ErrorType.VOICE_AUDIO_PROCESSING_ERROR]: 'Audio processing error. Please try recording again.',
  [ErrorType.VOICE_MICROPHONE_ACCESS_DENIED]: 'Microphone access required. Please check permissions.'
};

// Recovery suggestions for different error types
export const RECOVERY_SUGGESTIONS: Record<ErrorType, string[]> = {
  // Authentication recovery suggestions
  [ErrorType.AUTH_OPAQUE_REGISTRATION_FAILED]: [
    'Check your internet connection',
    'Try again in a few moments',
    'Contact support if the problem persists'
  ],
  [ErrorType.AUTH_OPAQUE_LOGIN_FAILED]: [
    'Double-check your credentials',
    'Ensure caps lock is off',
    'Try resetting your password if needed'
  ],
  [ErrorType.AUTH_INVALID_CREDENTIALS]: [
    'Verify your username and password',
    'Check for typos',
    'Use the password reset option if needed'
  ],
  [ErrorType.AUTH_SESSION_EXPIRED]: [
    'Sign in again to continue',
    'Enable "Remember me" for longer sessions'
  ],
  [ErrorType.AUTH_DEVICE_FINGERPRINT_MISMATCH]: [
    'Sign in again to verify your device',
    'Contact support if this keeps happening'
  ],
  [ErrorType.AUTH_RATE_LIMITED]: [
    'Wait a few minutes before trying again',
    'Check your internet connection'
  ],
  [ErrorType.AUTH_REAUTHENTICATION_REQUIRED]: [
    'Sign in again for security',
    'This helps protect your account'
  ],

  // Network recovery suggestions
  [ErrorType.NETWORK_CONNECTION_FAILED]: [
    'Check your internet connection',
    'Try switching between WiFi and mobile data',
    'Restart your router if using WiFi'
  ],
  [ErrorType.NETWORK_TIMEOUT]: [
    'Check your internet speed',
    'Try again with a better connection',
    'Move closer to your WiFi router'
  ],
  [ErrorType.NETWORK_SERVER_UNAVAILABLE]: [
    'Try again in a few minutes',
    'Check our status page for updates',
    'Contact support if the issue persists'
  ],
  [ErrorType.NETWORK_API_RATE_LIMITED]: [
    'Wait a moment before trying again',
    'Avoid rapid repeated requests'
  ],
  [ErrorType.NETWORK_OFFLINE]: [
    'Connect to the internet',
    'Check your network settings',
    'Try again once connected'
  ],
  [ErrorType.NETWORK_INVALID_RESPONSE]: [
    'Try again in a moment',
    'Check your internet connection',
    'Contact support if this continues'
  ],

  // Cryptographic recovery suggestions (generic)
  [ErrorType.CRYPTO_KEY_DERIVATION_FAILED]: [
    'Try the operation again',
    'Restart the app if the problem persists',
    'Contact support if needed'
  ],
  [ErrorType.CRYPTO_ENCRYPTION_FAILED]: [
    'Try saving your data again',
    'Check available storage space',
    'Restart the app if needed'
  ],
  [ErrorType.CRYPTO_DECRYPTION_FAILED]: [
    'Try accessing your data again',
    'Sign in again if prompted',
    'Contact support if data is inaccessible'
  ],
  [ErrorType.CRYPTO_MEMORY_ALLOCATION_FAILED]: [
    'Close other apps to free memory',
    'Restart your device',
    'Try again with more available memory'
  ],
  [ErrorType.CRYPTO_INVALID_KEY_FORMAT]: [
    'Sign in again to refresh security keys',
    'Contact support if this persists'
  ],
  [ErrorType.CRYPTO_SECURE_RANDOM_FAILED]: [
    'Try the operation again',
    'Restart the app',
    'Contact support if needed'
  ],

  // Validation recovery suggestions
  [ErrorType.VALIDATION_INPUT_INVALID]: [
    'Check your input for errors',
    'Make sure all required fields are filled',
    'Follow the format examples provided'
  ],
  [ErrorType.VALIDATION_FORMAT_INVALID]: [
    'Check the format requirements',
    'Use the examples as a guide',
    'Remove any special characters if not allowed'
  ],
  [ErrorType.VALIDATION_CONSTRAINT_VIOLATION]: [
    'Check the input requirements',
    'Ensure values are within allowed ranges',
    'Review any character or length limits'
  ],
  [ErrorType.VALIDATION_BUSINESS_RULE_VIOLATION]: [
    'Review the requirements for this action',
    'Check if you have the necessary permissions',
    'Contact support if you believe this is an error'
  ],
  [ErrorType.VALIDATION_DATA_INTEGRITY_FAILED]: [
    'Try entering your data again',
    'Check for any corrupted information',
    'Contact support if the problem persists'
  ],

  // System recovery suggestions
  [ErrorType.SYSTEM_MEMORY_ERROR]: [
    'Close other running apps',
    'Restart your device',
    'Free up device memory'
  ],
  [ErrorType.SYSTEM_STORAGE_ERROR]: [
    'Check available storage space',
    'Delete unnecessary files',
    'Move files to cloud storage'
  ],
  [ErrorType.SYSTEM_PERMISSION_DENIED]: [
    'Check app permissions in settings',
    'Grant necessary permissions',
    'Restart the app after changing permissions'
  ],
  [ErrorType.SYSTEM_CONFIGURATION_ERROR]: [
    'Restart the app',
    'Update the app if available',
    'Contact support if the problem persists'
  ],
  [ErrorType.SYSTEM_UNEXPECTED_STATE]: [
    'Restart the app',
    'Try the operation again',
    'Contact support with details of what you were doing'
  ],
  [ErrorType.SYSTEM_RESOURCE_EXHAUSTED]: [
    'Try again later',
    'Close other running apps',
    'Restart your device'
  ],

  // Session recovery suggestions
  [ErrorType.SESSION_NOT_FOUND]: [
    'Sign in again to create a new session',
    'Check your internet connection'
  ],
  [ErrorType.SESSION_INVALID_STATE]: [
    'Sign in again to reset your session',
    'Contact support if this keeps happening'
  ],
  [ErrorType.SESSION_EXTENSION_FAILED]: [
    'Try extending your session again',
    'Sign in again if extension continues to fail'
  ],
  [ErrorType.SESSION_DEACTIVATION_FAILED]: [
    'Try ending your session again',
    'Restart the app if needed'
  ],
  [ErrorType.SESSION_RECOVERY_FAILED]: [
    'Sign in again to create a new session',
    'Contact support if you\'ve lost important data'
  ],

  // Voice processing recovery suggestions
  [ErrorType.VOICE_TRANSCRIPTION_FAILED]: [
    'Speak clearly and slowly',
    'Reduce background noise',
    'Check your microphone is working',
    'Try recording again'
  ],
  [ErrorType.VOICE_PHRASE_DETECTION_FAILED]: [
    'Speak your phrase clearly',
    'Try saying it exactly as you set it up',
    'Reduce background noise',
    'Check microphone permissions'
  ],
  [ErrorType.VOICE_AUDIO_PROCESSING_ERROR]: [
    'Check microphone permissions',
    'Try recording again',
    'Restart the app if needed'
  ],
  [ErrorType.VOICE_MICROPHONE_ACCESS_DENIED]: [
    'Grant microphone permission in settings',
    'Restart the app after granting permission',
    'Check device microphone is working'
  ]
};

// Help URLs for different error categories
export const HELP_URLS: Record<ErrorCategory, string> = {
  [ErrorCategory.AUTHENTICATION]: '/help/authentication',
  [ErrorCategory.NETWORK]: '/help/connectivity',
  [ErrorCategory.CRYPTOGRAPHIC]: '/help/security',
  [ErrorCategory.VALIDATION]: '/help/input-validation',
  [ErrorCategory.SYSTEM]: '/help/system-requirements',
  [ErrorCategory.SESSION]: '/help/sessions',
  [ErrorCategory.VOICE_PROCESSING]: '/help/voice-features'
};

// Error severity to user-friendly description
export const SEVERITY_DESCRIPTIONS: Record<ErrorSeverity, string> = {
  [ErrorSeverity.LOW]: 'Minor issue',
  [ErrorSeverity.MEDIUM]: 'Moderate issue',
  [ErrorSeverity.HIGH]: 'Significant issue',
  [ErrorSeverity.CRITICAL]: 'Critical issue'
};

/**
 * Get user-friendly error message for an error type
 */
export function getUserMessage(errorType: ErrorType): string {
  return ERROR_MESSAGES[errorType] || 'An unexpected error occurred. Please try again.';
}

/**
 * Get recovery suggestions for an error type
 */
export function getRecoverySuggestions(errorType: ErrorType): string[] {
  return RECOVERY_SUGGESTIONS[errorType] || [
    'Try the operation again',
    'Restart the app if the problem persists',
    'Contact support if needed'
  ];
}

/**
 * Get help URL for an error category
 */
export function getHelpUrl(category: ErrorCategory): string {
  return HELP_URLS[category] || '/help/general';
}

/**
 * Get severity description
 */
export function getSeverityDescription(severity: ErrorSeverity): string {
  return SEVERITY_DESCRIPTIONS[severity] || 'Unknown severity';
}

/**
 * Generate a user-friendly support code from error ID
 * This helps users reference specific errors when contacting support
 */
export function generateSupportCode(errorId: string): string {
  // Create a shortened, user-friendly reference code
  const timestamp = Date.now().toString(36);
  const shortId = errorId.substring(0, 8);
  return `${timestamp}-${shortId}`.toUpperCase();
} 