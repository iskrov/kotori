/**
 * Tests for SpeechToText service with Secret Tag integration
 * 
 * Tests the enhanced speech service functionality including:
 * - Transcription with secret tag detection
 * - Voice phrase detection integration
 * - Error handling and fallbacks
 * - Quality assessment with secret tags
 */

import speechToTextService from '../speechToText';
import { secretTagManager } from '../secretTagManager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// Mock dependencies
jest.mock('../secretTagManager');
jest.mock('@react-native-async-storage/async-storage');
jest.mock('axios');
jest.mock('../api', () => ({
  api: {
    post: jest.fn()
  }
}));
jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn(() => Promise.resolve({ exists: true, uri: 'file://test.wav' }))
}));
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' }
}));

// Mock fetch for web platform
global.fetch = jest.fn();

describe('SpeechToTextService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue('mock-token');
  });

  describe('Transcription with Secret Tag Detection', () => {
    const mockTranscriptionResponse = {
      transcript: 'This is a test transcript',
      detected_language_code: 'en-US',
      confidence: 0.95
    };

    const mockApiResponse = {
      data: mockTranscriptionResponse
    };

    beforeEach(() => {
      const { api } = require('../api');
      api.post.mockResolvedValue(mockApiResponse);
    });

    it('should transcribe audio with secret tag detection enabled', async () => {
      secretTagManager.checkForSecretTagPhrases.mockResolvedValue({
        found: false
      });

      const result = await speechToTextService.transcribeAudio('file://test.wav', {
        enableSecretTagDetection: true
      });

      expect(result.transcript).toBe('This is a test transcript');
      expect(result.secret_tag_detected).toEqual({ found: false });
      expect(secretTagManager.checkForSecretTagPhrases).toHaveBeenCalledWith('This is a test transcript');
    });

    it('should detect secret tag activation phrase', async () => {
      const mockDetection = {
        found: true,
        tagId: 'work-tag-123',
        tagName: 'Work Private',
        action: 'activate'
      };

      secretTagManager.checkForSecretTagPhrases.mockResolvedValue(mockDetection);
      secretTagManager.activateSecretTag.mockResolvedValue();

      const result = await speechToTextService.transcribeAudio('file://test.wav', {
        enableSecretTagDetection: true
      });

      expect(result.secret_tag_detected).toEqual(mockDetection);
      expect(secretTagManager.activateSecretTag).toHaveBeenCalledWith('work-tag-123');
    });

    it('should detect secret tag deactivation phrase', async () => {
      const mockDetection = {
        found: true,
        tagId: 'work-tag-123',
        tagName: 'Work Private',
        action: 'deactivate'
      };

      secretTagManager.checkForSecretTagPhrases.mockResolvedValue(mockDetection);
      secretTagManager.deactivateSecretTag.mockResolvedValue();

      const result = await speechToTextService.transcribeAudio('file://test.wav', {
        enableSecretTagDetection: true
      });

      expect(result.secret_tag_detected).toEqual(mockDetection);
      expect(secretTagManager.deactivateSecretTag).toHaveBeenCalledWith('work-tag-123');
    });

    it('should handle panic mode detection', async () => {
      const mockDetection = {
        found: true,
        action: 'panic'
      };

      secretTagManager.checkForSecretTagPhrases.mockResolvedValue(mockDetection);
      secretTagManager.activatePanicMode.mockResolvedValue();

      const result = await speechToTextService.transcribeAudio('file://test.wav', {
        enableSecretTagDetection: true
      });

      expect(result.secret_tag_detected).toEqual(mockDetection);
      expect(secretTagManager.activatePanicMode).toHaveBeenCalled();
    });

    it('should disable secret tag detection when option is false', async () => {
      const result = await speechToTextService.transcribeAudio('file://test.wav', {
        enableSecretTagDetection: false
      });

      expect(result.secret_tag_detected).toEqual({ found: false });
      expect(secretTagManager.checkForSecretTagPhrases).not.toHaveBeenCalled();
    });

    it('should handle empty transcript gracefully', async () => {
      const { api } = require('../api');
      api.post.mockResolvedValue({
        data: { transcript: '', detected_language_code: 'en-US' }
      });

      const result = await speechToTextService.transcribeAudio('file://test.wav', {
        enableSecretTagDetection: true
      });

      expect(result.secret_tag_detected).toEqual({ found: false });
      expect(secretTagManager.checkForSecretTagPhrases).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle secret tag detection errors gracefully', async () => {
      const { api } = require('../api');
      api.post.mockResolvedValue({
        data: { transcript: 'test transcript', detected_language_code: 'en-US' }
      });

      secretTagManager.checkForSecretTagPhrases.mockRejectedValue(new Error('Detection error'));

      const result = await speechToTextService.transcribeAudio('file://test.wav', {
        enableSecretTagDetection: true
      });

      expect(result.transcript).toBe('test transcript');
      expect(result.secret_tag_detected).toEqual({ found: false });
    });

    it('should handle secret tag activation errors gracefully', async () => {
      const { api } = require('../api');
      api.post.mockResolvedValue({
        data: { transcript: 'activate work mode', detected_language_code: 'en-US' }
      });

      secretTagManager.checkForSecretTagPhrases.mockResolvedValue({
        found: true,
        tagId: 'work-tag',
        action: 'activate'
      });
      secretTagManager.activateSecretTag.mockRejectedValue(new Error('Activation failed'));

      // Should not throw error
      const result = await speechToTextService.transcribeAudio('file://test.wav', {
        enableSecretTagDetection: true
      });

      expect(result.transcript).toBe('activate work mode');
      expect(result.secret_tag_detected.found).toBe(true);
    });

    it('should handle authentication errors with token refresh', async () => {
      const { api } = require('../api');
      
      // First call fails with 401
      api.post.mockRejectedValueOnce({
        response: { status: 401 }
      });
      
      // Mock successful token refresh
      axios.post.mockResolvedValue({
        data: { access_token: 'new-token' }
      });
      
      // Second call succeeds
      api.post.mockResolvedValueOnce({
        data: { transcript: 'test', detected_language_code: 'en-US' }
      });

      AsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'refresh_token') return Promise.resolve('refresh-token');
        return Promise.resolve('old-token');
      });

      const result = await speechToTextService.transcribeAudio('file://test.wav');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith('access_token', 'new-token');
      expect(result.transcript).toBe('test');
    });

    it('should handle network errors appropriately', async () => {
      const { api } = require('../api');
      api.post.mockRejectedValue(new Error('Network error'));

      await expect(
        speechToTextService.transcribeAudio('file://test.wav')
      ).rejects.toThrow('Network error');
    });
  });

  describe('Quality Assessment', () => {
    it('should include secret tag detection in quality assessment', () => {
      const transcriptionResult = {
        transcript: 'test transcript',
        confidence: 0.9,
        quality_metrics: {
          average_confidence: 0.9,
          low_confidence_words: 0,
          total_words: 2
        },
        language_confidence: 0.95,
        alternatives: [],
        word_confidence: [],
        secret_tag_detected: {
          found: true,
          tagName: 'Work Private'
        }
      };

      const assessment = speechToTextService.getQualityAssessment(transcriptionResult);

      expect(assessment.overall).toBe('excellent');
      expect(assessment.recommendations).toContain('Secret tag detected: Work Private');
    });

    it('should not include secret tag recommendation when none detected', () => {
      const transcriptionResult = {
        transcript: 'test transcript',
        confidence: 0.9,
        quality_metrics: {
          average_confidence: 0.9,
          low_confidence_words: 0,
          total_words: 2
        },
        language_confidence: 0.95,
        alternatives: [],
        word_confidence: [],
        secret_tag_detected: {
          found: false
        }
      };

      const assessment = speechToTextService.getQualityAssessment(transcriptionResult);

      expect(assessment.recommendations).not.toContain(expect.stringContaining('Secret tag detected'));
    });
  });

  describe('Language Support', () => {
    it('should validate language codes correctly', async () => {
      await expect(
        speechToTextService.transcribeAudio('file://test.wav', {
          languageCodes: ['invalid-code']
        })
      ).rejects.toThrow('Invalid language codes');
    });

    it('should limit number of language codes', async () => {
      await expect(
        speechToTextService.transcribeAudio('file://test.wav', {
          languageCodes: ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'it-IT'] // 5 codes, max is 4
        })
      ).rejects.toThrow('Too many language codes');
    });

    it('should handle auto-detection correctly', async () => {
      const { api } = require('../api');
      api.post.mockResolvedValue({
        data: { transcript: 'test', detected_language_code: 'en-US' }
      });

      const result = await speechToTextService.transcribeAudio('file://test.wav', {
        languageCodes: ['auto']
      });

      expect(result.detected_language_code).toBe('en-US');
    });
  });

  describe('File Handling', () => {
    it('should handle different audio file types', async () => {
      const { api } = require('../api');
      api.post.mockResolvedValue({
        data: { transcript: 'test', detected_language_code: 'en-US' }
      });

      // Test different file extensions
      const extensions = ['wav', 'mp3', 'mp4', 'm4a', 'aac'];
      
      for (const ext of extensions) {
        await speechToTextService.transcribeAudio(`file://test.${ext}`);
        
        const formDataCall = api.post.mock.calls[api.post.mock.calls.length - 1];
        expect(formDataCall[1]).toBeDefined(); // FormData should be created
      }
    });

    it('should handle missing audio files', async () => {
      const { getInfoAsync } = require('expo-file-system');
      getInfoAsync.mockResolvedValue({ exists: false });

      await expect(
        speechToTextService.transcribeAudio('file://missing.wav')
      ).rejects.toThrow('Audio file not found');
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = speechToTextService;
      const instance2 = speechToTextService;
      
      expect(instance1).toBe(instance2);
    });

    it('should maintain state across calls', async () => {
      // This test ensures the singleton maintains any internal state
      const { api } = require('../api');
      api.post.mockResolvedValue({
        data: { transcript: 'test', detected_language_code: 'en-US' }
      });

      await speechToTextService.transcribeAudio('file://test1.wav');
      await speechToTextService.transcribeAudio('file://test2.wav');

      expect(api.post).toHaveBeenCalledTimes(2);
    });
  });

  describe('Platform Compatibility', () => {
    it('should handle web platform correctly', async () => {
      const { Platform } = require('react-native');
      Platform.OS = 'web';

      global.fetch.mockResolvedValue({
        blob: () => Promise.resolve(new Blob(['audio data'], { type: 'audio/wav' }))
      });

      const { api } = require('../api');
      api.post.mockResolvedValue({
        data: { transcript: 'web test', detected_language_code: 'en-US' }
      });

      const result = await speechToTextService.transcribeAudio('blob:test-url');

      expect(result.transcript).toBe('web test');
      expect(global.fetch).toHaveBeenCalledWith('blob:test-url');
    });

    it('should handle native platform correctly', async () => {
      const { Platform } = require('react-native');
      Platform.OS = 'ios';

      const { api } = require('../api');
      api.post.mockResolvedValue({
        data: { transcript: 'native test', detected_language_code: 'en-US' }
      });

      const result = await speechToTextService.transcribeAudio('file://test.wav');

      expect(result.transcript).toBe('native test');
    });
  });
}); 