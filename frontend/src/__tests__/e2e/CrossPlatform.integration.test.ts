/**
 * Cross-Platform Integration Tests
 * Testing React Native and Web browser compatibility
 */

import { Platform } from 'react-native';
import { setupE2ETestEnvironment, cleanupE2ETestEnvironment, resetTestState, measureOperation, TEST_CONFIG } from './setup/TestSetup';
import { createTestUser, createMockVoiceData, runTestWithTimeout, assertTest, validatePerformance } from './helpers/TestHelpers';
import { createMockServices, resetMockServices } from './helpers/MockServices';

describe('Cross-Platform Integration Tests', () => {
  let testState: any;
  let mockServices: any;

  beforeAll(async () => {
    testState = await setupE2ETestEnvironment();
    mockServices = createMockServices();
  });

  afterAll(async () => {
    await cleanupE2ETestEnvironment();
  });

  beforeEach(async () => {
    await resetTestState();
    resetMockServices(mockServices);
  });

  describe('Platform Detection and Compatibility', () => {
    test('should detect platform correctly', async () => {
      const testResult = await runTestWithTimeout('platform-detection', async () => {
        const platformInfo = {
          os: Platform.OS,
          version: Platform.Version,
          isWeb: Platform.OS === 'web',
          isMobile: Platform.OS === 'ios' || Platform.OS === 'android',
          isPlatformSupported: ['web', 'ios', 'android'].includes(Platform.OS)
        };

        assertTest(platformInfo.isPlatformSupported, 'Platform should be supported');
        assertTest(typeof platformInfo.os === 'string', 'Platform OS should be detected');

        return platformInfo;
      });

      expect(testResult.success).toBe(true);
      expect(testResult.data.isPlatformSupported).toBe(true);
    });

    test('should handle platform-specific features gracefully', async () => {
      const testResult = await runTestWithTimeout('platform-specific-features', async () => {
        const featureSupport = {
          webCrypto: typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined',
          navigator: typeof navigator !== 'undefined',
          localStorage: typeof localStorage !== 'undefined',
          asyncStorage: true, // Always available via React Native AsyncStorage
          mediaDevices: typeof navigator !== 'undefined' && navigator.mediaDevices !== undefined,
          speechSynthesis: typeof speechSynthesis !== 'undefined'
        };

        // Platform-specific validations
        if (Platform.OS === 'web') {
          assertTest(featureSupport.webCrypto, 'Web Crypto API should be available on web');
          assertTest(featureSupport.localStorage, 'LocalStorage should be available on web');
        } else {
          // Mobile platforms
          assertTest(featureSupport.asyncStorage, 'AsyncStorage should be available on mobile');
        }

        // Common features
        assertTest(featureSupport.webCrypto, 'Crypto should be available on all platforms');

        return featureSupport;
      });

      expect(testResult.success).toBe(true);
    });
  });

  describe('OPAQUE Authentication Cross-Platform', () => {
    test('should work consistently across platforms', async () => {
      const testResult = await runTestWithTimeout('cross-platform-opaque', async () => {
        const user = createTestUser({
          id: `cross-platform-user-${Platform.OS}`,
          secretTag: 'cross-platform-secret'
        });

        // Test registration
        const { result: regResult, duration: regDuration } = await measureOperation(
          `opaque-registration-${Platform.OS}`,
          async () => {
            return await mockServices.opaqueClient.register(
              user.id,
              user.secretTag,
              { 
                deviceId: user.deviceId,
                platform: Platform.OS,
                platformVersion: Platform.Version
              }
            );
          }
        );

        assertTest(regResult.success, 'Registration should succeed on all platforms');
        assertTest(regResult.registrationData, 'Registration data should be returned');

        // Test authentication
        const { result: authResult, duration: authDuration } = await measureOperation(
          `opaque-authentication-${Platform.OS}`,
          async () => {
            return await mockServices.opaqueClient.authenticate(user.id, user.secretTag);
          }
        );

        assertTest(authResult.success, 'Authentication should succeed on all platforms');
        assertTest(authResult.sessionData, 'Session data should be returned');

        // Validate performance is consistent across platforms
        const regPerf = validatePerformance('registration', regDuration, TEST_CONFIG.AUTHENTICATION_TIMEOUT);
        const authPerf = validatePerformance('authentication', authDuration, TEST_CONFIG.AUTHENTICATION_TIMEOUT);

        assertTest(regPerf.passed, `Registration performance should meet targets on ${Platform.OS}`);
        assertTest(authPerf.passed, `Authentication performance should meet targets on ${Platform.OS}`);

        return {
          platform: Platform.OS,
          user,
          registration: regResult,
          authentication: authResult,
          performance: { regDuration, authDuration }
        };
      });

      expect(testResult.success).toBe(true);
    });

    test('should handle platform-specific cryptographic operations', async () => {
      const testResult = await runTestWithTimeout('cross-platform-crypto', async () => {
        const user = createTestUser();
        
        // Register user
        await mockServices.opaqueClient.register(user.id, user.secretTag, { deviceId: user.deviceId });
        const authResult = await mockServices.opaqueClient.authenticate(user.id, user.secretTag);

        // Test encryption/decryption
        const testContent = 'Cross-platform test content for encryption';
        
        const { result: encryptResult, duration: encryptDuration } = await measureOperation(
          `encryption-${Platform.OS}`,
          async () => {
            return await mockServices.encryptionService.encryptContent(
              testContent,
              authResult.sessionData!
            );
          }
        );

        assertTest(encryptResult.success, 'Encryption should work on all platforms');
        assertTest(encryptResult.encryptedEntry, 'Encrypted entry should be created');

        const { result: decryptResult, duration: decryptDuration } = await measureOperation(
          `decryption-${Platform.OS}`,
          async () => {
            return await mockServices.encryptionService.decryptContent(
              encryptResult.encryptedEntry!.id,
              authResult.sessionData!
            );
          }
        );

        assertTest(decryptResult.success, 'Decryption should work on all platforms');
        assertTest(decryptResult.content === testContent, 'Decrypted content should match original');

        // Validate crypto performance
        const encryptPerf = validatePerformance('encryption', encryptDuration, TEST_CONFIG.ENCRYPTION_TIMEOUT);
        const decryptPerf = validatePerformance('decryption', decryptDuration, TEST_CONFIG.ENCRYPTION_TIMEOUT);

        assertTest(encryptPerf.passed, `Encryption performance should meet targets on ${Platform.OS}`);
        assertTest(decryptPerf.passed, `Decryption performance should meet targets on ${Platform.OS}`);

        return {
          platform: Platform.OS,
          encryption: encryptResult,
          decryption: decryptResult,
          performance: { encryptDuration, decryptDuration }
        };
      });

      expect(testResult.success).toBe(true);
    });
  });

  describe('Voice Processing Cross-Platform', () => {
    test('should handle audio processing consistently', async () => {
      const testResult = await runTestWithTimeout('cross-platform-voice', async () => {
        const voicePhrase = 'cross platform voice test';
        const voiceData = createMockVoiceData(voicePhrase);

        // Test voice recording
        const { result: recordResult, duration: recordDuration } = await measureOperation(
          `voice-recording-${Platform.OS}`,
          async () => {
            await mockServices.voiceProcessor.startRecording();
            await new Promise(resolve => setTimeout(resolve, 100));
            return await mockServices.voiceProcessor.stopRecording();
          }
        );

        assertTest(recordResult.success, 'Voice recording should work on all platforms');
        assertTest(recordResult.audioData, 'Audio data should be captured');

        // Test transcription
        const { result: transcribeResult, duration: transcribeDuration } = await measureOperation(
          `voice-transcription-${Platform.OS}`,
          async () => {
            return await mockServices.voiceProcessor.transcribeAudio(voiceData.audioBuffer);
          }
        );

        assertTest(transcribeResult.success, 'Voice transcription should work on all platforms');
        assertTest(transcribeResult.transcript, 'Transcript should be generated');

        // Test phrase detection
        const { result: detectionResult, duration: detectionDuration } = await measureOperation(
          `phrase-detection-${Platform.OS}`,
          async () => {
            return await mockServices.voiceProcessor.detectVoicePhrase(voiceData.audioBuffer, voicePhrase);
          }
        );

        assertTest(detectionResult.success, 'Phrase detection should work on all platforms');
        assertTest(detectionResult.detected, 'Phrase should be detected correctly');

        // Validate voice processing performance
        const transcribePerf = validatePerformance('transcription', transcribeDuration, TEST_CONFIG.VOICE_PROCESSING_TIMEOUT);
        const detectionPerf = validatePerformance('detection', detectionDuration, TEST_CONFIG.VOICE_PROCESSING_TIMEOUT);

        assertTest(transcribePerf.passed, `Transcription performance should meet targets on ${Platform.OS}`);
        assertTest(detectionPerf.passed, `Detection performance should meet targets on ${Platform.OS}`);

        return {
          platform: Platform.OS,
          recording: recordResult,
          transcription: transcribeResult,
          detection: detectionResult,
          performance: { recordDuration, transcribeDuration, detectionDuration }
        };
      });

      expect(testResult.success).toBe(true);
    });

    test('should handle platform-specific audio formats', async () => {
      const testResult = await runTestWithTimeout('cross-platform-audio-formats', async () => {
        // Simulate different audio formats for different platforms
        const audioFormats = {
          web: { format: 'webm', mimeType: 'audio/webm;codecs=opus' },
          ios: { format: 'm4a', mimeType: 'audio/mp4' },
          android: { format: 'mp4', mimeType: 'audio/mp4' }
        };

        const currentFormat = audioFormats[Platform.OS as keyof typeof audioFormats] || audioFormats.web;
        
        // Create mock audio data with platform-specific format
        const mockAudioData = new ArrayBuffer(1024);
        const mockMetadata = {
          format: currentFormat.format,
          mimeType: currentFormat.mimeType,
          duration: 1500,
          sampleRate: 44100,
          platform: Platform.OS
        };

        // Test transcription with platform-specific format
        const transcribeResult = await mockServices.voiceProcessor.transcribeAudio(
          mockAudioData,
          { format: mockMetadata.format, mimeType: mockMetadata.mimeType }
        );

        assertTest(transcribeResult.success, 'Should handle platform-specific audio formats');
        
        return {
          platform: Platform.OS,
          supportedFormat: currentFormat,
          transcriptionResult: transcribeResult
        };
      });

      expect(testResult.success).toBe(true);
    });
  });

  describe('Storage Cross-Platform', () => {
    test('should handle storage consistently across platforms', async () => {
      const testResult = await runTestWithTimeout('cross-platform-storage', async () => {
        const testKey = 'cross-platform-test-key';
        const testData = {
          platform: Platform.OS,
          timestamp: Date.now(),
          testContent: 'Cross-platform storage test data'
        };

        // Test storage operations
        const setResult = await mockServices.storage.setItem(testKey, JSON.stringify(testData));
        assertTest(setResult.success, 'Storage set should work on all platforms');

        const getResult = await mockServices.storage.getItem(testKey);
        assertTest(getResult.success, 'Storage get should work on all platforms');
        assertTest(getResult.data, 'Stored data should be retrievable');

        const retrievedData = JSON.parse(getResult.data);
        assertTest(retrievedData.platform === Platform.OS, 'Retrieved data should match stored data');
        assertTest(retrievedData.testContent === testData.testContent, 'Content should be preserved');

        // Test storage removal
        const removeResult = await mockServices.storage.removeItem(testKey);
        assertTest(removeResult.success, 'Storage removal should work on all platforms');

        // Verify removal
        const getAfterRemoveResult = await mockServices.storage.getItem(testKey);
        assertTest(getAfterRemoveResult.success, 'Get after remove should succeed');
        assertTest(!getAfterRemoveResult.data, 'Data should be gone after removal');

        return {
          platform: Platform.OS,
          operations: { setResult, getResult, removeResult, getAfterRemoveResult },
          testData
        };
      });

      expect(testResult.success).toBe(true);
    });

    test('should handle secure storage across platforms', async () => {
      const testResult = await runTestWithTimeout('cross-platform-secure-storage', async () => {
        const sensitiveData = {
          userSecret: 'sensitive-user-secret',
          sessionKey: 'mock-session-key-123',
          platform: Platform.OS
        };

        // Test secure storage operations
        const secureSetResult = await mockServices.storage.setSecureItem(
          'secure-test-key',
          JSON.stringify(sensitiveData),
          { requireAuthentication: false } // Disabled for testing
        );

        assertTest(secureSetResult.success, 'Secure storage should work on all platforms');

        const secureGetResult = await mockServices.storage.getSecureItem('secure-test-key');
        assertTest(secureGetResult.success, 'Secure retrieval should work on all platforms');

        if (secureGetResult.data) {
          const retrievedSensitiveData = JSON.parse(secureGetResult.data);
          assertTest(retrievedSensitiveData.userSecret === sensitiveData.userSecret, 'Sensitive data should be preserved');
        }

        return {
          platform: Platform.OS,
          secureOperations: { secureSetResult, secureGetResult },
          sensitiveData
        };
      });

      expect(testResult.success).toBe(true);
    });
  });

  describe('Network Communication Cross-Platform', () => {
    test('should handle API communication consistently', async () => {
      const testResult = await runTestWithTimeout('cross-platform-networking', async () => {
        const testEndpoint = '/api/test/cross-platform';
        const testPayload = {
          platform: Platform.OS,
          timestamp: Date.now(),
          message: 'Cross-platform test request'
        };

        // Test POST request
        const { result: postResult, duration: postDuration } = await measureOperation(
          `network-post-${Platform.OS}`,
          async () => {
            return await mockServices.networkClient.post(testEndpoint, testPayload);
          }
        );

        assertTest(postResult.success, 'POST requests should work on all platforms');

        // Test GET request
        const { result: getResult, duration: getDuration } = await measureOperation(
          `network-get-${Platform.OS}`,
          async () => {
            return await mockServices.networkClient.get(testEndpoint);
          }
        );

        assertTest(getResult.success, 'GET requests should work on all platforms');

        // Validate network performance
        const postPerf = validatePerformance('network-post', postDuration, 1000);
        const getPerf = validatePerformance('network-get', getDuration, 1000);

        assertTest(postPerf.passed, `POST performance should meet targets on ${Platform.OS}`);
        assertTest(getPerf.passed, `GET performance should meet targets on ${Platform.OS}`);

        return {
          platform: Platform.OS,
          requests: { postResult, getResult },
          performance: { postDuration, getDuration }
        };
      });

      expect(testResult.success).toBe(true);
    });

    test('should handle network state changes consistently', async () => {
      const testResult = await runTestWithTimeout('cross-platform-network-state', async () => {
        // Test online state detection
        const initialOnlineState = mockServices.networkClient.isOnline();
        assertTest(typeof initialOnlineState === 'boolean', 'Online state should be detectable');

        // Simulate going offline
        mockServices.networkService.setOnlineStatus(false);
        const offlineState = mockServices.networkClient.isOnline();
        assertTest(offlineState === false, 'Offline state should be detected');

        // Test request failure when offline
        const offlineRequestResult = await mockServices.networkClient.get('/api/test');
        assertTest(!offlineRequestResult.success, 'Requests should fail when offline');

        // Simulate going back online
        mockServices.networkService.setOnlineStatus(true);
        const onlineState = mockServices.networkClient.isOnline();
        assertTest(onlineState === true, 'Online state should be restored');

        return {
          platform: Platform.OS,
          states: { initialOnlineState, offlineState, onlineState },
          offlineRequest: offlineRequestResult
        };
      });

      expect(testResult.success).toBe(true);
    });
  });

  describe('Performance Benchmarks Cross-Platform', () => {
    test('should meet performance targets across platforms', async () => {
      const testResult = await runTestWithTimeout('cross-platform-performance', async () => {
        const user = createTestUser();
        const iterationCount = 5;
        
        const results = {
          platform: Platform.OS,
          registration: [],
          authentication: [],
          encryption: [],
          voiceProcessing: []
        };

        // Run multiple iterations to get statistical data
        for (let i = 0; i < iterationCount; i++) {
          // Registration performance
          const regUserId = `${user.id}-perf-${i}`;
          const { duration: regDuration } = await measureOperation(
            'perf-registration',
            () => mockServices.opaqueClient.register(regUserId, user.secretTag, { deviceId: user.deviceId })
          );
          results.registration.push(regDuration);

          // Authentication performance
          const { duration: authDuration } = await measureOperation(
            'perf-authentication',
            () => mockServices.opaqueClient.authenticate(regUserId, user.secretTag)
          );
          results.authentication.push(authDuration);

          // Get session for encryption test
          const authResult = await mockServices.opaqueClient.authenticate(regUserId, user.secretTag);

          // Encryption performance
          const { duration: encryptDuration } = await measureOperation(
            'perf-encryption',
            () => mockServices.encryptionService.encryptContent('test content', authResult.sessionData!)
          );
          results.encryption.push(encryptDuration);

          // Voice processing performance
          const voiceData = createMockVoiceData();
          const { duration: voiceDuration } = await measureOperation(
            'perf-voice',
            () => mockServices.voiceProcessor.transcribeAudio(voiceData.audioBuffer)
          );
          results.voiceProcessing.push(voiceDuration);
        }

        // Calculate averages and validate
        const benchmarks = {
          registration: {
            avg: results.registration.reduce((a, b) => a + b) / results.registration.length,
            target: TEST_CONFIG.AUTHENTICATION_TIMEOUT
          },
          authentication: {
            avg: results.authentication.reduce((a, b) => a + b) / results.authentication.length,
            target: TEST_CONFIG.AUTHENTICATION_TIMEOUT
          },
          encryption: {
            avg: results.encryption.reduce((a, b) => a + b) / results.encryption.length,
            target: TEST_CONFIG.ENCRYPTION_TIMEOUT
          },
          voiceProcessing: {
            avg: results.voiceProcessing.reduce((a, b) => a + b) / results.voiceProcessing.length,
            target: TEST_CONFIG.VOICE_PROCESSING_TIMEOUT
          }
        };

        // Validate all benchmarks
        for (const [operation, benchmark] of Object.entries(benchmarks)) {
          const validation = validatePerformance(operation, benchmark.avg, benchmark.target);
          assertTest(validation.passed, `${operation} should meet performance targets on ${Platform.OS}: ${validation.message}`);
        }

        return { platform: Platform.OS, results, benchmarks };
      });

      expect(testResult.success).toBe(true);
    });
  });
}); 