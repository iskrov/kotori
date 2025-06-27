/**
 * Structured error logging service for the OPAQUE security system
 * Provides comprehensive error tracking, audit trails, and security event logging
 */

import { 
  InternalError, 
  SecurityEvent, 
  ErrorMetrics, 
  ErrorHandlerConfig,
  ErrorSeverity,
  ErrorCategory
} from '../types/errorTypes';

// Default configuration for error logging
const DEFAULT_CONFIG: ErrorHandlerConfig = {
  enableLogging: true,
  logLevel: 'error',
  enableRetry: true,
  defaultRetryCount: 3,
  enableUserFeedback: true,
  enableSecurityLogging: true
};

// Log levels in order of priority
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

/**
 * Structured error logging service
 */
export class ErrorLogger {
  private config: ErrorHandlerConfig;
  private metrics: ErrorMetrics;
  private logBuffer: Array<{ timestamp: Date; level: string; data: any }>;
  private securityEvents: SecurityEvent[];
  private maxBufferSize: number = 1000;
  private maxSecurityEvents: number = 500;

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.metrics = this.initializeMetrics();
    this.logBuffer = [];
    this.securityEvents = [];
  }

  /**
   * Initialize error metrics
   */
  private initializeMetrics(): ErrorMetrics {
    return {
      errorCount: 0,
      errorRate: 0,
      recoverySuccessRate: 0,
      averageRecoveryTime: 0,
      criticalErrorCount: 0,
      securityEventCount: 0
    };
  }

  /**
   * Log an internal error with full debugging information
   */
  public logError(error: InternalError): void {
    if (!this.config.enableLogging) return;

    // Update metrics
    this.updateErrorMetrics(error);

    // Create log entry
    const logEntry = {
      timestamp: new Date(),
      level: 'error',
      data: {
        id: error.id,
        type: error.type,
        category: error.category,
        severity: error.severity,
        message: error.message,
        internalMessage: error.internalMessage,
        component: error.component,
        operation: error.operation,
        context: error.context,
        stackTrace: this.shouldLogStackTrace() ? error.stackTrace : undefined,
        metadata: this.sanitizeMetadata(error.metadata)
      }
    };

    this.addToBuffer(logEntry);

    // Log to console in development
    if (this.isDevelopment()) {
      console.error('ErrorLogger:', logEntry);
    }

    // Send to external logging service in production
    if (this.isProduction()) {
      this.sendToExternalLogger(logEntry);
    }
  }

  /**
   * Log a security event for audit purposes
   */
  public logSecurityEvent(event: SecurityEvent): void {
    if (!this.config.enableSecurityLogging) return;

    // Update security metrics
    this.metrics.securityEventCount++;

    // Add to security events buffer
    this.securityEvents.push(event);
    
    // Maintain buffer size
    if (this.securityEvents.length > this.maxSecurityEvents) {
      this.securityEvents.shift();
    }

    // Create audit log entry
    const auditEntry = {
      timestamp: new Date(),
      level: 'warn',
      data: {
        type: 'security_event',
        id: event.id,
        errorType: event.type,
        action: event.action,
        outcome: event.outcome,
        riskLevel: event.riskLevel,
        userId: event.userId,
        deviceId: event.deviceId,
        timestamp: event.timestamp,
        context: event.context
      }
    };

    this.addToBuffer(auditEntry);

    // Always log security events to console
    console.warn('Security Event:', auditEntry);

    // Send to security monitoring service
    this.sendToSecurityMonitoring(event);
  }

  /**
   * Log error recovery attempt
   */
  public logRecoveryAttempt(
    errorId: string, 
    attempt: number, 
    success: boolean, 
    recoveryTime: number
  ): void {
    const logEntry = {
      timestamp: new Date(),
      level: 'info',
      data: {
        type: 'recovery_attempt',
        errorId,
        attempt,
        success,
        recoveryTime
      }
    };

    this.addToBuffer(logEntry);

    // Update recovery metrics
    if (success) {
      this.updateRecoveryMetrics(recoveryTime);
    }
  }

  /**
   * Log performance metrics
   */
  public logPerformanceMetric(
    operation: string,
    duration: number,
    success: boolean,
    context?: Record<string, any>
  ): void {
    if (!this.shouldLog('info')) return;

    const logEntry = {
      timestamp: new Date(),
      level: 'info',
      data: {
        type: 'performance_metric',
        operation,
        duration,
        success,
        context: this.sanitizeContext(context)
      }
    };

    this.addToBuffer(logEntry);
  }

  /**
   * Get current error metrics
   */
  public getMetrics(): ErrorMetrics {
    return { ...this.metrics };
  }

  /**
   * Get recent security events
   */
  public getSecurityEvents(limit: number = 50): SecurityEvent[] {
    return this.securityEvents.slice(-limit);
  }

  /**
   * Get recent log entries
   */
  public getRecentLogs(limit: number = 100): Array<{ timestamp: Date; level: string; data: any }> {
    return this.logBuffer.slice(-limit);
  }

  /**
   * Clear all logs and metrics
   */
  public clearLogs(): void {
    this.logBuffer = [];
    this.securityEvents = [];
    this.metrics = this.initializeMetrics();
  }

  /**
   * Export logs for debugging or support
   */
  public exportLogs(): string {
    const exportData = {
      timestamp: new Date().toISOString(),
      metrics: this.metrics,
      logs: this.logBuffer.slice(-500), // Last 500 entries
      securityEvents: this.securityEvents.slice(-100) // Last 100 security events
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Private helper methods

  private updateErrorMetrics(error: InternalError): void {
    this.metrics.errorCount++;
    
    if (error.severity === ErrorSeverity.CRITICAL) {
      this.metrics.criticalErrorCount++;
    }

    // Calculate error rate (errors per minute)
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentErrors = this.logBuffer.filter(
      entry => entry.timestamp.getTime() > oneMinuteAgo && entry.level === 'error'
    ).length;
    this.metrics.errorRate = recentErrors;
  }

  private updateRecoveryMetrics(recoveryTime: number): void {
    // Simple moving average for recovery time
    const currentAverage = this.metrics.averageRecoveryTime;
    const newAverage = currentAverage === 0 
      ? recoveryTime 
      : (currentAverage + recoveryTime) / 2;
    
    this.metrics.averageRecoveryTime = newAverage;

    // Calculate recovery success rate
    const recentRecoveries = this.logBuffer.filter(
      entry => entry.data?.type === 'recovery_attempt'
    );
    
    if (recentRecoveries.length > 0) {
      const successfulRecoveries = recentRecoveries.filter(
        entry => entry.data?.success === true
      ).length;
      
      this.metrics.recoverySuccessRate = 
        (successfulRecoveries / recentRecoveries.length) * 100;
    }
  }

  private addToBuffer(entry: { timestamp: Date; level: string; data: any }): void {
    this.logBuffer.push(entry);
    
    // Maintain buffer size
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }
  }

  private shouldLog(level: string): boolean {
    if (!this.config.enableLogging) return false;
    
    const configLevel = LOG_LEVELS[this.config.logLevel as keyof typeof LOG_LEVELS];
    const messageLevel = LOG_LEVELS[level as keyof typeof LOG_LEVELS];
    
    return messageLevel >= configLevel;
  }

  private shouldLogStackTrace(): boolean {
    return this.isDevelopment() || this.config.logLevel === 'debug';
  }

  private sanitizeMetadata(metadata?: Record<string, any>): Record<string, any> | undefined {
    if (!metadata) return undefined;

    const sanitized: Record<string, any> = {};
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'credential'];

    for (const [key, value] of Object.entries(metadata)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveKeys.some(sensitive => lowerKey.includes(sensitive));
      
      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private sanitizeContext(context?: Record<string, any>): Record<string, any> | undefined {
    return this.sanitizeMetadata(context);
  }

  private isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  private isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  private async sendToExternalLogger(logEntry: any): Promise<void> {
    try {
      // This would integrate with external logging services like:
      // - Sentry
      // - LogRocket
      // - DataDog
      // - Custom logging endpoint
      
      // Example implementation:
      // await fetch('/api/logs', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(logEntry)
      // });
      
      console.log('Would send to external logger:', logEntry);
    } catch (error) {
      console.error('Failed to send log to external service:', error);
    }
  }

  private async sendToSecurityMonitoring(event: SecurityEvent): Promise<void> {
    try {
      // This would integrate with security monitoring services like:
      // - SIEM systems
      // - Security analytics platforms
      // - Custom security endpoints
      
      // Example implementation:
      // await fetch('/api/security-events', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(event)
      // });
      
      console.log('Would send to security monitoring:', event);
    } catch (error) {
      console.error('Failed to send security event:', error);
    }
  }
}

// Singleton instance for global use
export const errorLogger = new ErrorLogger();

/**
 * Convenience functions for common logging operations
 */
export function logError(error: InternalError): void {
  errorLogger.logError(error);
}

export function logSecurityEvent(event: SecurityEvent): void {
  errorLogger.logSecurityEvent(event);
}

export function logRecovery(
  errorId: string, 
  attempt: number, 
  success: boolean, 
  recoveryTime: number
): void {
  errorLogger.logRecoveryAttempt(errorId, attempt, success, recoveryTime);
}

export function logPerformance(
  operation: string,
  duration: number,
  success: boolean,
  context?: Record<string, any>
): void {
  errorLogger.logPerformanceMetric(operation, duration, success, context);
}

export function getErrorMetrics(): ErrorMetrics {
  return errorLogger.getMetrics();
}

export function exportErrorLogs(): string {
  return errorLogger.exportLogs();
} 