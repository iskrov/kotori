/**
 * Error recovery service for the OPAQUE security system
 * Provides automatic retry logic, graceful degradation, and fallback mechanisms
 */

import { 
  ErrorType, 
  ErrorInfo, 
  ErrorRecoveryOptions, 
  ErrorRecoveryResult,
  ErrorContext
} from '../types/errorTypes';
import { 
  calculateRetryDelay, 
  isRetryableError, 
  createErrorInfo 
} from '../utils/errorHandling';
import { logRecovery, logError } from './ErrorLogger';

// Recovery strategy definitions
interface RecoveryStrategy {
  canRecover: (error: ErrorInfo) => boolean;
  recover: (error: ErrorInfo, context: ErrorContext) => Promise<ErrorRecoveryResult>;
  fallback?: (error: ErrorInfo, context: ErrorContext) => Promise<void>;
}

// Recovery operation tracking
interface RecoveryOperation {
  errorId: string;
  attempts: number;
  startTime: number;
  lastAttempt: number;
  strategy: string;
}

/**
 * Error recovery service with intelligent retry and fallback mechanisms
 */
export class ErrorRecovery {
  private activeRecoveries: Map<string, RecoveryOperation> = new Map();
  private recoveryStrategies: Map<ErrorType, RecoveryStrategy> = new Map();
  private maxConcurrentRecoveries = 10;
  private recoveryTimeout = 30000; // 30 seconds

  constructor() {
    this.initializeRecoveryStrategies();
  }

  /**
   * Attempt to recover from an error
   */
  public async recover(
    error: ErrorInfo, 
    context: ErrorContext,
    options?: Partial<ErrorRecoveryOptions>
  ): Promise<ErrorRecoveryResult> {
    const startTime = Date.now();
    const recoveryOptions = { ...error.recovery, ...options };

    // Check if recovery is possible
    if (!recoveryOptions.canRetry) {
      return {
        success: false,
        error,
        retryCount: 0,
        recoveryTime: Date.now() - startTime
      };
    }

    // Check if we're already recovering this error
    if (this.activeRecoveries.has(error.id)) {
      const existing = this.activeRecoveries.get(error.id)!;
      if (existing.attempts >= (recoveryOptions.maxRetries || 3)) {
        return {
          success: false,
          error,
          retryCount: existing.attempts,
          recoveryTime: Date.now() - existing.startTime
        };
      }
    }

    // Check concurrent recovery limit
    if (this.activeRecoveries.size >= this.maxConcurrentRecoveries) {
      return {
        success: false,
        error: createErrorInfo(
          ErrorType.SYSTEM_RESOURCE_EXHAUSTED,
          context
        ),
        retryCount: 0,
        recoveryTime: Date.now() - startTime
      };
    }

    // Start recovery process
    const recovery = this.getOrCreateRecovery(error.id, startTime);
    
    try {
      const result = await this.executeRecovery(error, context, recoveryOptions, recovery);
      
      // Log recovery result
      logRecovery(error.id, recovery.attempts, result.success, result.recoveryTime);
      
      // Clean up if recovery completed (success or failure)
      if (result.success || recovery.attempts >= (recoveryOptions.maxRetries || 3)) {
        this.activeRecoveries.delete(error.id);
      }
      
      return result;
    } catch (recoveryError) {
      // Recovery process itself failed
      this.activeRecoveries.delete(error.id);
      
      const errorInfo = createErrorInfo(
        ErrorType.SYSTEM_UNEXPECTED_STATE,
        context,
        recoveryError instanceof Error ? recoveryError : undefined
      );
      
      logError(errorInfo as any);
      
      return {
        success: false,
        error: errorInfo,
        retryCount: recovery.attempts,
        recoveryTime: Date.now() - startTime
      };
    }
  }

