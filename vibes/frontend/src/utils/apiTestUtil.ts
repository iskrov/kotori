import Constants from 'expo-constants';
import logger from './logger';

interface ApiStatus {
  available: boolean;
  error?: string;
}

/**
 * Utility to test connectivity with the Google Cloud Speech-to-Text API
 * This can be used to verify if the API is properly configured and accessible
 */
class ApiTestUtil {
  private apiUrl: string = 'https://speech.googleapis.com/v2';
  private projectId: string | null = null;
  private apiKey: string | null = null;
  
  constructor() {
    this.loadConfig();
  }
  
  /**
   * Load API configuration from environment variables
   */
  private loadConfig(): void {
    try {
      if (Constants.expoConfig?.extra) {
        this.apiKey = Constants.expoConfig.extra.googleSpeechApiKey || null;
        this.projectId = Constants.expoConfig.extra.googleCloudProjectId || null;
      }
    } catch (error) {
      logger.error('Failed to load API configuration for testing', error);
    }
  }
  
  /**
   * Test the connection to Google Cloud Speech-to-Text API
   * This makes a lightweight request to verify API credentials and connectivity
   */
  public async testSpeechToTextApi(): Promise<ApiStatus> {
    if (!this.apiKey || !this.projectId) {
      return {
        available: false,
        error: 'API credentials not configured. Check your environment variables.'
      };
    }
    
    try {
      // Make a lightweight request to verify the API is accessible
      // Using the locations endpoint which should return a list of supported locations
      const response = await fetch(
        `${this.apiUrl}/projects/${this.projectId}/locations?key=${this.apiKey}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.ok) {
        return { available: true };
      } else {
        const errorText = await response.text();
        logger.error('Speech-to-Text API test failed', { 
          status: response.status, 
          error: errorText 
        });
        
        if (response.status === 401 || response.status === 403) {
          return {
            available: false,
            error: 'Authentication failed. Check your API key and permissions.'
          };
        } else if (response.status === 404) {
          return {
            available: false,
            error: 'Project ID not found. Verify your Google Cloud project configuration.'
          };
        } else {
          return {
            available: false,
            error: `API returned error: ${response.status}. ${errorText}`
          };
        }
      }
    } catch (error) {
      logger.error('Error testing Speech-to-Text API', error);
      return {
        available: false,
        error: `Connection error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}

export const apiTestUtil = new ApiTestUtil(); 