import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import logger from '../utils/logger';
// Import the NAMED export 'api' (the axios instance) and alias it
import { api as axiosInstance } from './api';
import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import { validateLanguageCode } from '../config/languageConfig';

// Enhanced types for multi-language transcription
interface TranscriptionResult {
  transcript: string;
  detected_language_code?: string;
  confidence: number;
  alternatives: Array<{
    transcript: string;
    confidence: number;
  }>;
  word_confidence: Array<{
    word: string;
    confidence: number;
    start_time: number;
    end_time: number;
  }>;
  language_confidence: number;
  quality_metrics: {
    average_confidence: number;
    low_confidence_words: number;
    total_words: number;
  };
  hidden_mode_activated?: boolean;
}

interface TranscriptionOptions {
  languageCodes?: string[]; // Enhanced to support multiple language codes
  maxAlternatives?: number;
  enableWordConfidence?: boolean;
  confidenceThreshold?: number;
}

interface TranscriptionError {
  type: 'validation' | 'network' | 'server' | 'authentication' | 'unknown';
  message: string;
  details?: any;
}

/**
 * Enhanced service to handle multi-language Speech-to-Text interactions via the backend API
 * with confidence scoring, alternatives, and quality metrics.
 */
class SpeechToTextService {
  private readonly maxRetries = 2;
  private readonly retryDelay = 1000; // 1 second

  constructor() {
    logger.info('Enhanced SpeechToTextService initialized for multi-language support');
  }

  /**
   * Enhanced transcription method with multi-language support
   */
  public async transcribeAudio(
    audioFilePath: string,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult> {
    const { languageCodes, maxAlternatives = 3, enableWordConfidence = true } = options;
    
    logger.info(
      `Requesting enhanced transcription for audio file: ${audioFilePath}, ` +
      `Languages: ${languageCodes ? languageCodes.join(', ') : 'auto-detect'}, ` +
      `Max alternatives: ${maxAlternatives}`
    );
    
    try {
      // Validate language codes if provided
      if (languageCodes && languageCodes.length > 0) {
        this._validateLanguageCodes(languageCodes);
      }

      // --- First attempt with current token ---
      try {
        return await this._performTranscription(audioFilePath, languageCodes);
      } 
      catch (initialError: any) {
        // Handle 401 with manual refresh and retry
        if (initialError.response?.status === 401) {
          logger.info('Got 401, manually refreshing token and retrying...');
          return await this._retryWithTokenRefresh(audioFilePath, languageCodes);
        }
        
        // If not a 401 error, just rethrow the original error
        throw this._createTranscriptionError(initialError);
      }
    } 
    catch (error: any) {
      // Final error handling for errors outside the 401/retry flow
      logger.error('Failed to transcribe audio via enhanced backend API', {
        message: error.message,
        type: error.type || 'unknown',
        languageCodes,
        audioPath: audioFilePath
      });
      throw error;
    }
  }

  /**
   * Validate language codes before sending to backend
   */
  private _validateLanguageCodes(languageCodes: string[]): void {
    if (languageCodes.length > 4) {
      throw this._createTranscriptionError({
        type: 'validation',
        message: `Too many language codes. Maximum 4 allowed, got ${languageCodes.length}`
      });
    }

    // Use simplified validation from languageConfig
    const invalidCodes = languageCodes.filter(code => {
      return code !== 'auto' && !validateLanguageCode(code);
    });

    if (invalidCodes.length > 0) {
      throw this._createTranscriptionError({
        type: 'validation',
        message: `Invalid language codes: ${invalidCodes.join(', ')}. Please use supported language codes.`
      });
    }
  }

  /**
   * Perform the actual transcription request
   */
  private async _performTranscription(
    audioFilePath: string, 
    languageCodes?: string[]
  ): Promise<TranscriptionResult> {
    // Create FormData with audio file
    const formData = await this._createFormData(audioFilePath);
    
    // Add language codes if provided
    if (languageCodes && languageCodes.length > 0) {
      formData.append('language_codes_json', JSON.stringify(languageCodes));
      logger.info(`Added language codes to request: ${JSON.stringify(languageCodes)}`);
    }
    
    // Get current token
    const token = await AsyncStorage.getItem('access_token');
    if (!token) {
      throw this._createTranscriptionError({
        type: 'authentication',
        message: 'Authentication token not found'
      });
    }
    
    logger.info('Sending enhanced audio file to backend /api/speech/transcribe...');
    
    const response = await axiosInstance.post<TranscriptionResult>(
      '/api/speech/transcribe',
      formData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        timeout: 30000, // 30 second timeout for transcription
      }
    );
    
    logger.info(
      `Enhanced transcription received successfully. ` +
      `Confidence: ${response.data.confidence?.toFixed(2) || 'N/A'}, ` +
      `Language: ${response.data.detected_language_code || 'N/A'}, ` +
      `Alternatives: ${response.data.alternatives?.length || 0}`
    );
    
    return this._processTranscriptionResponse(response.data);
  }