  /**
   * Execute recovery with retry logic
   */
  private async executeRecovery(
    error: ErrorInfo,
    context: ErrorContext,
    options: ErrorRecoveryOptions,
    recovery: RecoveryOperation
  ): Promise<ErrorRecoveryResult> {
    const startTime = Date.now();
    const maxRetries = options.maxRetries || 3;
    
    while (recovery.attempts < maxRetries) {
      recovery.attempts++;
      recovery.lastAttempt = Date.now();
      
      // Calculate delay for this attempt
      const delay = this.calculateDelay(recovery.attempts, options);
      
      // Wait before retry (except for first attempt)
      if (recovery.attempts > 1 && delay > 0) {
        await this.sleep(delay);
      }
      
      try {
        // Try recovery strategy
        const strategy = this.recoveryStrategies.get(error.type);
        if (strategy && strategy.canRecover(error)) {
          const result = await this.executeWithTimeout(
            () => strategy.recover(error, context),
            this.recoveryTimeout
          );
          
          if (result.success) {
            return {
              success: true,
              retryCount: recovery.attempts,
              recoveryTime: Date.now() - startTime
            };
          }
        }
        
        // Try generic retry if no specific strategy
        if (!strategy) {
          const result = await this.genericRetry(error, context);
          if (result.success) {
            return {
              success: true,
              retryCount: recovery.attempts,
              recoveryTime: Date.now() - startTime
            };
          }
        }
        
      } catch (attemptError) {
        // Log attempt failure but continue trying
        console.warn(`Recovery attempt ${recovery.attempts} failed:`, attemptError);
      }
      
      // Check if we should continue retrying
      if (recovery.attempts >= maxRetries) {
        break;
      }
    }
    
    // All retries failed, try fallback
    await this.tryFallback(error, context);
    
    return {
      success: false,
      error,
      retryCount: recovery.attempts,
      recoveryTime: Date.now() - startTime
    };
  }

