import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import logger from '../utils/logger';
// Import the NAMED export 'api' (the axios instance) and alias it
import { api as axiosInstance } from './api';
import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import { validateLanguageCode } from '../config/languageConfig';
import { tagManager } from './tagManager';

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
  secret_tag_detected?: {
    found: boolean;
    tagId?: string;
    tagName?: string;
    action?: 'activate' | 'deactivate' | 'panic';
  };
}

interface TranscriptionOptions {
  languageCodes?: string[]; // Enhanced to support multiple language codes
  maxAlternatives?: number;
  enableWordConfidence?: boolean;
  confidenceThreshold?: number;
  enableSecretTagDetection?: boolean; // Enable secret tag phrase detection
}

interface TranscriptionError {
  type: 'validation' | 'network' | 'server' | 'authentication' | 'unknown';
  message: string;
  details?: any;
}

/**
 * Enhanced Speech-to-Text Service with multi-language support and secret tag detection
 */
class SpeechToTextService {
  private static instance: SpeechToTextService;

  public static getInstance(): SpeechToTextService {
    if (!SpeechToTextService.instance) {
      SpeechToTextService.instance = new SpeechToTextService();
    }
    return SpeechToTextService.instance;
  }

  private readonly maxRetries = 2;
  private readonly retryDelay = 1000; // 1 second

  constructor() {
    logger.info('Enhanced SpeechToTextService initialized for multi-language support');
  }