  /**
   * Create FormData for the transcription request
   */
  private async _createFormData(audioFilePath: string): Promise<FormData> {
    const formData = new FormData();
    
    if (Platform.OS === 'web') {
      logger.info('Web platform detected, fetching blob data...');
      const response = await fetch(audioFilePath);
      const blob = await response.blob();
      const fileName = `recording-${Date.now()}.wav`;
      
      formData.append('file', new File([blob], fileName, { 
        type: blob.type || 'audio/wav'
      }));
      
      logger.info(`Appended blob to FormData: ${fileName}, type: ${blob.type || 'audio/wav'}, size: ${blob.size}`);
    } else {
      // Native platform handling
      const fileInfo = await FileSystem.getInfoAsync(audioFilePath);
      if (!fileInfo.exists) {
        throw this._createTranscriptionError({
          type: 'validation',
          message: `Audio file not found: ${audioFilePath}`
        });
      }

      const uri = fileInfo.uri;
      const fileExtension = uri.split('.').pop()?.toLowerCase();
      const fileType = this._getAudioMimeType(fileExtension);
      const fileName = uri.split('/').pop() || `recording-${Date.now()}.${fileExtension}`;
      
      // For React Native, we need to use the specific format for file uploads
      (formData as any).append('file', {
        uri,
        name: fileName,
        type: fileType,
      });
      
      logger.info(`Appended native file to FormData: ${fileName}, type: ${fileType}`);
    }
    
    return formData;
  }

  /**
   * Get MIME type for audio file extension
   */
  private _getAudioMimeType(extension?: string): string {
    switch (extension) {
      case 'm4a': return 'audio/m4a';
      case 'mp3': return 'audio/mpeg';
      case 'wav': return 'audio/wav';
      case 'aac': return 'audio/aac';
      case 'ogg': return 'audio/ogg';
      case 'flac': return 'audio/flac';
      default: return 'audio/wav';
    }
  }

  /**
   * Process and validate transcription response
   */
  private _processTranscriptionResponse(data: any): TranscriptionResult {
    // Ensure all required fields are present with defaults
    const processedResult: TranscriptionResult = {
      transcript: data.transcript || '',
      detected_language_code: data.detected_language_code || undefined,
      confidence: typeof data.confidence === 'number' ? data.confidence : 0.0,
      alternatives: Array.isArray(data.alternatives) ? data.alternatives : [],
      word_confidence: Array.isArray(data.word_confidence) ? data.word_confidence : [],
      language_confidence: typeof data.language_confidence === 'number' ? data.language_confidence : 0.0,
      quality_metrics: {
        average_confidence: data.quality_metrics?.average_confidence || 0.0,
        low_confidence_words: data.quality_metrics?.low_confidence_words || 0,
        total_words: data.quality_metrics?.total_words || 0,
        ...data.quality_metrics
      },
      hidden_mode_activated: Boolean(data.hidden_mode_activated)
    };

    // Log quality metrics
    logger.info(
      `Transcription quality metrics - ` +
      `Avg confidence: ${processedResult.quality_metrics.average_confidence.toFixed(2)}, ` +
      `Low confidence words: ${processedResult.quality_metrics.low_confidence_words}/${processedResult.quality_metrics.total_words}, ` +
      `Language confidence: ${processedResult.language_confidence.toFixed(2)}`
    );

    return processedResult;
  }

