import logger from '../utils/logger';

/**
 * Global authentication manager that bridges the gap between
 * the API interceptor and the AuthContext.
 * 
 * This allows the API interceptor to trigger logout without
 * directly accessing React context.
 */
class AuthManager {
  private logoutCallback: (() => Promise<void>) | null = null;

  /**
   * Set the logout callback function from AuthContext
   */
  setLogoutCallback(callback: () => Promise<void>) {
    this.logoutCallback = callback;
    logger.info('[AuthManager] Logout callback registered');
  }

  /**
   * Clear the logout callback (cleanup)
   */
  clearLogoutCallback() {
    this.logoutCallback = null;
    logger.info('[AuthManager] Logout callback cleared');
  }

  /**
   * Trigger logout from anywhere in the app
   * This will update the AuthContext state and redirect to login
   */
  async logout(reason?: string) {
    if (!this.logoutCallback) {
      logger.error('[AuthManager] Cannot logout: no callback registered');
      return;
    }

    try {
      logger.info('[AuthManager] Triggering logout', { reason });
      await this.logoutCallback();
      logger.info('[AuthManager] Logout completed successfully');
    } catch (error) {
      logger.error('[AuthManager] Logout failed:', error);
      throw error;
    }
  }

  /**
   * Check if logout callback is available
   */
  isReady(): boolean {
    return this.logoutCallback !== null;
  }
}

// Export singleton instance
export const authManager = new AuthManager();
