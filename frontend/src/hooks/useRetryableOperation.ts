import { useState, useCallback, useRef } from 'react';
import logger from '../utils/logger';

export interface RetryableOperationOptions {
  maxRetries?: number;
  baseDelay?: number; // Base delay in milliseconds
  maxDelay?: number; // Maximum delay in milliseconds
  exponentialBase?: number; // Base for exponential backoff
  retryCondition?: (error: any) => boolean; // Function to determine if error should trigger retry
}

export interface RetryableOperationState<T> {
  data: T | null;
  isLoading: boolean;
  error: any;
  retryCount: number;
  canRetry: boolean;
}

const defaultOptions: Required<RetryableOperationOptions> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  exponentialBase: 2,
  retryCondition: (error: any) => {
    // Default: retry on network errors and 5xx server errors
    const isNetworkError = !error.response || error.code === 'NETWORK_ERROR';
    const isServerError = error.response?.status >= 500;
    const isRateLimited = error.response?.status === 429;
    
    return isNetworkError || isServerError || isRateLimited;
  },
};

export const useRetryableOperation = <T>(
  operation: (...args: any[]) => Promise<T>,
  options: RetryableOperationOptions = {}
) => {
  const opts = { ...defaultOptions, ...options };
  
  const [state, setState] = useState<RetryableOperationState<T>>({
    data: null,
    isLoading: false,
    error: null,
    retryCount: 0,
    canRetry: false,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const calculateDelay = useCallback((attempt: number): number => {
    const delay = opts.baseDelay * Math.pow(opts.exponentialBase, attempt);
    return Math.min(delay, opts.maxDelay);
  }, [opts.baseDelay, opts.exponentialBase, opts.maxDelay]);

  const sleep = useCallback((ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  }, []);

  const execute = useCallback(async (...args: any[]): Promise<T | null> => {
    // Cancel any ongoing operation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      retryCount: 0,
      canRetry: false,
    }));

    let lastError: any;
    
    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
      if (signal.aborted) {
        logger.info('[useRetryableOperation] Operation aborted');
        return null;
      }

      try {
        logger.info('[useRetryableOperation] Executing operation', {
          attempt: attempt + 1,
          maxRetries: opts.maxRetries + 1,
        });

        const result = await operation(...args);
        
        setState(prev => ({
          ...prev,
          data: result,
          isLoading: false,
          error: null,
          retryCount: attempt,
          canRetry: false,
        }));

        logger.info('[useRetryableOperation] Operation succeeded', {
          attempt: attempt + 1,
        });

        return result;
      } catch (error) {
        lastError = error;
        
        logger.warn('[useRetryableOperation] Operation failed', {
          attempt: attempt + 1,
          error: error.message || error,
          willRetry: attempt < opts.maxRetries && opts.retryCondition(error),
        });

        // Check if we should retry
        const shouldRetry = attempt < opts.maxRetries && opts.retryCondition(error);
        
        if (!shouldRetry) {
          break;
        }

        // Wait before retrying (with exponential backoff)
        if (attempt < opts.maxRetries) {
          const delay = calculateDelay(attempt);
          logger.info('[useRetryableOperation] Waiting before retry', { delay });
          
          setState(prev => ({
            ...prev,
            retryCount: attempt + 1,
          }));

          await sleep(delay);
        }
      }
    }

    // All retries exhausted
    const finalRetryCount = opts.maxRetries;
    const canRetry = opts.retryCondition(lastError);

    setState(prev => ({
      ...prev,
      isLoading: false,
      error: lastError,
      retryCount: finalRetryCount,
      canRetry,
    }));

    logger.error('[useRetryableOperation] Operation failed after all retries', {
      totalAttempts: opts.maxRetries + 1,
      finalError: lastError?.message || lastError,
      canRetry,
    });

    return null;
  }, [operation, opts, calculateDelay, sleep]);

  const retry = useCallback(async (...args: any[]): Promise<T | null> => {
    if (!state.canRetry) {
      logger.warn('[useRetryableOperation] Retry attempted but not allowed');
      return null;
    }

    logger.info('[useRetryableOperation] Manual retry triggered');
    return execute(...args);
  }, [execute, state.canRetry]);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      logger.info('[useRetryableOperation] Operation cancelled');
    }

    setState(prev => ({
      ...prev,
      isLoading: false,
      canRetry: prev.error ? opts.retryCondition(prev.error) : false,
    }));
  }, [opts.retryCondition]);

  const reset = useCallback(() => {
    cancel();
    setState({
      data: null,
      isLoading: false,
      error: null,
      retryCount: 0,
      canRetry: false,
    });
  }, [cancel]);

  return {
    ...state,
    execute,
    retry,
    cancel,
    reset,
  };
};

export default useRetryableOperation;
