import { useState, useCallback } from 'react';
import ErrorHandler, { ApiError } from '../services/errorHandler';
import logger from '../utils/logger';

export interface UseApiErrorReturn {
  error: ApiError | null;
  isLoading: boolean;
  clearError: () => void;
  handleError: (error: any, context?: string) => Promise<ApiError>;
  executeWithErrorHandling: <T>(
    operation: () => Promise<T>,
    context?: string,
    showAlert?: boolean
  ) => Promise<T | null>;
}

export const useApiError = (): UseApiErrorReturn => {
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const handleError = useCallback(async (error: any, context: string = 'API operation') => {
    const apiError = await ErrorHandler.handleApiError(error, context);
    setError(apiError);
    return apiError;
  }, []);

  const executeWithErrorHandling = useCallback(async <T>(
    operation: () => Promise<T>,
    context: string = 'API operation',
    showAlert: boolean = false
  ): Promise<T | null> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await operation();
      logger.info(`[useApiError] ${context} completed successfully`);
      return result;
    } catch (error) {
      logger.error(`[useApiError] ${context} failed`, error);
      
      const apiError = await handleError(error, context);
      
      if (showAlert) {
        ErrorHandler.showErrorAlert(apiError, 'Error');
      }
      
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);

  return {
    error,
    isLoading,
    clearError,
    handleError,
    executeWithErrorHandling,
  };
};

export default useApiError;
