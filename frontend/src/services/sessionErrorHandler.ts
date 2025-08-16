import { Alert, Platform } from 'react-native';
import logger from '../utils/logger';

export interface SessionErrorOptions {
  operation?: string;
  showAlert?: boolean;
  customMessage?: string;
}

/**
 * Handles session expiry errors with user-friendly messaging
 * Especially important for critical operations like recording
 */
export class SessionErrorHandler {
  
  /**
   * Show user-friendly error when session expires during critical operations
   */
  static handleSessionExpired(options: SessionErrorOptions = {}) {
    const {
      operation = 'this action',
      showAlert = true,
      customMessage
    } = options;

    const message = customMessage || 
      `Your session has expired while performing ${operation}. Please sign in again to continue.`;

    logger.warn('[SessionErrorHandler] Session expired during operation', { 
      operation,
      showAlert 
    });

    if (showAlert) {
      if (Platform.OS === 'web') {
        // Use custom alert for web to match app styling
        this.showWebAlert('Session Expired', message);
      } else {
        // Use native alert for mobile
        Alert.alert(
          'Session Expired',
          message,
          [
            {
              text: 'OK',
              style: 'default',
            },
          ],
          { cancelable: false }
        );
      }
    }
  }

  /**
   * Show web-compatible alert
   */
  private static showWebAlert(title: string, message: string) {
    // For now, use window.alert, but this could be replaced with a custom modal
    window.alert(`${title}\n\n${message}`);
  }

  /**
   * Handle different types of authentication errors
   */
  static handleAuthError(error: any, options: SessionErrorOptions = {}) {
    const { operation } = options;

    if (error.status === 401 || error.message?.includes('Session expired')) {
      this.handleSessionExpired({
        ...options,
        operation: operation || 'your request'
      });
    } else {
      logger.error('[SessionErrorHandler] Non-session auth error', { 
        error: error.message,
        status: error.status,
        operation 
      });
    }
  }
}

// Export convenience functions
export const handleSessionExpired = SessionErrorHandler.handleSessionExpired.bind(SessionErrorHandler);
export const handleAuthError = SessionErrorHandler.handleAuthError.bind(SessionErrorHandler);
