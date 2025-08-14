import AsyncStorage from '@react-native-async-storage/async-storage';
import logger from '../utils/logger';

const AUTH_TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_DATA_KEY = 'user_data';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface UserData {
  id: string;
  email: string;
  name?: string;
}

class AuthService {
  private tokens: AuthTokens | null = null;
  private userData: UserData | null = null;

  /**
   * Initialize auth service by loading stored tokens
   */
  async initialize(): Promise<void> {
    try {
      const [tokenData, userData] = await Promise.all([
        AsyncStorage.getItem(AUTH_TOKEN_KEY),
        AsyncStorage.getItem(USER_DATA_KEY),
      ]);

      if (tokenData) {
        this.tokens = JSON.parse(tokenData);
        // Check if token is expired
        if (this.tokens && this.tokens.expiresAt < Date.now()) {
          logger.info('[AuthService] Token expired, clearing');
          await this.clearAuth();
        }
      }

      if (userData) {
        this.userData = JSON.parse(userData);
      }

      logger.info('[AuthService] Initialized', { 
        hasToken: !!this.tokens,
        hasUser: !!this.userData 
      });
    } catch (error) {
      logger.error('[AuthService] Failed to initialize', error);
      await this.clearAuth();
    }
  }

  /**
   * Store authentication tokens and user data
   */
  async setAuth(tokens: AuthTokens, userData: UserData): Promise<void> {
    try {
      this.tokens = tokens;
      this.userData = userData;

      await Promise.all([
        AsyncStorage.setItem(AUTH_TOKEN_KEY, JSON.stringify(tokens)),
        AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(userData)),
      ]);

      logger.info('[AuthService] Auth data stored', { userId: userData.id });
    } catch (error) {
      logger.error('[AuthService] Failed to store auth data', error);
      throw error;
    }
  }

  /**
   * Clear all authentication data
   */
  async clearAuth(): Promise<void> {
    try {
      this.tokens = null;
      this.userData = null;

      await Promise.all([
        AsyncStorage.removeItem(AUTH_TOKEN_KEY),
        AsyncStorage.removeItem(REFRESH_TOKEN_KEY),
        AsyncStorage.removeItem(USER_DATA_KEY),
      ]);

      logger.info('[AuthService] Auth data cleared');
    } catch (error) {
      logger.error('[AuthService] Failed to clear auth data', error);
    }
  }

  /**
   * Get current access token
   */
  getAccessToken(): string | null {
    if (!this.tokens) {
      return null;
    }

    // Check if token is expired
    if (this.tokens.expiresAt < Date.now()) {
      logger.warn('[AuthService] Token expired');
      return null;
    }

    return this.tokens.accessToken;
  }

  /**
   * Get current user data
   */
  getUserData(): UserData | null {
    return this.userData;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  /**
   * Get authorization headers for API calls
   */
  getAuthHeaders(): Record<string, string> {
    const token = this.getAccessToken();
    if (!token) {
      return {};
    }

    return {
      'Authorization': `Bearer ${token}`,
    };
  }

  /**
   * Refresh access token (placeholder - needs backend implementation)
   */
  async refreshAccessToken(): Promise<boolean> {
    try {
      if (!this.tokens?.refreshToken) {
        logger.warn('[AuthService] No refresh token available');
        return false;
      }

      // TODO: Implement actual token refresh API call
      logger.info('[AuthService] Token refresh not implemented yet');
      return false;
    } catch (error) {
      logger.error('[AuthService] Failed to refresh token', error);
      await this.clearAuth();
      return false;
    }
  }

  /**
   * Handle authentication errors (e.g., 401 responses)
   */
  async handleAuthError(): Promise<void> {
    logger.warn('[AuthService] Handling authentication error');
    
    // Try to refresh token first
    const refreshed = await this.refreshAccessToken();
    if (!refreshed) {
      // If refresh fails, clear auth and redirect to login
      await this.clearAuth();
      // TODO: Navigate to login screen
      logger.info('[AuthService] User needs to re-authenticate');
    }
  }
}

export const authService = new AuthService();
export default authService;
