/**
 * React hook for error handling with automatic recovery and user feedback
 * Provides a convenient interface for handling errors in React components
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  ErrorType, 
  ErrorInfo, 
  ErrorContext, 
  ErrorRecoveryResult,
  ErrorRecoveryOptions 
} from '../types/errorTypes';
import { createErrorInfo, createInternalError } from '../utils/errorHandling';
import { logError, logRecovery } from '../services/ErrorLogger';
import { recoverFromError } from '../services/ErrorRecovery';

interface UseErrorHandlerOptions {
  enableAutoRecovery?: boolean;
  enableUserFeedback?: boolean;
  maxRetries?: number;
  onError?: (error: ErrorInfo) => void;
  onRecovery?: (result: ErrorRecoveryResult) => void;
  component?: string;
}

interface ErrorState {
  error: ErrorInfo | null;
  isRecovering: boolean;
  recoveryAttempts: number;
  lastRecoveryTime: number | null;
}

/**
 * Hook for comprehensive error handling in React components
 */
export function useErrorHandler(options: UseErrorHandlerOptions = {}) {
  const {
    enableAutoRecovery = true,
    enableUserFeedback = true,
    maxRetries = 3,
    onError,
    onRecovery,
    component = 'UnknownComponent'
  } = options;

  const [errorState, setErrorState] = useState<ErrorState>({
    error: null,
    isRecovering: false,
    recoveryAttempts: 0,
    lastRecoveryTime: null
  });

  const contextRef = useRef<ErrorContext>({
    component,
    operation: 'unknown',
    timestamp: new Date(),
    platform: 'react-native'
  });

  // Update context when component changes
  useEffect(() => {
    contextRef.current.component = component;
  }, [component]);

  /**
   * Handle an error with automatic logging and optional recovery
   */
  const handleError = useCallback(async (
    error: Error | ErrorType,
    operation: string = 'unknown',
    metadata?: Record<string, any>
  ): Promise<void> => {
    const context: ErrorContext = {
      ...contextRef.current,
      operation,
      timestamp: new Date()
    };

    let errorInfo: ErrorInfo;

    if (error instanceof Error) {
      // Convert JavaScript Error to ErrorInfo
      const internalError = createInternalError(
        ErrorType.SYSTEM_UNEXPECTED_STATE,
        error.message,
        context,
        error,
        metadata
      );
      
      logError(internalError);
      errorInfo = createErrorInfo(ErrorType.SYSTEM_UNEXPECTED_STATE, context, error);
    } else {
      // ErrorType provided directly
      errorInfo = createErrorInfo(error, context);
      
      const internalError = createInternalError(
        error,
        `Error of type ${error} occurred in ${operation}`,
        context,
        undefined,
        metadata
      );
      
      logError(internalError);
    }

    // Update error state
    setErrorState(prev => ({
      ...prev,
      error: errorInfo,
      recoveryAttempts: 0,
      lastRecoveryTime: null
    }));

    // Call custom error handler
    if (onError) {
      onError(errorInfo);
    }

    // Attempt automatic recovery if enabled
    if (enableAutoRecovery && errorInfo.recovery?.canRetry) {
      await attemptRecovery(errorInfo, context);
    }
  }, [enableAutoRecovery, onError, component]);

  /**
   * Manually trigger error recovery
   */
  const retryOperation = useCallback(async (): Promise<boolean> => {
    if (!errorState.error) return false;
    
    return attemptRecovery(errorState.error, contextRef.current);
  }, [errorState.error]);

  /**
   * Attempt error recovery with retry logic
   */
  const attemptRecovery = useCallback(async (
    error: ErrorInfo,
    context: ErrorContext
  ): Promise<boolean> => {
    if (errorState.isRecovering || errorState.recoveryAttempts >= maxRetries) {
      return false;
    }

    setErrorState(prev => ({
      ...prev,
      isRecovering: true,
      recoveryAttempts: prev.recoveryAttempts + 1
    }));

    try {
      const recoveryResult = await recoverFromError(error, context);
      
      // Log recovery attempt
      logRecovery(
        error.id,
        errorState.recoveryAttempts + 1,
        recoveryResult.success,
        recoveryResult.recoveryTime
      );

      if (recoveryResult.success) {
        // Recovery successful - clear error state
        setErrorState({
          error: null,
          isRecovering: false,
          recoveryAttempts: 0,
          lastRecoveryTime: Date.now()
        });
        
        if (onRecovery) {
          onRecovery(recoveryResult);
        }
        
        return true;
      } else {
        // Recovery failed - update state
        setErrorState(prev => ({
          ...prev,
          isRecovering: false,
          error: recoveryResult.error || error
        }));
        
        if (onRecovery) {
          onRecovery(recoveryResult);
        }
        
        return false;
      }
    } catch (recoveryError) {
      // Recovery process failed
      console.error('Recovery process failed:', recoveryError);
      
      setErrorState(prev => ({
        ...prev,
        isRecovering: false
      }));
      
      return false;
    }
  }, [errorState.isRecovering, errorState.recoveryAttempts, maxRetries, onRecovery]);

  /**
   * Clear the current error state
   */
  const clearError = useCallback(() => {
    setErrorState({
      error: null,
      isRecovering: false,
      recoveryAttempts: 0,
      lastRecoveryTime: null
    });
  }, []);

  /**
   * Wrap an async operation with error handling
   */
  const withErrorHandling = useCallback(<T>(
    operation: () => Promise<T>,
    operationName: string = 'async_operation',
    errorType?: ErrorType
  ): Promise<T> => {
    return operation().catch(async (error) => {
      await handleError(
        errorType || (error instanceof Error ? error : ErrorType.SYSTEM_UNEXPECTED_STATE),
        operationName,
        { originalError: error }
      );
      throw error; // Re-throw to maintain promise chain behavior
    });
  }, [handleError]);

  /**
   * Wrap a synchronous operation with error handling
   */
  const withSyncErrorHandling = useCallback(<T>(
    operation: () => T,
    operationName: string = 'sync_operation',
    errorType?: ErrorType
  ): T | null => {
    try {
      return operation();
    } catch (error) {
      handleError(
        errorType || (error instanceof Error ? error : ErrorType.SYSTEM_UNEXPECTED_STATE),
        operationName,
        { originalError: error }
      );
      return null;
    }
  }, [handleError]);

  /**
   * Update the operation context for better error tracking
   */
  const setContext = useCallback((updates: Partial<ErrorContext>) => {
    contextRef.current = {
      ...contextRef.current,
      ...updates,
      timestamp: new Date()
    };
  }, []);

  /**
   * Check if a specific error type is currently active
   */
  const hasError = useCallback((errorType?: ErrorType): boolean => {
    if (!errorState.error) return false;
    if (!errorType) return true;
    return errorState.error.type === errorType;
  }, [errorState.error]);

  /**
   * Get recovery suggestions for the current error
   */
  const getRecoverySuggestions = useCallback((): string[] => {
    if (!errorState.error) return [];
    
    // This would use the getRecoverySuggestions function from secureErrorMessages
    // For now, return basic suggestions
    return errorState.error.recovery?.canRetry 
      ? ['Try the operation again', 'Check your connection', 'Contact support if the problem persists']
      : ['Contact support for assistance'];
  }, [errorState.error]);

  return {
    // Error state
    error: errorState.error,
    isRecovering: errorState.isRecovering,
    recoveryAttempts: errorState.recoveryAttempts,
    hasError: hasError(),
    
    // Error handling functions
    handleError,
    retryOperation,
    clearError,
    
    // Operation wrappers
    withErrorHandling,
    withSyncErrorHandling,
    
    // Context management
    setContext,
    
    // Utility functions
    hasErrorType: hasError,
    getRecoverySuggestions,
    
    // Configuration
    canRetry: errorState.error?.recovery?.canRetry ?? false,
    maxRetriesReached: errorState.recoveryAttempts >= maxRetries,
    
    // Timing information
    lastRecoveryTime: errorState.lastRecoveryTime
  };
}

/**
 * Simplified hook for basic error handling without recovery
 */
export function useSimpleErrorHandler(component: string = 'UnknownComponent') {
  return useErrorHandler({
    enableAutoRecovery: false,
    enableUserFeedback: true,
    component
  });
}

/**
 * Hook specifically for OPAQUE authentication errors
 */
export function useAuthErrorHandler(component: string = 'AuthComponent') {
  return useErrorHandler({
    enableAutoRecovery: true,
    enableUserFeedback: true,
    maxRetries: 2, // Lower retry count for auth errors
    component,
    onError: (error) => {
      // Custom handling for auth errors
      if (error.type.startsWith('AUTH_')) {
        console.log('Authentication error occurred:', error.type);
      }
    }
  });
}

/**
 * Hook for network operation error handling
 */
export function useNetworkErrorHandler(component: string = 'NetworkComponent') {
  return useErrorHandler({
    enableAutoRecovery: true,
    enableUserFeedback: true,
    maxRetries: 5, // Higher retry count for network errors
    component,
    onError: (error) => {
      // Custom handling for network errors
      if (error.type.startsWith('NETWORK_')) {
        console.log('Network error occurred:', error.type);
      }
    }
  });
} 