/**
 * OPAQUE Workflow E2E Tests
 * Complete end-to-end testing of the voice-to-encryption workflow
 */

import { 
  setupE2ETestEnvironment, 
  cleanupE2ETestEnvironment, 
  resetTestState,
  measureOperation,
  TEST_CONFIG 
} from './setup/TestSetup';
import { 
  createTestUser, 
  createMockVoiceData, 
  createMockJournalEntry,
  waitForCondition,
  validatePerformance,
  validateMemoryUsage,
  runTestWithTimeout,
  assertTest,
  createTestSummaryReport
} from './helpers/TestHelpers';
import { createMockServices, resetMockServices } from './helpers/MockServices';
import { globalPerformanceMonitor } from './helpers/PerformanceMonitor';

describe('OPAQUE Workflow E2E Tests', () => {
  let testState: any;
  let mockServices: any;

  beforeAll(async () => {
    testState = await setupE2ETestEnvironment();
    mockServices = createMockServices();
    globalPerformanceMonitor.startMonitoring();
  });

  afterAll(async () => {
    globalPerformanceMonitor.stopMonitoring();
    globalPerformanceMonitor.printReport();
    await cleanupE2ETestEnvironment();
  });

  beforeEach(async () => {
    await resetTestState();
    resetMockServices(mockServices);
  });

  describe('Complete User Journey', () => {
    test('should complete full registration and authentication workflow', async () => {
      const testResult = await runTestWithTimeout(
        'complete-user-journey',
        async () => {
          // Step 1: Create test user
          const testUser = createTestUser({
            id: 'journey-user-1',
            secretTag: 'my-secret-journal',
            voicePhrase: 'open my secure journal'
          });

          // Step 2: Register user with OPAQUE
          const { result: registrationResult, duration: regDuration } = await measureOperation(
            'user-registration',
            async () => {
              return await mockServices.opaqueClient.register(
                testUser.id,
                testUser.secretTag,
                { deviceId: testUser.deviceId }
              );
            }
          );

          assertTest(registrationResult.success, 'User registration should succeed');
          assertTest(registrationResult.registrationData, 'Registration data should be returned');

          // Validate registration performance
          const regPerf = validatePerformance('registration', regDuration, TEST_CONFIG.AUTHENTICATION_TIMEOUT);
          assertTest(regPerf.passed, regPerf.message);

          // Step 3: Voice phrase authentication
          const voiceData = createMockVoiceData(testUser.voicePhrase);
          
          const { result: voiceResult, duration: voiceDuration } = await measureOperation(
            'voice-processing',
            async () => {
              return await mockServices.voiceProcessor.detectVoicePhrase(
                voiceData.audioBuffer,
                testUser.voicePhrase
              );
            }
          );

          assertTest(voiceResult.success, 'Voice processing should succeed');
          assertTest(voiceResult.detected, 'Voice phrase should be detected');
          assertTest(voiceResult.confidence! > 0.8, 'Voice confidence should be high');

          // Validate voice processing performance
          const voicePerf = validatePerformance('voice-processing', voiceDuration, TEST_CONFIG.VOICE_PROCESSING_TIMEOUT);
          assertTest(voicePerf.passed, voicePerf.message);

          // Step 4: OPAQUE authentication
          const { result: authResult, duration: authDuration } = await measureOperation(
            'authentication',
            async () => {
              return await mockServices.opaqueClient.authenticate(
                testUser.id,
                testUser.secretTag
              );
            }
          );

          assertTest(authResult.success, 'Authentication should succeed');
          assertTest(authResult.sessionData, 'Session data should be returned');
          assertTest(authResult.sessionData!.isActive, 'Session should be active');

          // Validate authentication performance
          const authPerf = validatePerformance('authentication', authDuration, TEST_CONFIG.AUTHENTICATION_TIMEOUT);
          assertTest(authPerf.passed, authPerf.message);

          // Step 5: Create encrypted journal entry
          const journalEntry = createMockJournalEntry('This is my first secure journal entry');
          
          const { result: encryptResult, duration: encryptDuration } = await measureOperation(
            'encryption',
            async () => {
              return await mockServices.encryptionService.encryptContent(
                journalEntry.content,
                authResult.sessionData!
              );
            }
          );

          assertTest(encryptResult.success, 'Encryption should succeed');
          assertTest(encryptResult.encryptedEntry, 'Encrypted entry should be created');
          assertTest(encryptResult.encryptedEntry!.userId === testUser.id, 'Entry should belong to correct user');

          // Validate encryption performance
          const encryptPerf = validatePerformance('encryption', encryptDuration, TEST_CONFIG.ENCRYPTION_TIMEOUT);
          assertTest(encryptPerf.passed, encryptPerf.message);

          // Step 6: Decrypt and verify entry
          const { result: decryptResult, duration: decryptDuration } = await measureOperation(
            'decryption',
            async () => {
              return await mockServices.encryptionService.decryptContent(
                encryptResult.encryptedEntry!.id,
                authResult.sessionData!
              );
            }
          );

          assertTest(decryptResult.success, 'Decryption should succeed');
          assertTest(decryptResult.content === journalEntry.content, 'Decrypted content should match original');

          // Validate decryption performance
          const decryptPerf = validatePerformance('decryption', decryptDuration, TEST_CONFIG.ENCRYPTION_TIMEOUT);
          assertTest(decryptPerf.passed, decryptPerf.message);

          // Step 7: Session management
          const { result: extendResult, duration: sessionDuration } = await measureOperation(
            'session-management',
            async () => {
              return await mockServices.opaqueClient.extendSession(
                authResult.sessionData!.sessionId,
                TEST_CONFIG.TEST_SESSION_DURATION
              );
            }
          );

          assertTest(extendResult.success, 'Session extension should succeed');
          assertTest(extendResult.sessionData!.expiresAt > Date.now(), 'Session should be extended');

          // Validate session management performance
          const sessionPerf = validatePerformance('session-management', sessionDuration, TEST_CONFIG.SESSION_TIMEOUT);
          assertTest(sessionPerf.passed, sessionPerf.message);

          return {
            user: testUser,
            registration: registrationResult,
            voiceProcessing: voiceResult,
            authentication: authResult,
            encryption: encryptResult,
            decryption: decryptResult,
            sessionManagement: extendResult
          };
        },
        30000 // 30 second timeout
      );

      expect(testResult.success).toBe(true);
      expect(testResult.data).toBeDefined();
      expect(testResult.duration).toBeLessThan(30000);
    });

    test('should handle multiple concurrent users', async () => {
      const testResult = await runTestWithTimeout(
        'concurrent-users',
        async () => {
          const userCount = 3;
          const users = Array.from({ length: userCount }, (_, i) => 
            createTestUser({
              id: `concurrent-user-${i}`,
              secretTag: `secret-${i}`,
              voicePhrase: `open journal ${i}`
            })
          );

          // Register all users concurrently
          const registrationPromises = users.map(user => 
            measureOperation(
              'concurrent-registration',
              () => mockServices.opaqueClient.register(user.id, user.secretTag, { deviceId: user.deviceId })
            )
          );

          const registrationResults = await Promise.all(registrationPromises);

          // Verify all registrations succeeded
          for (const { result } of registrationResults) {
            assertTest(result.success, 'All concurrent registrations should succeed');
          }

          // Authenticate all users concurrently
          const authPromises = users.map(user => 
            measureOperation(
              'concurrent-authentication',
              () => mockServices.opaqueClient.authenticate(user.id, user.secretTag)
            )
          );

          const authResults = await Promise.all(authPromises);

          // Verify all authentications succeeded
          for (const { result } of authResults) {
            assertTest(result.success, 'All concurrent authentications should succeed');
            assertTest(result.sessionData!.isActive, 'All sessions should be active');
          }

          // Create encrypted entries for all users concurrently
          const encryptionPromises = authResults.map((authResult, i) => 
            measureOperation(
              'concurrent-encryption',
              () => mockServices.encryptionService.encryptContent(
                `Journal entry for user ${i}`,
                authResult.result.sessionData!
              )
            )
          );

          const encryptionResults = await Promise.all(encryptionPromises);

          // Verify all encryptions succeeded
          for (const { result } of encryptionResults) {
            assertTest(result.success, 'All concurrent encryptions should succeed');
          }

          return {
            userCount,
            registrations: registrationResults,
            authentications: authResults,
            encryptions: encryptionResults
          };
        },
        45000 // 45 second timeout for concurrent operations
      );

      expect(testResult.success).toBe(true);
      expect(testResult.data.userCount).toBe(3);
    });

    test('should maintain session isolation between users', async () => {
      const testResult = await runTestWithTimeout(
        'session-isolation',
        async () => {
          // Create two users
          const user1 = createTestUser({ id: 'isolation-user-1', secretTag: 'secret-1' });
          const user2 = createTestUser({ id: 'isolation-user-2', secretTag: 'secret-2' });

          // Register both users
          await mockServices.opaqueClient.register(user1.id, user1.secretTag, { deviceId: user1.deviceId });
          await mockServices.opaqueClient.register(user2.id, user2.secretTag, { deviceId: user2.deviceId });

          // Authenticate both users
          const auth1 = await mockServices.opaqueClient.authenticate(user1.id, user1.secretTag);
          const auth2 = await mockServices.opaqueClient.authenticate(user2.id, user2.secretTag);

          assertTest(auth1.success && auth2.success, 'Both authentications should succeed');

          // Create entries for both users
          const entry1 = await mockServices.encryptionService.encryptContent(
            'User 1 private entry',
            auth1.sessionData!
          );
          const entry2 = await mockServices.encryptionService.encryptContent(
            'User 2 private entry',
            auth2.sessionData!
          );

          assertTest(entry1.success && entry2.success, 'Both encryptions should succeed');

          // Try to access user 1's entry with user 2's session (should fail)
          const crossAccessResult = await mockServices.encryptionService.decryptContent(
            entry1.encryptedEntry!.id,
            auth2.sessionData!
          );

          assertTest(!crossAccessResult.success, 'Cross-user access should be denied');
          assertTest(crossAccessResult.error?.message.includes('Access denied'), 'Should get access denied error');

          // Verify correct access works
          const correctAccess1 = await mockServices.encryptionService.decryptContent(
            entry1.encryptedEntry!.id,
            auth1.sessionData!
          );
          const correctAccess2 = await mockServices.encryptionService.decryptContent(
            entry2.encryptedEntry!.id,
            auth2.sessionData!
          );

          assertTest(correctAccess1.success && correctAccess2.success, 'Correct access should work');
          assertTest(correctAccess1.content === 'User 1 private entry', 'User 1 should access own content');
          assertTest(correctAccess2.content === 'User 2 private entry', 'User 2 should access own content');

          return {
            user1Sessions: [auth1.sessionData],
            user2Sessions: [auth2.sessionData],
            isolationVerified: true
          };
        }
      );

      expect(testResult.success).toBe(true);
      expect(testResult.data.isolationVerified).toBe(true);
    });
  });

  describe('Performance Validation', () => {
    test('should meet all performance benchmarks', async () => {
      const testResult = await runTestWithTimeout(
        'performance-benchmarks',
        async () => {
          const user = createTestUser();
          
          // Register user
          await mockServices.opaqueClient.register(user.id, user.secretTag, { deviceId: user.deviceId });

          // Run multiple operations to get statistical data
          const operationCount = 10;
          const results = {
            authentication: [],
            voiceProcessing: [],
            encryption: [],
            sessionManagement: []
          };

          for (let i = 0; i < operationCount; i++) {
            // Authentication benchmark
            const { duration: authDuration } = await measureOperation(
              'authentication',
              () => mockServices.opaqueClient.authenticate(user.id, user.secretTag)
            );
            results.authentication.push(authDuration);

            // Voice processing benchmark
            const voiceData = createMockVoiceData();
            const { duration: voiceDuration } = await measureOperation(
              'voice-processing',
              () => mockServices.voiceProcessor.transcribeAudio(voiceData.audioBuffer)
            );
            results.voiceProcessing.push(voiceDuration);

            // Encryption benchmark
            const auth = await mockServices.opaqueClient.authenticate(user.id, user.secretTag);
            const { duration: encryptDuration } = await measureOperation(
              'encryption',
              () => mockServices.encryptionService.encryptContent('Test content', auth.sessionData!)
            );
            results.encryption.push(encryptDuration);

            // Session management benchmark
            const { duration: sessionDuration } = await measureOperation(
              'session-management',
              () => mockServices.opaqueClient.extendSession(auth.sessionData!.sessionId, 60000)
            );
            results.sessionManagement.push(sessionDuration);
          }

          // Calculate averages and validate against benchmarks
          const benchmarkResults = {
            authentication: {
              average: results.authentication.reduce((a, b) => a + b) / results.authentication.length,
              target: TEST_CONFIG.AUTHENTICATION_TIMEOUT,
              passed: false
            },
            voiceProcessing: {
              average: results.voiceProcessing.reduce((a, b) => a + b) / results.voiceProcessing.length,
              target: TEST_CONFIG.VOICE_PROCESSING_TIMEOUT,
              passed: false
            },
            encryption: {
              average: results.encryption.reduce((a, b) => a + b) / results.encryption.length,
              target: TEST_CONFIG.ENCRYPTION_TIMEOUT,
              passed: false
            },
            sessionManagement: {
              average: results.sessionManagement.reduce((a, b) => a + b) / results.sessionManagement.length,
              target: TEST_CONFIG.SESSION_TIMEOUT,
              passed: false
            }
          };

          // Validate each benchmark
          for (const [operation, data] of Object.entries(benchmarkResults)) {
            const validation = validatePerformance(operation, data.average, data.target);
            data.passed = validation.passed;
            assertTest(validation.passed, validation.message);
          }

          return benchmarkResults;
        }
      );

      expect(testResult.success).toBe(true);
      expect(Object.values(testResult.data).every((benchmark: any) => benchmark.passed)).toBe(true);
    });

    test('should handle memory usage efficiently', async () => {
      const testResult = await runTestWithTimeout(
        'memory-efficiency',
        async () => {
          const user = createTestUser();
          await mockServices.opaqueClient.register(user.id, user.secretTag, { deviceId: user.deviceId });

          const initialMemory = getMemoryUsage();
          const memoryCheckpoints = [];

          // Perform multiple operations and track memory
          for (let i = 0; i < 20; i++) {
            const auth = await mockServices.opaqueClient.authenticate(user.id, user.secretTag);
            const entry = await mockServices.encryptionService.encryptContent(
              `Memory test entry ${i}`,
              auth.sessionData!
            );
            
            memoryCheckpoints.push(getMemoryUsage());
            
            // Clean up session
            await mockServices.opaqueClient.deactivateSession(auth.sessionData!.sessionId);
          }

          const finalMemory = getMemoryUsage();
          const memoryDelta = finalMemory - initialMemory;
          const peakMemory = Math.max(...memoryCheckpoints);

          // Validate memory usage
          const memoryValidation = validateMemoryUsage('workflow-operations', memoryDelta);
          assertTest(memoryValidation.passed, memoryValidation.message);

          return {
            initialMemory,
            finalMemory,
            memoryDelta,
            peakMemory,
            checkpoints: memoryCheckpoints.length
          };
        }
      );

      expect(testResult.success).toBe(true);
      expect(testResult.data.memoryDelta).toBeLessThan(TEST_CONFIG.MAX_MEMORY_USAGE);
    });
  });

  function getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }
}); 