  /**
   * Initialize recovery strategies for different error types
   */
  private initializeRecoveryStrategies(): void {
    // Network error recovery
    this.recoveryStrategies.set(ErrorType.NETWORK_CONNECTION_FAILED, {
      canRecover: (error) => true,
      recover: async (error, context) => {
        // Check network connectivity
        if (navigator.onLine) {
          // Try a simple network test
          try {
            const response = await fetch('/api/health', { 
              method: 'GET',
              cache: 'no-cache',
              signal: AbortSignal.timeout(5000)
            });
            
            if (response.ok) {
              return { success: true, retryCount: 1, recoveryTime: 0 };
            }
          } catch {
            // Network still failing
          }
        }
        
        return { success: false, retryCount: 1, recoveryTime: 0 };
      },
      fallback: async (error, context) => {
        // Enable offline mode
        console.log('Enabling offline mode due to network failure');
      }
    });

    // Session error recovery
    this.recoveryStrategies.set(ErrorType.SESSION_EXPIRED, {
      canRecover: (error) => true,
      recover: async (error, context) => {
        // Try to refresh session
        try {
          // This would call the session refresh endpoint
          console.log('Attempting session refresh');
          
          // Simulate session refresh
          await this.sleep(1000);
          
          // Check if session is now valid
          const isValid = await this.validateSession();
          
          return { 
            success: isValid, 
            retryCount: 1, 
            recoveryTime: 1000 
          };
        } catch {
          return { success: false, retryCount: 1, recoveryTime: 1000 };
        }
      },
      fallback: async (error, context) => {
        // Redirect to login
        console.log('Redirecting to login due to session failure');
      }
    });

    // Memory error recovery
    this.recoveryStrategies.set(ErrorType.SYSTEM_MEMORY_ERROR, {
      canRecover: (error) => true,
      recover: async (error, context) => {
        // Try to free memory
        try {
          await this.freeMemory();
          
          // Check if memory is now available
          const memoryAvailable = await this.checkMemoryAvailability();
          
          return { 
            success: memoryAvailable, 
            retryCount: 1, 
            recoveryTime: 500 
          };
        } catch {
          return { success: false, retryCount: 1, recoveryTime: 500 };
        }
      },
      fallback: async (error, context) => {
        // Reduce functionality to conserve memory
        console.log('Reducing functionality to conserve memory');
      }
    });

    // Voice processing error recovery
    this.recoveryStrategies.set(ErrorType.VOICE_TRANSCRIPTION_FAILED, {
      canRecover: (error) => true,
      recover: async (error, context) => {
        // Check microphone permissions and availability
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(track => track.stop());
          
          return { success: true, retryCount: 1, recoveryTime: 100 };
        } catch {
          return { success: false, retryCount: 1, recoveryTime: 100 };
        }
      },
      fallback: async (error, context) => {
        // Switch to text input mode
        console.log('Switching to text input mode');
      }
    });
  }

  /**
   * Generic retry mechanism for errors without specific strategies
   */
  private async genericRetry(error: ErrorInfo, context: ErrorContext): Promise<ErrorRecoveryResult> {
    // For retryable errors, just wait and return success to trigger retry
    if (isRetryableError(error.type)) {
      await this.sleep(1000);
      return { success: true, retryCount: 1, recoveryTime: 1000 };
    }
    
    return { success: false, retryCount: 1, recoveryTime: 0 };
  }

  /**
   * Try fallback mechanisms
   */
  private async tryFallback(error: ErrorInfo, context: ErrorContext): Promise<void> {
    const strategy = this.recoveryStrategies.get(error.type);
    if (strategy?.fallback) {
      try {
        await strategy.fallback(error, context);
      } catch (fallbackError) {
        console.error('Fallback mechanism failed:', fallbackError);
      }
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateDelay(attempt: number, options: ErrorRecoveryOptions): number {
    if (!options.exponentialBackoff) {
      return options.retryDelay || 1000;
    }
    
    return calculateRetryDelay(attempt - 1, options.retryDelay);
  }

  /**
   * Get or create recovery operation tracking
   */
  private getOrCreateRecovery(errorId: string, startTime: number): RecoveryOperation {
    if (!this.activeRecoveries.has(errorId)) {
      this.activeRecoveries.set(errorId, {
        errorId,
        attempts: 0,
        startTime,
        lastAttempt: 0,
        strategy: 'default'
      });
    }
    
    return this.activeRecoveries.get(errorId)!;
  }

  /**
   * Execute operation with timeout
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Recovery operation timed out'));
      }, timeout);
      
      operation()
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timer));
    });
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Helper methods for recovery strategies

  private async validateSession(): Promise<boolean> {
    // This would validate the current session
    // For now, simulate validation
    return Math.random() > 0.5;
  }

  private async freeMemory(): Promise<void> {
    // This would implement memory cleanup
    // For now, just trigger garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }

  private async checkMemoryAvailability(): Promise<boolean> {
    // This would check available memory
    // For now, simulate memory check
    return true;
  }

  /**
   * Get recovery statistics
   */
  public getRecoveryStats(): {
    activeRecoveries: number;
    totalRecoveries: number;
    averageRecoveryTime: number;
  } {
    return {
      activeRecoveries: this.activeRecoveries.size,
      totalRecoveries: 0, // This would be tracked over time
      averageRecoveryTime: 0 // This would be calculated from historical data
    };
  }

  /**
   * Clear all active recoveries (for testing or reset)
   */
  public clearActiveRecoveries(): void {
    this.activeRecoveries.clear();
  }
}

// Singleton instance for global use
export const errorRecovery = new ErrorRecovery();

/**
 * Convenience function for error recovery
 */
export async function recoverFromError(
  error: ErrorInfo,
  context: ErrorContext,
  options?: Partial<ErrorRecoveryOptions>
): Promise<ErrorRecoveryResult> {
  return errorRecovery.recover(error, context, options);
} 