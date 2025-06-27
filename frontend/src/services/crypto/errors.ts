/**
 * Error types for OPAQUE Client operations
 * Provides structured error handling without information leakage
 */

/**
 * Base error class for all OPAQUE-related errors
 */
export class OpaqueError extends Error {
  public readonly code: string;
  public readonly timestamp: Date;
  public readonly cause?: unknown;

  constructor(message: string, cause?: unknown, code = 'OPAQUE_ERROR') {
    super(message);
    this.name = 'OpaqueError';
    this.code = code;
    this.timestamp = new Date();
    this.cause = cause;

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, OpaqueError.prototype);
  }

  /**
   * Get a sanitized error message for logging (no sensitive information)
   */
  public getSanitizedMessage(): string {
    return `${this.code}: ${this.message}`;
  }

  /**
   * Get error details for debugging (internal use only)
   */
  public getDebugInfo(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      timestamp: this.timestamp.toISOString(),
      cause: this.cause,
      stack: this.stack
    };
  }
}

/**
 * Authentication-specific error for OPAQUE operations
 */
export class AuthenticationError extends OpaqueError {
  constructor(message: string, cause?: unknown) {
    super(message, cause, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Network-related error for OPAQUE operations
 */
export class NetworkError extends OpaqueError {
  public readonly statusCode?: number;

  constructor(message: string, statusCode?: number, cause?: unknown) {
    super(message, cause, 'NETWORK_ERROR');
    this.name = 'NetworkError';
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * Initialization error for OPAQUE client
 */
export class InitializationError extends OpaqueError {
  constructor(message: string, cause?: unknown) {
    super(message, cause, 'INITIALIZATION_ERROR');
    this.name = 'InitializationError';
    Object.setPrototypeOf(this, InitializationError.prototype);
  }
}

/**
 * Memory management error for OPAQUE operations
 */
export class MemoryError extends OpaqueError {
  constructor(message: string, cause?: unknown) {
    super(message, cause, 'MEMORY_ERROR');
    this.name = 'MemoryError';
    Object.setPrototypeOf(this, MemoryError.prototype);
  }
}

/**
 * Key derivation error for OPAQUE operations
 */
export class KeyDerivationError extends OpaqueError {
  constructor(message: string, cause?: unknown) {
    super(message, cause, 'KEY_DERIVATION_ERROR');
    this.name = 'KeyDerivationError';
    Object.setPrototypeOf(this, KeyDerivationError.prototype);
  }
}

/**
 * Serialization/deserialization error for OPAQUE data
 */
export class SerializationError extends OpaqueError {
  constructor(message: string, cause?: unknown) {
    super(message, cause, 'SERIALIZATION_ERROR');
    this.name = 'SerializationError';
    Object.setPrototypeOf(this, SerializationError.prototype);
  }
}

/**
 * Utility function to create user-friendly error messages
 * Ensures no sensitive information is leaked to users
 */
export function createUserMessage(error: OpaqueError): string {
  switch (error.code) {
    case 'AUTHENTICATION_ERROR':
      return 'Authentication failed. Please check your credentials and try again.';
    case 'NETWORK_ERROR':
      return 'Network connection failed. Please check your internet connection and try again.';
    case 'INITIALIZATION_ERROR':
      return 'Application initialization failed. Please restart the app.';
    case 'MEMORY_ERROR':
      return 'Memory operation failed. Please restart the app.';
    case 'KEY_DERIVATION_ERROR':
      return 'Security key generation failed. Please try again.';
    case 'SERIALIZATION_ERROR':
      return 'Data processing failed. Please try again.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

/**
 * Utility function to determine if an error is recoverable
 */
export function isRecoverableError(error: OpaqueError): boolean {
  const recoverableCodes = [
    'NETWORK_ERROR',
    'AUTHENTICATION_ERROR'
  ];
  
  return recoverableCodes.includes(error.code);
}

/**
 * Utility function to determine if error should trigger retry
 */
export function shouldRetry(error: OpaqueError, attemptCount: number, maxAttempts: number): boolean {
  if (attemptCount >= maxAttempts) {
    return false;
  }

  // Only retry network errors and certain initialization errors
  return error.code === 'NETWORK_ERROR' || 
         (error.code === 'INITIALIZATION_ERROR' && attemptCount < 2);
} 