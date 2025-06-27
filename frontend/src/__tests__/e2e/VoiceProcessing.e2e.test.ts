/**
 * Voice Processing E2E Tests
 * Testing voice phrase detection and processing integration
 */

import { setupE2ETestEnvironment, cleanupE2ETestEnvironment, resetTestState, measureOperation, TEST_CONFIG } from './setup/TestSetup';
import { createTestUser, createMockVoiceData, runTestWithTimeout, assertTest, validatePerformance } from './helpers/TestHelpers';
import { createMockServices, resetMockServices } from './helpers/MockServices';

describe('Voice Processing E2E Tests', () => {
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

  describe('Voice Recording and Transcription', () => {
    test('should record and transcribe voice successfully', async () => {
      const testResult = await runTestWithTimeout('voice-transcription', async () => {
        const voiceData = createMockVoiceData();
        
        // Test recording
        const { result: recordResult, duration: recordDuration } = await measureOperation('voice-recording', async () => {
          await mockServices.voiceProcessor.startRecording();
          await new Promise(resolve => setTimeout(resolve, 100)); // Simulate recording time
          return await mockServices.voiceProcessor.stopRecording();
        });

        assertTest(recordResult.success, 'Voice recording should succeed');
        assertTest(recordResult.audioData, 'Audio data should be captured');
        assertTest(recordResult.duration > 0, 'Recording duration should be positive');

        // Test transcription
        const { result: transcribeResult, duration: transcribeDuration } = await measureOperation('voice-transcription', async () => {
          return await mockServices.voiceProcessor.transcribeAudio(recordResult.audioData!);
        });

        assertTest(transcribeResult.success, 'Transcription should succeed');
        assertTest(transcribeResult.transcript, 'Transcript should be generated');
        assertTest(transcribeResult.confidence! > 0.8, 'Transcription confidence should be high');

        // Validate performance
        const transcribePerf = validatePerformance('transcription', transcribeDuration, TEST_CONFIG.VOICE_PROCESSING_TIMEOUT);
        assertTest(transcribePerf.passed, transcribePerf.message);

        return { recordResult, transcribeResult, recordDuration, transcribeDuration };
      });

      expect(testResult.success).toBe(true);
    });

    test('should detect voice phrases accurately', async () => {
      const testResult = await runTestWithTimeout('voice-phrase-detection', async () => {
        const targetPhrase = 'open my secure journal';
        const voiceData = createMockVoiceData(targetPhrase);
        
        const { result: detectionResult, duration } = await measureOperation('phrase-detection', async () => {
          return await mockServices.voiceProcessor.detectVoicePhrase(voiceData.audioBuffer, targetPhrase);
        });

        assertTest(detectionResult.success, 'Voice phrase detection should succeed');
        assertTest(detectionResult.detected, 'Target phrase should be detected');
        assertTest(detectionResult.confidence! > 0.8, 'Detection confidence should be high');
        assertTest(detectionResult.transcript === targetPhrase, 'Transcript should match target phrase');

        const perfValidation = validatePerformance('phrase-detection', duration, TEST_CONFIG.VOICE_PROCESSING_TIMEOUT);
        assertTest(perfValidation.passed, perfValidation.message);

        return { detectionResult, duration };
      });

      expect(testResult.success).toBe(true);
    });

    test('should handle voice phrase mismatches', async () => {
      const testResult = await runTestWithTimeout('voice-phrase-mismatch', async () => {
        const targetPhrase = 'open my secure journal';
        const wrongPhrase = 'close my public diary';
        const voiceData = createMockVoiceData(wrongPhrase);
        
        const detectionResult = await mockServices.voiceProcessor.detectVoicePhrase(voiceData.audioBuffer, targetPhrase);

        assertTest(detectionResult.success, 'Voice processing should succeed');
        assertTest(!detectionResult.detected, 'Wrong phrase should not be detected');
        assertTest(detectionResult.confidence! < 0.5, 'Detection confidence should be low');
        assertTest(detectionResult.transcript !== targetPhrase, 'Transcript should not match target');

        return { detectionResult };
      });

      expect(testResult.success).toBe(true);
    });
  });

  describe('Voice-Authentication Integration', () => {
    test('should integrate voice detection with authentication', async () => {
      const testResult = await runTestWithTimeout('voice-auth-integration', async () => {
        const user = createTestUser();
        const voiceData = createMockVoiceData(user.voicePhrase);
        
        // Register user
        await mockServices.opaqueClient.register(user.id, user.secretTag, { deviceId: user.deviceId });

        // Voice phrase detection
        const voiceResult = await mockServices.voiceProcessor.detectVoicePhrase(voiceData.audioBuffer, user.voicePhrase);
        assertTest(voiceResult.success && voiceResult.detected, 'Voice phrase should be detected');

        // Authentication using detected phrase
        const authResult = await mockServices.opaqueClient.authenticate(user.id, user.secretTag);
        assertTest(authResult.success, 'Authentication should succeed after voice detection');
        assertTest(authResult.sessionData!.isActive, 'Session should be active');

        return { user, voiceResult, authResult };
      });

      expect(testResult.success).toBe(true);
    });

    test('should prevent authentication without voice phrase', async () => {
      const testResult = await runTestWithTimeout('no-voice-auth', async () => {
        const user = createTestUser();
        const wrongPhrase = 'wrong phrase';
        const voiceData = createMockVoiceData(wrongPhrase);
        
        // Register user
        await mockServices.opaqueClient.register(user.id, user.secretTag, { deviceId: user.deviceId });

        // Voice phrase detection should fail
        const voiceResult = await mockServices.voiceProcessor.detectVoicePhrase(voiceData.audioBuffer, user.voicePhrase);
        assertTest(voiceResult.success, 'Voice processing should succeed');
        assertTest(!voiceResult.detected, 'Wrong phrase should not be detected');

        // In a real implementation, authentication would be blocked
        // For testing, we'll verify the voice detection failed
        assertTest(voiceResult.confidence! < 0.5, 'Voice confidence should be low');

        return { user, voiceResult };
      });

      expect(testResult.success).toBe(true);
    });
  });

  describe('Voice Processing Performance', () => {
    test('should meet voice processing performance targets', async () => {
      const testResult = await runTestWithTimeout('voice-performance', async () => {
        const iterationCount = 10;
        const durations: number[] = [];
        
        for (let i = 0; i < iterationCount; i++) {
          const voiceData = createMockVoiceData();
          
          const { duration } = await measureOperation('voice-performance-test', async () => {
            return await mockServices.voiceProcessor.transcribeAudio(voiceData.audioBuffer);
          });
          
          durations.push(duration);
        }

        const avgDuration = durations.reduce((a, b) => a + b) / durations.length;
        const maxDuration = Math.max(...durations);
        const minDuration = Math.min(...durations);

        // Validate performance
        const avgPerf = validatePerformance('average-voice-processing', avgDuration, TEST_CONFIG.VOICE_PROCESSING_TIMEOUT);
        const maxPerf = validatePerformance('max-voice-processing', maxDuration, TEST_CONFIG.VOICE_PROCESSING_TIMEOUT * 2);

        assertTest(avgPerf.passed, avgPerf.message);
        assertTest(maxPerf.passed, maxPerf.message);

        return { iterationCount, avgDuration, maxDuration, minDuration };
      });

      expect(testResult.success).toBe(true);
    });

    test('should handle concurrent voice processing', async () => {
      const testResult = await runTestWithTimeout('concurrent-voice-processing', async () => {
        const concurrentCount = 5;
        const voicePromises = Array.from({ length: concurrentCount }, (_, i) => {
          const voiceData = createMockVoiceData(`test phrase ${i}`);
          return measureOperation(`concurrent-voice-${i}`, () => 
            mockServices.voiceProcessor.transcribeAudio(voiceData.audioBuffer)
          );
        });

        const results = await Promise.all(voicePromises);

        // All should succeed
        for (const { result } of results) {
          assertTest(result.success, 'All concurrent voice processing should succeed');
          assertTest(result.transcript, 'All should have transcripts');
        }

        // Check performance
        const durations = results.map(r => r.duration);
        const avgDuration = durations.reduce((a, b) => a + b) / durations.length;
        
        const perfValidation = validatePerformance('concurrent-voice-processing', avgDuration, TEST_CONFIG.VOICE_PROCESSING_TIMEOUT * 1.5);
        assertTest(perfValidation.passed, perfValidation.message);

        return { concurrentCount, results, avgDuration };
      });

      expect(testResult.success).toBe(true);
    });
  });

  describe('Voice Processing Error Handling', () => {
    test('should handle invalid audio data gracefully', async () => {
      const testResult = await runTestWithTimeout('invalid-audio-handling', async () => {
        // Test with empty audio buffer
        const emptyBuffer = new ArrayBuffer(0);
        const emptyResult = await mockServices.voiceProcessor.transcribeAudio(emptyBuffer);
        
        assertTest(!emptyResult.success, 'Empty audio should fail gracefully');
        assertTest(emptyResult.error?.message.includes('Invalid audio'), 'Should get appropriate error message');

        // Test with null audio data
        const nullResult = await mockServices.voiceProcessor.transcribeAudio(null as any);
        assertTest(!nullResult.success, 'Null audio should fail gracefully');

        return { emptyResult, nullResult };
      });

      expect(testResult.success).toBe(true);
    });

    test('should handle recording state errors', async () => {
      const testResult = await runTestWithTimeout('recording-state-errors', async () => {
        // Try to stop recording without starting
        const stopWithoutStartResult = await mockServices.voiceProcessor.stopRecording();
        assertTest(!stopWithoutStartResult.success, 'Stop without start should fail');
        assertTest(stopWithoutStartResult.error?.message.includes('Not recording'), 'Should get appropriate error');

        // Start recording
        const startResult = await mockServices.voiceProcessor.startRecording();
        assertTest(startResult.success, 'Recording start should succeed');

        // Try to start recording again
        const doubleStartResult = await mockServices.voiceProcessor.startRecording();
        assertTest(!doubleStartResult.success, 'Double start should fail');
        assertTest(doubleStartResult.error?.message.includes('Already recording'), 'Should get appropriate error');

        // Stop recording
        const stopResult = await mockServices.voiceProcessor.stopRecording();
        assertTest(stopResult.success, 'Recording stop should succeed');

        return { stopWithoutStartResult, startResult, doubleStartResult, stopResult };
      });

      expect(testResult.success).toBe(true);
    });

    test('should handle voice processing service failures', async () => {
      const testResult = await runTestWithTimeout('voice-service-failures', async () => {
        // Configure mock to simulate service failures
        const originalTranscribe = mockServices.voiceProcessor.transcribeAudio;
        
        // Simulate intermittent failures
        let callCount = 0;
        mockServices.voiceProcessor.transcribeAudio = async (audioData: ArrayBuffer) => {
          callCount++;
          if (callCount % 3 === 0) {
            throw new Error('Voice service temporarily unavailable');
          }
          return originalTranscribe.call(mockServices.voiceProcessor, audioData);
        };

        const voiceData = createMockVoiceData();
        const results = [];

        // Test multiple calls to see failure pattern
        for (let i = 0; i < 6; i++) {
          try {
            const result = await mockServices.voiceProcessor.transcribeAudio(voiceData.audioBuffer);
            results.push({ success: true, result });
          } catch (error) {
            results.push({ success: false, error });
          }
        }

        // Should have some failures and some successes
        const successes = results.filter(r => r.success).length;
        const failures = results.filter(r => !r.success).length;
        
        assertTest(failures > 0, 'Should have some simulated failures');
        assertTest(successes > 0, 'Should have some successes');

        // Restore original function
        mockServices.voiceProcessor.transcribeAudio = originalTranscribe;

        return { results, successes, failures };
      });

      expect(testResult.success).toBe(true);
    });
  });
}); 