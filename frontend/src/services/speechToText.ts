import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import logger from '../utils/logger';
// Import the NAMED export 'api' (the axios instance) and alias it
import { api as axiosInstance } from './api';
import axios from 'axios';
import * as FileSystem from 'expo-file-system';

// Define types for response and options
interface TranscriptionResult {
  transcript: string;
  detected_language_code?: string; // Added optional detected language
  hidden_mode_activated?: boolean; // Added for code phrase detection
  // Add other fields if your backend returns more info (e.g., confidence)
}

interface TranscriptionOptions {
  languageCode?: string; // Backend might handle language differently
  // Add other options if the backend supports them
}

/**
 * Service to handle Speech-to-Text interactions via the backend API
 */
class SpeechToTextService {
  constructor() {
    // No need to load config here anymore
    logger.info('SpeechToTextService initialized to use backend API');
  }

  /**
   * Transcribe audio from a file path by sending it to the backend API
   */
  public async transcribeAudio(
    audioFilePath: string,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult> {
    logger.info(`Requesting transcription for audio file: ${audioFilePath}`);
    
    try {
      // --- First attempt with current token ---
      try {
        // Create initial FormData
        const formData = new FormData();
        
        if (Platform.OS === 'web') {
          logger.info('Web platform detected, fetching blob data...');
          const response = await fetch(audioFilePath);
          const blob = await response.blob();
          const fileName = `recording-${Date.now()}.wav`;
          
          // Use the correct syntax for FormData.append
          formData.append('file', new File([blob], fileName, { 
            type: blob.type || 'audio/wav'
          }));
          
          logger.info(`Appended blob to FormData: ${fileName}, type: ${blob.type || 'audio/wav'}, size: ${blob.size}`);
        } else {
          // Native platform handling (unchanged)
          // ...existing code for native platforms...
        }
        
        if (options.languageCode) {
          logger.info(`Using language code: ${options.languageCode} (Backend must support)`);
        }
        
        // Get current token
        const token = await AsyncStorage.getItem('access_token');
        if (!token) {
          logger.warn('Authentication token (access_token) not found for transcription request.');
          throw new Error('Authentication token not found.');
        }
        
        logger.info('Sending audio file to backend /api/speech/transcribe...');
        
        // First attempt
        const response = await axiosInstance.post<TranscriptionResult>(
          '/api/speech/transcribe',
          formData,
          {
            headers: {
              // Remove explicit Content-Type - let Axios handle it for FormData
              // 'Content-Type': 'multipart/form-data',
              'Authorization': `Bearer ${token}`,
            },
          }
        );
        
        logger.info('Transcription received from backend successfully.');
        return response.data;
      } 
      catch (initialError: any) {
        // Handle 401 with manual refresh and retry
        if (initialError.response?.status === 401) {
          logger.info('Got 401, manually refreshing token and retrying...');
          
          // --- Wrap refresh and retry in its own try/catch --- 
          try {
            // Get refresh token
            const refreshToken = await AsyncStorage.getItem('refresh_token');
            if (!refreshToken) {
              throw new Error('No refresh token available for retry');
            }
            
            // Manual token refresh
            const refreshResponse = await axios.post(
              'http://localhost:8001/api/auth/refresh',
              { refresh_token: refreshToken }
            );
            
            if (!refreshResponse.data.access_token) {
              throw new Error('Token refresh failed - invalid response');
            }
            
            // Save new tokens
            const newToken = refreshResponse.data.access_token;
            await AsyncStorage.setItem('access_token', newToken);
            if (refreshResponse.data.refresh_token) {
              await AsyncStorage.setItem('refresh_token', refreshResponse.data.refresh_token);
            }
            
            // Update global defaults
            axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
            
            // Create a FRESH FormData object with the same file
            logger.info('Creating fresh FormData for retry...');
            const retryFormData = new FormData();
            
            if (Platform.OS === 'web') {
              const retryFetchResponse = await fetch(audioFilePath); // Renamed variable
              const retryBlob = await retryFetchResponse.blob();
              const retryFileName = `recording-retry-${Date.now()}.wav`;
              
              // Use the correct syntax for FormData.append in the retry section too
              retryFormData.append('file', new File([retryBlob], retryFileName, {
                type: retryBlob.type || 'audio/wav'
              }));
              
              logger.info(`Created fresh FormData for retry: ${retryFileName}`);
            } else {
              // Native platform retry form data
              // TODO: Duplicate the native form data creation code here!
              // Example (adjust based on your actual native code):
              // const fileInfo = await FileSystem.getInfoAsync(audioFilePath);
              // const uri = fileInfo.uri;
              // const fileExtension = uri.split('.').pop()?.toLowerCase();
              // const fileType = fileExtension === 'm4a' ? 'audio/m4a' : ... ;
              // const fileName = uri.split('/').pop() || ... ;
              // retryFormData.append('file', { uri, name: fileName, type: fileType } as any);
            }
            
            // Retry with new token and fresh FormData
            logger.info('Retrying with fresh token and FormData...');
            // --- Add logging for the token being used ---
            logger.debug('Manual Retry Token:', newToken);
            // ---------------------------------------------
            const retryResponse = await axios.post<TranscriptionResult>(
              'http://localhost:8001/api/speech/transcribe',
              retryFormData,
              {
                headers: {
                  // Remove explicit Content-Type here too
                  // 'Content-Type': 'multipart/form-data',
                  'Authorization': `Bearer ${newToken}`,
                },
              }
            );
            
            logger.info('Retry successful, transcription received.');
            return retryResponse.data;
          } 
          catch (refreshOrRetryError: any) {
            // Catch errors specifically from the refresh or retry attempt
            const retryErrorMessage = refreshOrRetryError.message || 'Unknown refresh/retry error';
            logger.error('Token refresh or retry failed', { error: refreshOrRetryError });
            // Throw the specific error message expected by the test
            throw new Error(`Transcription retry failed: ${retryErrorMessage}`); 
          }
          // --- End wrap refresh and retry --- 
        }
        
        // If not a 401 error, just rethrow the original error from the first attempt
        throw initialError;
      }
    } 
    catch (error: any) {
      // Final error handling for errors outside the 401/retry flow
      const errorMessage = error.response?.data?.detail || error.message || 'Unknown transcription error';
      // Keep this generic for other errors
      logger.error('Failed to transcribe audio via backend API', {
        message: errorMessage,
        status: error.response?.status,
        requestUrl: error.config?.url,
        response: error.response?.data, 
      });
      throw new Error(`Transcription failed: ${errorMessage}`);
    }
  }
}

// Singleton instance
const speechToTextService = new SpeechToTextService();
export default speechToTextService; 