  /**
   * Retry transcription with token refresh
   */
  private async _retryWithTokenRefresh(
    audioFilePath: string, 
    languageCodes?: string[]
  ): Promise<TranscriptionResult> {
    try {
      // Get refresh token
      const refreshToken = await AsyncStorage.getItem('refresh_token');
      if (!refreshToken) {
        throw this._createTranscriptionError({
          type: 'authentication',
          message: 'No refresh token available for retry'
        });
      }
      
      // Manual token refresh
      const refreshResponse = await axios.post(
        'http://localhost:8001/api/auth/refresh',
        { refresh_token: refreshToken }
      );
      
      if (!refreshResponse.data.access_token) {
        throw this._createTranscriptionError({
          type: 'authentication',
          message: 'Token refresh failed - invalid response'
        });
      }
      
      // Save new tokens
      const newToken = refreshResponse.data.access_token;
      await AsyncStorage.setItem('access_token', newToken);
      if (refreshResponse.data.refresh_token) {
        await AsyncStorage.setItem('refresh_token', refreshResponse.data.refresh_token);
      }
      
      // Update global defaults
      axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      
      logger.info('Token refreshed successfully, retrying transcription...');
      
      // Retry with new token
      return await this._performTranscription(audioFilePath, languageCodes);
    } 
    catch (refreshOrRetryError: any) {
      const retryErrorMessage = refreshOrRetryError.message || 'Unknown refresh/retry error';
      logger.error('Token refresh or retry failed', { error: refreshOrRetryError });
      throw this._createTranscriptionError({
        type: 'authentication',
        message: `Transcription retry failed: ${retryErrorMessage}`
      });
    }
  }

  /**
   * Create standardized transcription error
   */
  private _createTranscriptionError(error: any): TranscriptionError {
    if (error.type && error.message) {
      return error; // Already a TranscriptionError
    }

    let errorType: TranscriptionError['type'] = 'unknown';
    let errorMessage = 'Unknown transcription error';

    if (error.response) {
      // HTTP error response
      const status = error.response.status;
      const detail = error.response.data?.detail || error.response.statusText;
      
      if (status === 401) {
        errorType = 'authentication';
        errorMessage = 'Authentication failed';
      } else if (status === 422) {
        errorType = 'validation';
        errorMessage = detail || 'Validation error';
      } else if (status >= 500) {
        errorType = 'server';
        errorMessage = detail || 'Server error';
      } else {
        errorType = 'network';
        errorMessage = detail || `HTTP ${status} error`;
      }
    } else if (error.request) {
      // Network error
      errorType = 'network';
      errorMessage = 'Network error - unable to reach server';
    } else {
      // Other error
      errorMessage = error.message || 'Unknown error occurred';
    }

    return {
      type: errorType,
      message: errorMessage,
      details: error.response?.data || error
    };
  }

  /**
   * Get transcription quality assessment
   */
  public getQualityAssessment(result: TranscriptionResult): {
    overall: 'excellent' | 'good' | 'fair' | 'poor';
    confidence: number;
    recommendations: string[];
  } {
    const confidence = result.confidence;
    const lowConfidenceRatio = result.quality_metrics.total_words > 0 
      ? result.quality_metrics.low_confidence_words / result.quality_metrics.total_words 
      : 0;

    let overall: 'excellent' | 'good' | 'fair' | 'poor';
    const recommendations: string[] = [];

    if (confidence >= 0.9 && lowConfidenceRatio < 0.1) {
      overall = 'excellent';
    } else if (confidence >= 0.8 && lowConfidenceRatio < 0.2) {
      overall = 'good';
    } else if (confidence >= 0.7 && lowConfidenceRatio < 0.3) {
      overall = 'fair';
      recommendations.push('Consider speaking more clearly for better accuracy');
    } else {
      overall = 'poor';
      recommendations.push('Try speaking more slowly and clearly');
      recommendations.push('Ensure you are in a quiet environment');
      if (result.alternatives.length > 0) {
        recommendations.push('Check alternative transcriptions below');
      }
    }

    if (lowConfidenceRatio > 0.2) {
      recommendations.push('Some words had low confidence - review the transcript carefully');
    }

    if (!result.detected_language_code) {
      recommendations.push('Language detection failed - try selecting specific languages');
    }

    return {
      overall,
      confidence,
      recommendations
    };
  }
}

// Export singleton instance
const speechToTextService = new SpeechToTextService();
export default speechToTextService; 