  /**
   * Enhanced transcription method with multi-language support and secret tag detection
   */
  public async transcribeAudio(
    audioFilePath: string,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult> {
    const { 
      languageCodes, 
      maxAlternatives = 3, 
      enableWordConfidence = true,
      enableSecretTagDetection = true 
    } = options;
    
    logger.info(
      `Requesting enhanced transcription for audio file: ${audioFilePath}, ` +
      `Languages: ${languageCodes ? languageCodes.join(', ') : 'auto-detect'}, ` +
      `Max alternatives: ${maxAlternatives}, ` +
      `Secret tag detection: ${enableSecretTagDetection}`
    );
    
    try {
      // Validate language codes if provided
      if (languageCodes && languageCodes.length > 0) {
        this._validateLanguageCodes(languageCodes);
      }

      // --- First attempt with current token ---
      try {
        return await this._performTranscription(audioFilePath, languageCodes, enableSecretTagDetection);
      } 
      catch (initialError: any) {
        // Handle 401 with manual refresh and retry
        if (initialError.response?.status === 401) {
          logger.info('Got 401, manually refreshing token and retrying...');
          return await this._retryWithTokenRefresh(audioFilePath, languageCodes, enableSecretTagDetection);
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
    languageCodes?: string[],
    enableSecretTagDetection: boolean = true
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
    
    const response = await axiosInstance.post<any>(
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
      `Transcript length: ${response.data.transcript?.length || 0}`
    );
    
    // Process the response and add secret tag detection
    const processedResult = await this._processTranscriptionResponse(response.data, enableSecretTagDetection);
    
    return processedResult;
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
   * Get audio MIME type based on file extension
   */
  private _getAudioMimeType(extension?: string): string {
    const mimeTypes: { [key: string]: string } = {
      'wav': 'audio/wav',
      'mp3': 'audio/mpeg',
      'mp4': 'audio/mp4',
      'm4a': 'audio/mp4',
      'aac': 'audio/aac',
      'ogg': 'audio/ogg',
      'webm': 'audio/webm',
      'flac': 'audio/flac'
    };
    
    return mimeTypes[extension || 'wav'] || 'audio/wav';
  }

  /**
   * Process and validate transcription response with secret tag detection
   */
  private async _processTranscriptionResponse(data: any, enableSecretTagDetection: boolean): Promise<TranscriptionResult> {
    // Ensure all required fields are present with defaults
    const processedResult: TranscriptionResult = {
      transcript: data.transcript || '',
      detected_language_code: data.detected_language_code || undefined,
      confidence: typeof data.confidence === 'number' ? data.confidence : 0.8, // Default confidence
      alternatives: Array.isArray(data.alternatives) ? data.alternatives : [],
      word_confidence: Array.isArray(data.word_confidence) ? data.word_confidence : [],
      language_confidence: typeof data.language_confidence === 'number' ? data.language_confidence : 0.8,
      quality_metrics: {
        average_confidence: data.quality_metrics?.average_confidence || 0.8,
        low_confidence_words: data.quality_metrics?.low_confidence_words || 0,
        total_words: data.quality_metrics?.total_words || 0,
        ...data.quality_metrics
      }
    };

    // Perform secret tag detection if enabled and transcript is available
    if (enableSecretTagDetection && processedResult.transcript.trim()) {
      try {
        logger.info(`[Secret Tag Detection] Starting detection for transcript: "${processedResult.transcript}"`);
        
        // Verify tag manager is initialized
        await tagManager.initialize();
        
        // Get all secret tags to debug
        const allTags = await tagManager.getSecretTags();
        logger.info(`[Secret Tag Detection] Found ${allTags.length} secret tags in storage`);
        
        if (allTags.length > 0) {
          logger.info(`[Secret Tag Detection] Secret tag names: ${allTags.map((t: any) => t.name).join(', ')}`);
        }
        
        const tagDetection = await tagManager.checkForSecretTagPhrases(processedResult.transcript);
        processedResult.secret_tag_detected = tagDetection;
        
        logger.info(`[Secret Tag Detection] Detection result:`, tagDetection);
        
        if (tagDetection.found) {
          logger.info(`Secret tag phrase detected: ${tagDetection.tagName} (${tagDetection.action})`);
          
          // Handle the detected secret tag action
          await this._handleSecretTagDetection(tagDetection);
        } else {
          logger.info(`[Secret Tag Detection] No secret tag phrases detected in: "${processedResult.transcript}"`);
        }
      } catch (error) {
        logger.error('Error during secret tag detection:', error);
        // Don't fail the transcription if secret tag detection fails
        processedResult.secret_tag_detected = { found: false };
      }
    } else {
      processedResult.secret_tag_detected = { found: false };
      
      if (enableSecretTagDetection) {
        logger.info(`[Secret Tag Detection] Skipped - empty transcript`);
      } else {
        logger.info(`[Secret Tag Detection] Disabled`);
      }
    }

    // Log quality metrics
    logger.info(
      `Transcription quality metrics - ` +
      `Avg confidence: ${processedResult.quality_metrics.average_confidence.toFixed(2)}, ` +
      `Low confidence words: ${processedResult.quality_metrics.low_confidence_words}/${processedResult.quality_metrics.total_words}, ` +
      `Language confidence: ${processedResult.language_confidence.toFixed(2)}, ` +
      `Secret tag detected: ${processedResult.secret_tag_detected?.found || false}`
    );

    return processedResult;
  }

  /**
   * Handle secret tag detection results
   */
  private async _handleSecretTagDetection(detection: any): Promise<void> {
    try {
      if (detection.action === 'panic') {
        // Handle panic mode
        logger.warn('Panic mode detected - initiating secure deletion');
        await tagManager.clearSecretCache();
        return;
      }

      if (detection.tagId) {
        if (detection.action === 'activate') {
          await tagManager.activateSecretTag(detection.tagId);
          logger.info(`Secret tag activated: ${detection.tagName}`);
        } else if (detection.action === 'deactivate') {
          await tagManager.deactivateSecretTag(detection.tagId);
          logger.info(`Secret tag deactivated: ${detection.tagName}`);
        }
      }
    } catch (error) {
      logger.error('Failed to handle secret tag detection:', error);
      // Don't throw - this shouldn't fail the transcription
    }
  }

  /**
   * Retry transcription with token refresh
   */
  private async _retryWithTokenRefresh(
    audioFilePath: string, 
    languageCodes?: string[],
    enableSecretTagDetection: boolean = true
  ): Promise<TranscriptionResult> {
    try {
      // Attempt to refresh the token
      const refreshToken = await AsyncStorage.getItem('refresh_token');
      if (!refreshToken) {
        throw this._createTranscriptionError({
          type: 'authentication',
          message: 'No refresh token available for retry'
        });
      }

      logger.info('Attempting to refresh access token...');
      
      // Call refresh endpoint
      const refreshResponse = await axios.post('/api/auth/refresh', {
        refresh_token: refreshToken,
      });

      if (refreshResponse.data.access_token) {
        // Save new token
        await AsyncStorage.setItem('access_token', refreshResponse.data.access_token);
        
        if (refreshResponse.data.refresh_token) {
          await AsyncStorage.setItem('refresh_token', refreshResponse.data.refresh_token);
        }

        logger.info('Token refreshed successfully, retrying transcription...');
        
        // Retry the transcription with new token
        return await this._performTranscription(audioFilePath, languageCodes, enableSecretTagDetection);
      } else {
        throw this._createTranscriptionError({
          type: 'authentication',
          message: 'Token refresh failed - no access token received'
        });
      }
    } catch (refreshError: any) {
      logger.error('Token refresh failed:', refreshError);
      throw this._createTranscriptionError({
        type: 'authentication',
        message: 'Authentication failed and token refresh unsuccessful'
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

    if (result.secret_tag_detected?.found) {
      recommendations.push(`Secret tag detected: ${result.secret_tag_detected.tagName || 'Unknown'}`);
    }

    return {
      overall,
      confidence,
      recommendations
    };
  }
}

// Export singleton instance
const speechToTextService = SpeechToTextService.getInstance();
export default speechToTextService; 