/**
 * Tests for ErrorLogger service
 */

import { ErrorLogger, logError, logSecurityEvent } from '../ErrorLogger';
import {
  ErrorType,
  ErrorSeverity,
  ErrorCategory,
  InternalError,
  SecurityEvent,
  ErrorContext
} from '../../types/errorTypes';

// Mock console methods
const mockConsoleError = jest.fn();
const mockConsoleWarn = jest.fn();
const mockConsoleLog = jest.fn();

jest.mock('console', () => ({
  error: mockConsoleError,
  warn: mockConsoleWarn,
  log: mockConsoleLog
}));

describe('ErrorLogger', () => {
  let errorLogger: ErrorLogger;
  const mockContext: ErrorContext = {
    component: 'TestComponent',
    operation: 'test_operation',
    timestamp: new Date(),
    platform: 'test'
  };

  beforeEach(() => {
    errorLogger = new ErrorLogger();
    jest.clearAllMocks();
  });

  describe('Error Logging', () => {
    it('should log internal errors', () => {
      const internalError: InternalError = {
        id: 'test-error-1',
        type: ErrorType.SYSTEM_MEMORY_ERROR,
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.CRITICAL,
        timestamp: new Date(),
        message: 'System memory error occurred',
        internalMessage: 'Detailed internal error message',
        component: 'TestComponent',
        operation: 'memory_allocation',
        stackTrace: 'Error stack trace',
        metadata: { memoryUsage: '95%' }
      };

      errorLogger.logError(internalError);

      const metrics = errorLogger.getMetrics();
      expect(metrics.errorCount).toBe(1);
      expect(metrics.criticalErrorCount).toBe(1);
    });

    it('should sanitize sensitive metadata', () => {
      const internalError: InternalError = {
        id: 'test-error-2',
        type: ErrorType.CRYPTO_ENCRYPTION_FAILED,
        category: ErrorCategory.CRYPTOGRAPHIC,
        severity: ErrorSeverity.CRITICAL,
        timestamp: new Date(),
        message: 'Encryption failed',
        internalMessage: 'Detailed crypto error',
        component: 'CryptoComponent',
        operation: 'encrypt',
        metadata: {
          password: 'secret123',
          key: 'encryption_key',
          publicData: 'safe_value'
        }
      };

      errorLogger.logError(internalError);

      const logs = errorLogger.getRecentLogs(1);
      expect(logs[0].data.metadata.password).toBe('[REDACTED]');
      expect(logs[0].data.metadata.key).toBe('[REDACTED]');
      expect(logs[0].data.metadata.publicData).toBe('safe_value');
    });

    it('should not log when logging is disabled', () => {
      const disabledLogger = new ErrorLogger({ enableLogging: false });
      
      const internalError: InternalError = {
        id: 'test-error-3',
        type: ErrorType.NETWORK_CONNECTION_FAILED,
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.MEDIUM,
        timestamp: new Date(),
        message: 'Network error',
        internalMessage: 'Network connection failed',
        component: 'NetworkComponent',
        operation: 'connect'
      };

      disabledLogger.logError(internalError);

      const metrics = disabledLogger.getMetrics();
      expect(metrics.errorCount).toBe(0);
    });
  });

  describe('Security Event Logging', () => {
    it('should log security events', () => {
      const securityEvent: SecurityEvent = {
        id: 'security-event-1',
        type: ErrorType.AUTH_RATE_LIMITED,
        category: ErrorCategory.AUTHENTICATION,
        severity: ErrorSeverity.HIGH,
        timestamp: new Date(),
        message: 'Rate limit exceeded',
        userId: 'user123',
        deviceId: 'device456',
        action: 'login_attempt',
        outcome: 'blocked',
        riskLevel: 'high'
      };

      errorLogger.logSecurityEvent(securityEvent);

      const metrics = errorLogger.getMetrics();
      expect(metrics.securityEventCount).toBe(1);

      const events = errorLogger.getSecurityEvents(1);
      expect(events).toHaveLength(1);
      expect(events[0].action).toBe('login_attempt');
      expect(events[0].outcome).toBe('blocked');
    });

    it('should not log security events when disabled', () => {
      const disabledLogger = new ErrorLogger({ enableSecurityLogging: false });
      
      const securityEvent: SecurityEvent = {
        id: 'security-event-2',
        type: ErrorType.AUTH_INVALID_CREDENTIALS,
        category: ErrorCategory.AUTHENTICATION,
        severity: ErrorSeverity.LOW,
        timestamp: new Date(),
        message: 'Invalid credentials',
        action: 'login_attempt',
        outcome: 'failure',
        riskLevel: 'low'
      };

      disabledLogger.logSecurityEvent(securityEvent);

      const metrics = disabledLogger.getMetrics();
      expect(metrics.securityEventCount).toBe(0);
    });
  });

  describe('Recovery Logging', () => {
    it('should log recovery attempts', () => {
      errorLogger.logRecoveryAttempt('error-123', 1, true, 1500);

      const logs = errorLogger.getRecentLogs(1);
      expect(logs[0].data.type).toBe('recovery_attempt');
      expect(logs[0].data.errorId).toBe('error-123');
      expect(logs[0].data.attempt).toBe(1);
      expect(logs[0].data.success).toBe(true);
      expect(logs[0].data.recoveryTime).toBe(1500);
    });

    it('should update recovery metrics on successful recovery', () => {
      errorLogger.logRecoveryAttempt('error-124', 1, true, 2000);
      errorLogger.logRecoveryAttempt('error-125', 1, false, 1000);

      const metrics = errorLogger.getMetrics();
      expect(metrics.averageRecoveryTime).toBeGreaterThan(0);
      expect(metrics.recoverySuccessRate).toBe(50); // 1 success out of 2 attempts
    });
  });

  describe('Performance Logging', () => {
    it('should log performance metrics', () => {
      errorLogger.logPerformanceMetric('encryption', 150, true, { algorithm: 'AES' });

      const logs = errorLogger.getRecentLogs(1);
      expect(logs[0].data.type).toBe('performance_metric');
      expect(logs[0].data.operation).toBe('encryption');
      expect(logs[0].data.duration).toBe(150);
      expect(logs[0].data.success).toBe(true);
    });

    it('should sanitize performance context', () => {
      errorLogger.logPerformanceMetric(
        'authentication', 
        300, 
        true, 
        { password: 'secret', algorithm: 'OPAQUE' }
      );

      const logs = errorLogger.getRecentLogs(1);
      expect(logs[0].data.context.password).toBe('[REDACTED]');
      expect(logs[0].data.context.algorithm).toBe('OPAQUE');
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should track error metrics correctly', () => {
      // Log multiple errors of different severities
      const errors = [
        { severity: ErrorSeverity.CRITICAL },
        { severity: ErrorSeverity.HIGH },
        { severity: ErrorSeverity.CRITICAL },
        { severity: ErrorSeverity.LOW }
      ];

      errors.forEach((errorData, index) => {
        const internalError: InternalError = {
          id: `error-${index}`,
          type: ErrorType.SYSTEM_MEMORY_ERROR,
          category: ErrorCategory.SYSTEM,
          severity: errorData.severity,
          timestamp: new Date(),
          message: 'Test error',
          internalMessage: 'Internal test error',
          component: 'TestComponent',
          operation: 'test'
        };
        errorLogger.logError(internalError);
      });

      const metrics = errorLogger.getMetrics();
      expect(metrics.errorCount).toBe(4);
      expect(metrics.criticalErrorCount).toBe(2);
    });

    it('should calculate error rate correctly', () => {
      // Log errors and check rate calculation
      const internalError: InternalError = {
        id: 'rate-test-error',
        type: ErrorType.NETWORK_TIMEOUT,
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.LOW,
        timestamp: new Date(),
        message: 'Timeout error',
        internalMessage: 'Network timeout occurred',
        component: 'NetworkComponent',
        operation: 'request'
      };

      errorLogger.logError(internalError);

      const metrics = errorLogger.getMetrics();
      expect(metrics.errorRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Data Management', () => {
    it('should maintain buffer size limits', () => {
      // Create logger with small buffer for testing
      const smallBufferLogger = new ErrorLogger();
      
      // Log more entries than buffer size
      for (let i = 0; i < 1200; i++) {
        const internalError: InternalError = {
          id: `buffer-test-${i}`,
          type: ErrorType.VALIDATION_INPUT_INVALID,
          category: ErrorCategory.VALIDATION,
          severity: ErrorSeverity.LOW,
          timestamp: new Date(),
          message: `Test error ${i}`,
          internalMessage: `Internal error ${i}`,
          component: 'TestComponent',
          operation: 'validation'
        };
        smallBufferLogger.logError(internalError);
      }

      const logs = smallBufferLogger.getRecentLogs();
      expect(logs.length).toBeLessThanOrEqual(1000); // Buffer size limit
    });

    it('should export logs correctly', () => {
      const internalError: InternalError = {
        id: 'export-test',
        type: ErrorType.SYSTEM_CONFIGURATION_ERROR,
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.HIGH,
        timestamp: new Date(),
        message: 'Config error',
        internalMessage: 'Configuration error occurred',
        component: 'ConfigComponent',
        operation: 'load_config'
      };

      errorLogger.logError(internalError);

      const exportedData = errorLogger.exportLogs();
      const parsedData = JSON.parse(exportedData);
      
      expect(parsedData).toHaveProperty('timestamp');
      expect(parsedData).toHaveProperty('metrics');
      expect(parsedData).toHaveProperty('logs');
      expect(parsedData).toHaveProperty('securityEvents');
      expect(parsedData.logs.length).toBeGreaterThan(0);
    });

    it('should clear logs and metrics', () => {
      const internalError: InternalError = {
        id: 'clear-test',
        type: ErrorType.VOICE_TRANSCRIPTION_FAILED,
        category: ErrorCategory.VOICE_PROCESSING,
        severity: ErrorSeverity.MEDIUM,
        timestamp: new Date(),
        message: 'Transcription failed',
        internalMessage: 'Voice transcription error',
        component: 'VoiceComponent',
        operation: 'transcribe'
      };

      errorLogger.logError(internalError);
      
      let metrics = errorLogger.getMetrics();
      expect(metrics.errorCount).toBe(1);

      errorLogger.clearLogs();
      
      metrics = errorLogger.getMetrics();
      expect(metrics.errorCount).toBe(0);
      expect(errorLogger.getRecentLogs()).toHaveLength(0);
    });
  });

  describe('Configuration', () => {
    it('should update configuration', () => {
      errorLogger.updateConfig({
        enableLogging: false,
        logLevel: 'debug'
      });

      // Verify configuration change affects behavior
      const internalError: InternalError = {
        id: 'config-test',
        type: ErrorType.SYSTEM_MEMORY_ERROR,
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.CRITICAL,
        timestamp: new Date(),
        message: 'Memory error',
        internalMessage: 'Memory allocation failed',
        component: 'TestComponent',
        operation: 'allocate'
      };

      errorLogger.logError(internalError);

      const metrics = errorLogger.getMetrics();
      expect(metrics.errorCount).toBe(0); // Should not log when disabled
    });
  });

  describe('Global Functions', () => {
    it('should use global logError function', () => {
      const internalError: InternalError = {
        id: 'global-test',
        type: ErrorType.AUTH_SESSION_EXPIRED,
        category: ErrorCategory.AUTHENTICATION,
        severity: ErrorSeverity.MEDIUM,
        timestamp: new Date(),
        message: 'Session expired',
        internalMessage: 'User session has expired',
        component: 'AuthComponent',
        operation: 'validate_session'
      };

      logError(internalError);

      // The global function should use the singleton instance
      // We can't directly test the singleton, but we can verify it doesn't throw
      expect(() => logError(internalError)).not.toThrow();
    });

    it('should use global logSecurityEvent function', () => {
      const securityEvent: SecurityEvent = {
        id: 'global-security-test',
        type: ErrorType.AUTH_RATE_LIMITED,
        category: ErrorCategory.AUTHENTICATION,
        severity: ErrorSeverity.HIGH,
        timestamp: new Date(),
        message: 'Rate limit exceeded',
        action: 'login_attempt',
        outcome: 'blocked',
        riskLevel: 'high'
      };

      expect(() => logSecurityEvent(securityEvent)).not.toThrow();
    });
  });
}); 