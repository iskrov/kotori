/**
 * Error Handling E2E Tests
 * Testing error scenarios and recovery mechanisms
 */

import { setupE2ETestEnvironment, cleanupE2ETestEnvironment, resetTestState, TEST_CONFIG } from './setup/TestSetup';
import { createTestUser, runTestWithTimeout, assertTest, validateErrorSecurity } from './helpers/TestHelpers';
import { createMockServices, resetMockServices } from './helpers/MockServices';
import { ErrorType, ErrorSeverity } from '../../../types/errorTypes';

describe('Error Handling E2E Tests', () => {
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

  describe('Network Error Handling', () => {
    test('should handle network connectivity issues', async () => {
      const testResult = await runTestWithTimeout('network-connectivity', async () => {
        const user = createTestUser();
        
        // Configure network service for failures
        mockServices.networkService.setOnlineStatus(false);
        
        // Try to register user while offline
        const offlineRegResult = await mockServices.opaqueClient.register(user.id, user.secretTag, { deviceId: user.deviceId });
        
        // Should fail with network error
        assertTest(!offlineRegResult.success, 'Registration should fail when offline');
        assertTest(offlineRegResult.error?.message.includes('offline'), 'Should get offline error');
        
        // Validate error security
        const errorSecurity = validateErrorSecurity(offlineRegResult.error);
        assertTest(errorSecurity.passed, 'Error should not leak sensitive information');
        
        // Restore connectivity
        mockServices.networkService.setOnlineStatus(true);
        
        // Should succeed when back online
        const onlineRegResult = await mockServices.opaqueClient.register(user.id, user.secretTag, { deviceId: user.deviceId });
        assertTest(onlineRegResult.success, 'Registration should succeed when online');
        
        return { offlineRegResult, onlineRegResult, errorSecurity };
      });

      expect(testResult.success).toBe(true);
    });

    test('should handle intermittent network failures with retry', async () => {
      const testResult = await runTestWithTimeout('network-retry', async () => {
        const user = createTestUser();
        
        // Configure network for 50% failure rate
        mockServices.networkService.setFailureRate(0.5);
        mockServices.networkService.setLatency(200);
        
        const results = [];
        
        // Try multiple operations
        for (let i = 0; i < 10; i++) {
          try {
            const result = await mockServices.networkService.makeRequest(
              async () => ({ success: true, attempt: i }),
              3 // 3 retries
            );
            results.push({ success: true, result });
          } catch (error) {
            results.push({ success: false, error });
          }
        }
        
        const successes = results.filter(r => r.success).length;
        const failures = results.filter(r => !r.success).length;
        
        // Should have some successes due to retries
        assertTest(successes > 0, 'Should have some successful operations with retries');
        
        return { results, successes, failures };
      });

      expect(testResult.success).toBe(true);
    });
  });

  describe('Authentication Error Handling', () => {
    test('should handle authentication failures gracefully', async () => {
      const testResult = await runTestWithTimeout('auth-failures', async () => {
        const user = createTestUser();
        
        // Try to authenticate without registration
        const noRegResult = await mockServices.opaqueClient.authenticate(user.id, user.secretTag);
        assertTest(!noRegResult.success, 'Authentication without registration should fail');
        
        // Validate error security
        const errorSecurity = validateErrorSecurity(noRegResult.error);
        assertTest(errorSecurity.passed, 'Auth error should not leak sensitive information');
        
        // Register user
        await mockServices.opaqueClient.register(user.id, user.secretTag, { deviceId: user.deviceId });
        
        // Try with wrong credentials
        const wrongCredsResult = await mockServices.opaqueClient.authenticate(user.id, 'wrong-secret');
        assertTest(!wrongCredsResult.success, 'Authentication with wrong credentials should fail');
        
        // Validate error security for wrong credentials
        const wrongCredsErrorSecurity = validateErrorSecurity(wrongCredsResult.error);
        assertTest(wrongCredsErrorSecurity.passed, 'Wrong credentials error should not leak information');
        
        return { noRegResult, wrongCredsResult, errorSecurity, wrongCredsErrorSecurity };
      });

      expect(testResult.success).toBe(true);
    });

    test('should handle session expiration gracefully', async () => {
      const testResult = await runTestWithTimeout('session-expiration', async () => {
        const user = createTestUser();
        
        // Register and authenticate
        await mockServices.opaqueClient.register(user.id, user.secretTag, { deviceId: user.deviceId });
        const authResult = await mockServices.opaqueClient.authenticate(user.id, user.secretTag);
        
        assertTest(authResult.success, 'Initial authentication should succeed');
        
        // Manually expire session
        const sessionData = authResult.sessionData!;
        sessionData.expiresAt = Date.now() - 1000;
        sessionData.isActive = false;
        
        // Try to use expired session
        const expiredSessionResult = await mockServices.encryptionService.encryptContent(
          'Test content',
          sessionData
        );
        
        assertTest(!expiredSessionResult.success, 'Operations with expired session should fail');
        assertTest(expiredSessionResult.error?.message.includes('not active'), 'Should get session not active error');
        
        // Validate error security
        const errorSecurity = validateErrorSecurity(expiredSessionResult.error);
        assertTest(errorSecurity.passed, 'Session expiration error should not leak information');
        
        return { expiredSessionResult, errorSecurity };
      });

      expect(testResult.success).toBe(true);
    });
  });

  describe('Encryption Error Handling', () => {
    test('should handle encryption failures', async () => {
      const testResult = await runTestWithTimeout('encryption-failures', async () => {
        const user = createTestUser();
        
        // Register and authenticate
        await mockServices.opaqueClient.register(user.id, user.secretTag, { deviceId: user.deviceId });
        const authResult = await mockServices.opaqueClient.authenticate(user.id, user.secretTag);
        
        // Try to encrypt with invalid session
        const invalidSession = { ...authResult.sessionData!, isActive: false };
        const invalidSessionResult = await mockServices.encryptionService.encryptContent(
          'Test content',
          invalidSession
        );
        
        assertTest(!invalidSessionResult.success, 'Encryption with invalid session should fail');
        
        // Validate error security
        const errorSecurity = validateErrorSecurity(invalidSessionResult.error);
        assertTest(errorSecurity.passed, 'Encryption error should not leak sensitive information');
        
        return { invalidSessionResult, errorSecurity };
      });

      expect(testResult.success).toBe(true);
    });

    test('should handle decryption access control', async () => {
      const testResult = await runTestWithTimeout('decryption-access-control', async () => {
        const user1 = createTestUser({ id: 'user1', secretTag: 'secret1' });
        const user2 = createTestUser({ id: 'user2', secretTag: 'secret2' });
        
        // Register both users
        await mockServices.opaqueClient.register(user1.id, user1.secretTag, { deviceId: user1.deviceId });
        await mockServices.opaqueClient.register(user2.id, user2.secretTag, { deviceId: user2.deviceId });
        
        // Authenticate both users
        const auth1 = await mockServices.opaqueClient.authenticate(user1.id, user1.secretTag);
        const auth2 = await mockServices.opaqueClient.authenticate(user2.id, user2.secretTag);
        
        // Create entry for user1
        const encryptResult = await mockServices.encryptionService.encryptContent(
          'User 1 private content',
          auth1.sessionData!
        );
        
        assertTest(encryptResult.success, 'Encryption should succeed');
        
        // Try to decrypt with user2's session
        const unauthorizedDecryptResult = await mockServices.encryptionService.decryptContent(
          encryptResult.encryptedEntry!.id,
          auth2.sessionData!
        );
        
        assertTest(!unauthorizedDecryptResult.success, 'Unauthorized decryption should fail');
        assertTest(unauthorizedDecryptResult.error?.message.includes('Access denied'), 'Should get access denied error');
        
        // Validate error security
        const errorSecurity = validateErrorSecurity(unauthorizedDecryptResult.error);
        assertTest(errorSecurity.passed, 'Access denied error should not leak sensitive information');
        
        return { unauthorizedDecryptResult, errorSecurity };
      });

      expect(testResult.success).toBe(true);
    });
  });

  describe('Voice Processing Error Handling', () => {
    test('should handle voice processing failures', async () => {
      const testResult = await runTestWithTimeout('voice-processing-failures', async () => {
        // Test with invalid audio data
        const invalidAudioResult = await mockServices.voiceProcessor.transcribeAudio(new ArrayBuffer(0));
        assertTest(!invalidAudioResult.success, 'Invalid audio should fail gracefully');
        
        // Validate error security
        const errorSecurity = validateErrorSecurity(invalidAudioResult.error);
        assertTest(errorSecurity.passed, 'Voice processing error should not leak information');
        
        // Test recording state errors
        const stopWithoutStartResult = await mockServices.voiceProcessor.stopRecording();
        assertTest(!stopWithoutStartResult.success, 'Stop without start should fail gracefully');
        
        const stopErrorSecurity = validateErrorSecurity(stopWithoutStartResult.error);
        assertTest(stopErrorSecurity.passed, 'Recording error should not leak information');
        
        return { invalidAudioResult, stopWithoutStartResult, errorSecurity, stopErrorSecurity };
      });

      expect(testResult.success).toBe(true);
    });
  });

  describe('Error Recovery Mechanisms', () => {
    test('should recover from transient failures', async () => {
      const testResult = await runTestWithTimeout('error-recovery', async () => {
        const user = createTestUser();
        
        // Configure intermittent failures
        mockServices.networkService.setFailureRate(0.3);
        
        let successCount = 0;
        let failureCount = 0;
        const maxAttempts = 20;
        
        for (let i = 0; i < maxAttempts; i++) {
          try {
            const result = await mockServices.networkService.makeRequest(
              async () => {
                // Simulate registration operation
                return await mockServices.opaqueClient.register(
                  `${user.id}-${i}`, 
                  user.secretTag, 
                  { deviceId: user.deviceId }
                );
              },
              3 // 3 retries
            );
            successCount++;
          } catch (error) {
            failureCount++;
          }
        }
        
        // Should have more successes than failures due to retry mechanism
        assertTest(successCount > failureCount, 'Should have more successes than failures with retries');
        assertTest(successCount > 0, 'Should have some successful operations');
        
        return { successCount, failureCount, maxAttempts, successRate: successCount / maxAttempts };
      });

      expect(testResult.success).toBe(true);
    });

    test('should handle cascading failures gracefully', async () => {
      const testResult = await runTestWithTimeout('cascading-failures', async () => {
        const user = createTestUser();
        
        // Simulate cascading failure scenario
        mockServices.networkService.setOnlineStatus(false);
        
        // Try complete workflow while offline
        const workflowSteps = [];
        
        // Step 1: Registration (should fail)
        try {
          const regResult = await mockServices.opaqueClient.register(user.id, user.secretTag, { deviceId: user.deviceId });
          workflowSteps.push({ step: 'registration', success: regResult.success, error: regResult.error });
        } catch (error) {
          workflowSteps.push({ step: 'registration', success: false, error });
        }
        
        // Step 2: Authentication (should fail)
        try {
          const authResult = await mockServices.opaqueClient.authenticate(user.id, user.secretTag);
          workflowSteps.push({ step: 'authentication', success: authResult.success, error: authResult.error });
        } catch (error) {
          workflowSteps.push({ step: 'authentication', success: false, error });
        }
        
        // All steps should fail gracefully
        for (const step of workflowSteps) {
          assertTest(!step.success, `${step.step} should fail when offline`);
          
          // Validate error security
          const errorSecurity = validateErrorSecurity(step.error);
          assertTest(errorSecurity.passed, `${step.step} error should not leak sensitive information`);
        }
        
        // Restore connectivity and verify recovery
        mockServices.networkService.setOnlineStatus(true);
        
        const recoveryResult = await mockServices.opaqueClient.register(user.id, user.secretTag, { deviceId: user.deviceId });
        assertTest(recoveryResult.success, 'Should recover when connectivity is restored');
        
        return { workflowSteps, recoveryResult };
      });

      expect(testResult.success).toBe(true);
    });
  });

  describe('Error Logging and Monitoring', () => {
    test('should log errors without sensitive information', async () => {
      const testResult = await runTestWithTimeout('error-logging', async () => {
        const user = createTestUser();
        
        // Generate various types of errors
        const errors = [];
        
        // Authentication error
        const authError = await mockServices.opaqueClient.authenticate('nonexistent-user', 'secret');
        if (!authError.success) {
          errors.push({ type: 'authentication', error: authError.error });
        }
        
        // Voice processing error
        const voiceError = await mockServices.voiceProcessor.transcribeAudio(new ArrayBuffer(0));
        if (!voiceError.success) {
          errors.push({ type: 'voice-processing', error: voiceError.error });
        }
        
        // Network error
        mockServices.networkService.setOnlineStatus(false);
        try {
          await mockServices.networkService.makeRequest(async () => ({ test: true }));
        } catch (error) {
          errors.push({ type: 'network', error });
        }
        
        // Validate all errors for security
        for (const errorEntry of errors) {
          const errorSecurity = validateErrorSecurity(errorEntry.error);
          assertTest(errorSecurity.passed, `${errorEntry.type} error should not leak sensitive information`);
          
          if (!errorSecurity.passed) {
            console.log(`Security violations for ${errorEntry.type}:`, errorSecurity.violations);
          }
        }
        
        return { errors, errorCount: errors.length };
      });

      expect(testResult.success).toBe(true);
    });
  });
}); 