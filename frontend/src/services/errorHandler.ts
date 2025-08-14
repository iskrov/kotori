import { Alert } from 'react-native';
import logger from '../utils/logger';
import authService from './authService';

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  details?: any;
}

export class ErrorHandler {
  /**
   * Handle API errors with appropriate user feedback
   */
  static async handleApiError(error: any, context: string = 'API call'): Promise<ApiError> {
    logger.error(`[ErrorHandler] ${context} failed`, error);

    // Extract error information
    let apiError: ApiError = {
      message: 'An unexpected error occurred',
      status: 0,
    };

    if (error.response) {
      // HTTP error response
      apiError = {
        message: error.response.data?.message || error.response.statusText || 'Server error',
        code: error.response.data?.code,
        status: error.response.status,
        details: error.response.data,
      };

      // Handle specific HTTP status codes
      switch (error.response.status) {
        case 401:
          logger.warn('[ErrorHandler] Authentication error');
          await authService.handleAuthError();
          apiError.message = 'Authentication required. Please log in again.';
          break;

        case 403:
          apiError.message = 'You don\'t have permission to perform this action.';
          break;

        case 404:
          apiError.message = 'The requested resource was not found.';
          break;

        case 429:
          apiError.message = 'Too many requests. Please wait a moment and try again.';
          break;

        case 500:
          apiError.message = 'Server error. Please try again later.';
          break;

        case 503:
          apiError.message = 'Service temporarily unavailable. Please try again later.';
          break;
      }
    } else if (error.request) {
      // Network error
      apiError = {
        message: 'Unable to connect to the server. Please check your internet connection.',
        code: 'NETWORK_ERROR',
      };
    } else if (error.message) {
      // Other error
      apiError = {
        message: error.message,
        code: 'CLIENT_ERROR',
      };
    }

    return apiError;
  }

  /**
   * Show error alert to user
   */
  static showErrorAlert(
    error: ApiError,
    title: string = 'Error',
    onRetry?: () => void
  ): void {
    const buttons: any[] = [];

    if (onRetry) {
      buttons.push({ text: 'Try Again', onPress: onRetry });
    }
    
    buttons.push({ text: 'OK', style: 'cancel' });

    Alert.alert(title, error.message, buttons);
  }

  /**
   * Handle and show error in one call
   */
  static async handleAndShowError(
    error: any,
    context: string = 'Operation',
    title: string = 'Error',
    onRetry?: () => void
  ): Promise<ApiError> {
    const apiError = await this.handleApiError(error, context);
    this.showErrorAlert(apiError, title, onRetry);
    return apiError;
  }

  /**
   * Check if error is network-related
   */
  static isNetworkError(error: ApiError): boolean {
    return error.code === 'NETWORK_ERROR' || 
           error.message.toLowerCase().includes('network') ||
           error.message.toLowerCase().includes('connection');
  }

  /**
   * Check if error is authentication-related
   */
  static isAuthError(error: ApiError): boolean {
    return error.status === 401 || error.status === 403;
  }

  /**
   * Get user-friendly error message
   */
  static getUserFriendlyMessage(error: ApiError): string {
    if (this.isNetworkError(error)) {
      return 'Please check your internet connection and try again.';
    }

    if (this.isAuthError(error)) {
      return 'Please log in again to continue.';
    }

    if (error.status && error.status >= 500) {
      return 'Server is temporarily unavailable. Please try again later.';
    }

    return error.message || 'Something went wrong. Please try again.';
  }

  /**
   * Log error for debugging
   */
  static logError(error: any, context: string, additionalInfo?: any): void {
    logger.error(`[ErrorHandler] ${context}`, {
      error: error.message || error,
      stack: error.stack,
      additionalInfo,
      timestamp: new Date().toISOString(),
    });
  }
}

export default ErrorHandler;
