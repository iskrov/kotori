/**
 * Tests for error handling utilities
 */

import {
  generateErrorId,
  classifyErrorSeverity,
  getErrorCategory,
  isRetryableError,
  calculateRetryDelay,
  createErrorInfo,
  createInternalError,
  sanitizeErrorForUser,
  containsSensitiveInfo,
  withErrorHandling,
  withAsyncErrorHandling
} from '../errorHandling';
import {
  ErrorType,
  ErrorSeverity,
  ErrorCategory,
  ErrorContext
} from '../../types/errorTypes';

describe('Error Handling Utilities', () => {
  const mockContext: ErrorContext = {
    component: 'TestComponent',
    operation: 'test_operation',
    timestamp: new Date(),
    platform: 'test'
  };

  describe('generateErrorId', () => {
    it('should generate unique error IDs', () => {
      const id1 = generateErrorId();
      const id2 = generateErrorId();
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(0);
    });
  });

  describe('classifyErrorSeverity', () => {
    it('should classify critical errors correctly', () => {
      expect(classifyErrorSeverity(ErrorType.CRYPTO_KEY_DERIVATION_FAILED))
        .toBe(ErrorSeverity.CRITICAL);
      expect(classifyErrorSeverity(ErrorType.CRYPTO_ENCRYPTION_FAILED))
        .toBe(ErrorSeverity.CRITICAL);
      expect(classifyErrorSeverity(ErrorType.SYSTEM_MEMORY_ERROR))
        .toBe(ErrorSeverity.CRITICAL);
    });

    it('should classify high severity errors correctly', () => {
      expect(classifyErrorSeverity(ErrorType.AUTH_OPAQUE_REGISTRATION_FAILED))
        .toBe(ErrorSeverity.HIGH);
      expect(classifyErrorSeverity(ErrorType.AUTH_OPAQUE_LOGIN_FAILED))
        .toBe(ErrorSeverity.HIGH);
      expect(classifyErrorSeverity(ErrorType.SYSTEM_CONFIGURATION_ERROR))
        .toBe(ErrorSeverity.HIGH);
    });

    it('should classify medium severity errors correctly', () => {
      expect(classifyErrorSeverity(ErrorType.AUTH_SESSION_EXPIRED))
        .toBe(ErrorSeverity.MEDIUM);
      expect(classifyErrorSeverity(ErrorType.NETWORK_CONNECTION_FAILED))
        .toBe(ErrorSeverity.MEDIUM);
      expect(classifyErrorSeverity(ErrorType.VOICE_TRANSCRIPTION_FAILED))
        .toBe(ErrorSeverity.MEDIUM);
    });

    it('should classify low severity errors correctly', () => {
      expect(classifyErrorSeverity(ErrorType.AUTH_INVALID_CREDENTIALS))
        .toBe(ErrorSeverity.LOW);
      expect(classifyErrorSeverity(ErrorType.NETWORK_TIMEOUT))
        .toBe(ErrorSeverity.LOW);
      expect(classifyErrorSeverity(ErrorType.VALIDATION_INPUT_INVALID))
        .toBe(ErrorSeverity.LOW);
    });
  });

  describe('getErrorCategory', () => {
    it('should categorize authentication errors', () => {
      expect(getErrorCategory(ErrorType.AUTH_OPAQUE_LOGIN_FAILED))
        .toBe(ErrorCategory.AUTHENTICATION);
      expect(getErrorCategory(ErrorType.AUTH_SESSION_EXPIRED))
        .toBe(ErrorCategory.AUTHENTICATION);
    });

    it('should categorize network errors', () => {
      expect(getErrorCategory(ErrorType.NETWORK_CONNECTION_FAILED))
        .toBe(ErrorCategory.NETWORK);
      expect(getErrorCategory(ErrorType.NETWORK_TIMEOUT))
        .toBe(ErrorCategory.NETWORK);
    });

    it('should categorize cryptographic errors', () => {
      expect(getErrorCategory(ErrorType.CRYPTO_ENCRYPTION_FAILED))
        .toBe(ErrorCategory.CRYPTOGRAPHIC);
      expect(getErrorCategory(ErrorType.CRYPTO_KEY_DERIVATION_FAILED))
        .toBe(ErrorCategory.CRYPTOGRAPHIC);
    });

    it('should categorize validation errors', () => {
      expect(getErrorCategory(ErrorType.VALIDATION_INPUT_INVALID))
        .toBe(ErrorCategory.VALIDATION);
      expect(getErrorCategory(ErrorType.VALIDATION_FORMAT_INVALID))
        .toBe(ErrorCategory.VALIDATION);
    });

    it('should categorize system errors', () => {
      expect(getErrorCategory(ErrorType.SYSTEM_MEMORY_ERROR))
        .toBe(ErrorCategory.SYSTEM);
      expect(getErrorCategory(ErrorType.SYSTEM_PERMISSION_DENIED))
        .toBe(ErrorCategory.SYSTEM);
    });

    it('should categorize session errors', () => {
      expect(getErrorCategory(ErrorType.SESSION_NOT_FOUND))
        .toBe(ErrorCategory.SESSION);
      expect(getErrorCategory(ErrorType.SESSION_EXPIRED))
        .toBe(ErrorCategory.SESSION);
    });

    it('should categorize voice processing errors', () => {
      expect(getErrorCategory(ErrorType.VOICE_TRANSCRIPTION_FAILED))
        .toBe(ErrorCategory.VOICE_PROCESSING);
      expect(getErrorCategory(ErrorType.VOICE_PHRASE_DETECTION_FAILED))
        .toBe(ErrorCategory.VOICE_PROCESSING);
    });
  });

  describe('isRetryableError', () => {
    it('should identify retryable errors', () => {
      expect(isRetryableError(ErrorType.NETWORK_CONNECTION_FAILED)).toBe(true);
      expect(isRetryableError(ErrorType.NETWORK_TIMEOUT)).toBe(true);
      expect(isRetryableError(ErrorType.SYSTEM_MEMORY_ERROR)).toBe(true);
      expect(isRetryableError(ErrorType.VOICE_TRANSCRIPTION_FAILED)).toBe(true);
    });

    it('should identify non-retryable errors', () => {
      expect(isRetryableError(ErrorType.AUTH_INVALID_CREDENTIALS)).toBe(false);
      expect(isRetryableError(ErrorType.VALIDATION_INPUT_INVALID)).toBe(false);
      expect(isRetryableError(ErrorType.CRYPTO_INVALID_KEY_FORMAT)).toBe(false);
    });
  });

  describe('calculateRetryDelay', () => {
    it('should calculate exponential backoff delay', () => {
      expect(calculateRetryDelay(0)).toBe(1000); // Base delay
      expect(calculateRetryDelay(1)).toBe(2000); // 2^1 * 1000
      expect(calculateRetryDelay(2)).toBe(4000); // 2^2 * 1000
      expect(calculateRetryDelay(3)).toBe(8000); // 2^3 * 1000
    });

    it('should respect maximum delay', () => {
      expect(calculateRetryDelay(10)).toBeLessThanOrEqual(30000); // Max delay
    });

    it('should use custom base delay', () => {
      expect(calculateRetryDelay(0, 500)).toBe(500);
      expect(calculateRetryDelay(1, 500)).toBe(1000);
    });
  });

  describe('createErrorInfo', () => {
    it('should create complete error info', () => {
      const errorInfo = createErrorInfo(ErrorType.NETWORK_CONNECTION_FAILED, mockContext);
      
      expect(errorInfo.id).toBeDefined();
      expect(errorInfo.type).toBe(ErrorType.NETWORK_CONNECTION_FAILED);
      expect(errorInfo.category).toBe(ErrorCategory.NETWORK);
      expect(errorInfo.severity).toBe(ErrorSeverity.MEDIUM);
      expect(errorInfo.timestamp).toBeInstanceOf(Date);
      expect(errorInfo.message).toBeDefined();
      expect(errorInfo.context).toBeDefined();
      expect(errorInfo.recovery).toBeDefined();
      expect(errorInfo.helpUrl).toBeDefined();
      expect(errorInfo.supportCode).toBeDefined();
    });

    it('should include context information', () => {
      const errorInfo = createErrorInfo(ErrorType.SYSTEM_MEMORY_ERROR, mockContext);
      
      expect(errorInfo.context?.component).toBe('TestComponent');
      expect(errorInfo.context?.operation).toBe('test_operation');
    });
  });

  describe('createInternalError', () => {
    it('should create internal error with debugging info', () => {
      const originalError = new Error('Test error');
      const internalError = createInternalError(
        ErrorType.SYSTEM_UNEXPECTED_STATE,
        'Internal test error',
        mockContext,
        originalError,
        { testData: 'value' }
      );
      
      expect(internalError.internalMessage).toBe('Internal test error');
      expect(internalError.stackTrace).toBe(originalError.stack);
      expect(internalError.component).toBe('TestComponent');
      expect(internalError.operation).toBe('test_operation');
      expect(internalError.metadata).toEqual({ testData: 'value' });
    });
  });

  describe('sanitizeErrorForUser', () => {
    it('should remove sensitive information from internal error', () => {
      const originalError = new Error('Test error');
      const internalError = createInternalError(
        ErrorType.SYSTEM_UNEXPECTED_STATE,
        'Internal error with sensitive data',
        mockContext,
        originalError,
        { password: 'secret123', publicData: 'safe' }
      );
      
      const sanitized = sanitizeErrorForUser(internalError);
      
      expect(sanitized).not.toHaveProperty('internalMessage');
      expect(sanitized).not.toHaveProperty('stackTrace');
      expect(sanitized).not.toHaveProperty('metadata');
      expect(sanitized.message).toBeDefined();
      expect(sanitized.id).toBeDefined();
    });
  });

  describe('containsSensitiveInfo', () => {
    it('should detect sensitive information in error messages', () => {
      const sensitiveError = new Error('Failed to decrypt with key abc123');
      const normalError = new Error('Connection timeout');
      
      expect(containsSensitiveInfo(sensitiveError)).toBe(true);
      expect(containsSensitiveInfo(normalError)).toBe(false);
    });

    it('should detect sensitive information in stack traces', () => {
      const error = new Error('Normal message');
      error.stack = 'Error at encryptPassword() with secret key';
      
      expect(containsSensitiveInfo(error)).toBe(true);
    });
  });

  describe('withErrorHandling', () => {
    it('should wrap function and handle errors', () => {
      const mockFn = jest.fn(() => {
        throw new Error('Test error');
      });
      
      const wrappedFn = withErrorHandling(mockFn, mockContext);
      
      expect(() => wrappedFn()).toThrow();
      expect(mockFn).toHaveBeenCalled();
    });

    it('should return result when no error occurs', () => {
      const mockFn = jest.fn(() => 'success');
      const wrappedFn = withErrorHandling(mockFn, mockContext);
      
      const result = wrappedFn();
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalled();
    });
  });

  describe('withAsyncErrorHandling', () => {
    it('should handle async operation errors', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Async error'));
      
      await expect(
        withAsyncErrorHandling(() => mockOperation(), mockContext)
      ).rejects.toThrow();
      
      expect(mockOperation).toHaveBeenCalled();
    });

    it('should return result when async operation succeeds', async () => {
      const mockOperation = jest.fn().mockResolvedValue('async success');
      
      const result = await withAsyncErrorHandling(() => mockOperation(), mockContext);
      
      expect(result).toBe('async success');
      expect(mockOperation).toHaveBeenCalled();
    });
  });
}); 