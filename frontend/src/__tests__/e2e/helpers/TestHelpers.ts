/**
 * E2E Test Helpers
 * Utility functions and helpers for OPAQUE workflow E2E testing
 */

import { TEST_CONFIG, measureOperation, getTestState } from '../setup/TestSetup';
import { ErrorType, ErrorSeverity } from '../../../types/errorTypes';
import { SessionData } from '../../../types/sessionTypes';
import { EncryptedEntry } from '../../../types/entryTypes';

/**
 * Test user data interface
 */
export interface TestUser {
  id: string;
  secretTag: string;
  voicePhrase: string;
  deviceId: string;
  registrationData?: any;
  sessionData?: SessionData;
}

/**
 * Test result interface
 */
export interface TestResult {
  success: boolean;
  duration: number;
  error?: Error;
  data?: any;
  performanceMetrics?: {
    memoryUsage: number;
    operationCount: number;
    averageResponseTime: number;
  };
}

/**
 * Voice test data interface
 */
export interface VoiceTestData {
  audioBuffer: ArrayBuffer;
  expectedTranscript: string;
  confidence: number;
  duration: number;
}

/**
 * Create a test user with default data
 */
export function createTestUser(overrides: Partial<TestUser> = {}): TestUser {
  const userId = overrides.id || `test-user-${Date.now()}`;
  
  return {
    id: userId,
    secretTag: overrides.secretTag || `secret-${userId}`,
    voicePhrase: overrides.voicePhrase || TEST_CONFIG.TEST_VOICE_PHRASE,
    deviceId: overrides.deviceId || TEST_CONFIG.TEST_DEVICE_ID,
    ...overrides
  };
}

/**
 * Create mock voice data for testing
 */
export function createMockVoiceData(phrase: string = TEST_CONFIG.TEST_VOICE_PHRASE): VoiceTestData {
  // Create a simple mock audio buffer
  const audioBuffer = new ArrayBuffer(1024);
  const view = new Uint8Array(audioBuffer);
  
  // Fill with mock audio data (simple sine wave pattern)
  for (let i = 0; i < view.length; i++) {
    view[i] = Math.sin(i * 0.1) * 127 + 128;
  }
  
  return {
    audioBuffer,
    expectedTranscript: phrase,
    confidence: 0.95,
    duration: TEST_CONFIG.MOCK_AUDIO_DURATION
  };
}

/**
 * Create mock journal entry data
 */
export function createMockJournalEntry(content: string = TEST_CONFIG.TEST_JOURNAL_CONTENT): {
  content: string;
  timestamp: number;
  metadata: Record<string, any>;
} {
  return {
    content,
    timestamp: Date.now(),
    metadata: {
      wordCount: content.split(' ').length,
      language: 'en-US',
      source: 'voice',
      testEntry: true
    }
  };
}

/**
 * Wait for a condition to be true with timeout
 */
export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const result = await condition();
      if (result) {
        return true;
      }
    } catch (error) {
      // Continue waiting on errors
    }
    
    await sleep(interval);
  }
  
  return false;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Simulate network delay
 */
export async function simulateNetworkDelay(
  operation: () => Promise<any>,
  delay: number = TEST_CONFIG.MOCK_AUTHENTICATION_DELAY
): Promise<any> {
  await sleep(delay);
  return await operation();
}

/**
 * Simulate network failure
 */
export async function simulateNetworkFailure<T>(
  operation: () => Promise<T>,
  failureRate: number = 0.3,
  retryCount: number = 3
): Promise<T> {
  for (let attempt = 0; attempt < retryCount; attempt++) {
    if (Math.random() < failureRate) {
      throw new Error(`Network failure simulation (attempt ${attempt + 1})`);
    }
    
    try {
      return await operation();
    } catch (error) {
      if (attempt === retryCount - 1) {
        throw error;
      }
      await sleep(100 * Math.pow(2, attempt)); // Exponential backoff
    }
  }
  
  throw new Error('Max retry attempts reached');
}

/**
 * Measure memory usage during operation
 */
export async function measureMemoryUsage<T>(
  operation: () => Promise<T>
): Promise<{ result: T; memoryDelta: number }> {
  const initialMemory = getMemoryUsage();
  const result = await operation();
  const finalMemory = getMemoryUsage();
  
  return {
    result,
    memoryDelta: finalMemory - initialMemory
  };
}

/**
 * Get current memory usage (mock implementation for testing)
 */
function getMemoryUsage(): number {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage().heapUsed;
  }
  return 0;
}

/**
 * Validate test performance against targets
 */
export function validatePerformance(
  operation: string,
  duration: number,
  target: number,
  tolerance: number = 0.2
): { passed: boolean; message: string } {
  const maxAllowed = target * (1 + tolerance);
  const passed = duration <= maxAllowed;
  
  return {
    passed,
    message: passed
      ? `${operation} completed in ${duration}ms (target: ${target}ms)`
      : `${operation} took ${duration}ms, exceeding target of ${target}ms (max allowed: ${maxAllowed}ms)`
  };
}

/**
 * Validate memory usage
 */
export function validateMemoryUsage(
  operation: string,
  memoryDelta: number,
  maxAllowed: number = TEST_CONFIG.MAX_MEMORY_USAGE
): { passed: boolean; message: string } {
  const passed = memoryDelta <= maxAllowed;
  
  return {
    passed,
    message: passed
      ? `${operation} used ${formatBytes(memoryDelta)} memory`
      : `${operation} used ${formatBytes(memoryDelta)} memory, exceeding limit of ${formatBytes(maxAllowed)}`
  };
}

/**
 * Format bytes for display
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Generate test correlation ID
 */
export function generateTestCorrelationId(testName: string): string {
  return `test-${testName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate error security (no sensitive information leaked)
 */
export function validateErrorSecurity(error: any): { passed: boolean; violations: string[] } {
  const violations: string[] = [];
  const errorString = JSON.stringify(error).toLowerCase();
  
  // Check for sensitive information patterns
  const sensitivePatterns = [
    /password/i,
    /secret/i,
    /key/i,
    /token/i,
    /auth/i,
    /session/i,
    /opaque/i,
    /crypto/i,
    /private/i,
    /seed/i,
    /salt/i,
    /hash/i
  ];
  
  for (const pattern of sensitivePatterns) {
    if (pattern.test(errorString)) {
      violations.push(`Potential sensitive information: ${pattern.source}`);
    }
  }
  
  return {
    passed: violations.length === 0,
    violations
  };
}

/**
 * Create test session data
 */
export function createTestSessionData(userId: string, secretTag: string): SessionData {
  return {
    sessionId: `test-session-${Date.now()}`,
    userId,
    secretTag,
    sessionKey: new Uint8Array(32), // Mock session key
    createdAt: Date.now(),
    expiresAt: Date.now() + TEST_CONFIG.TEST_SESSION_DURATION,
    isActive: true,
    deviceId: TEST_CONFIG.TEST_DEVICE_ID,
    lastActivityAt: Date.now(),
    metadata: {
      testSession: true,
      platform: 'test',
      version: '1.0.0'
    }
  };
}

/**
 * Create test encrypted entry
 */
export function createTestEncryptedEntry(
  content: string,
  sessionData: SessionData
): EncryptedEntry {
  return {
    id: `test-entry-${Date.now()}`,
    userId: sessionData.userId,
    secretTag: sessionData.secretTag,
    encryptedContent: new Uint8Array(content.length * 2), // Mock encrypted data
    encryptionMetadata: {
      algorithm: 'AES-GCM',
      keyDerivation: 'OPAQUE-session',
      iv: new Uint8Array(12),
      authTag: new Uint8Array(16)
    },
    createdAt: Date.now(),
    metadata: {
      originalLength: content.length,
      contentType: 'text/plain',
      source: 'voice',
      testEntry: true
    }
  };
}

/**
 * Validate encryption integrity
 */
export async function validateEncryptionIntegrity(
  originalContent: string,
  encryptedEntry: EncryptedEntry,
  decryptedContent: string
): Promise<{ passed: boolean; message: string }> {
  const passed = originalContent === decryptedContent;
  
  return {
    passed,
    message: passed
      ? 'Encryption/decryption integrity validated'
      : `Encryption integrity failed: original length ${originalContent.length}, decrypted length ${decryptedContent.length}`
  };
}

/**
 * Create test error for error handling tests
 */
export function createTestError(
  type: ErrorType,
  severity: ErrorSeverity,
  message: string,
  metadata?: Record<string, any>
): Error & {
  type: ErrorType;
  severity: ErrorSeverity;
  metadata?: Record<string, any>;
} {
  const error = new Error(message) as any;
  error.type = type;
  error.severity = severity;
  error.metadata = metadata;
  return error;
}

/**
 * Simulate concurrent operations
 */
export async function simulateConcurrentOperations<T>(
  operations: (() => Promise<T>)[],
  maxConcurrent: number = TEST_CONFIG.MAX_CONCURRENT_SESSIONS
): Promise<T[]> {
  const results: T[] = [];
  
  for (let i = 0; i < operations.length; i += maxConcurrent) {
    const batch = operations.slice(i, i + maxConcurrent);
    const batchResults = await Promise.all(batch.map(op => op()));
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * Validate test result
 */
export function validateTestResult(
  result: TestResult,
  expectedDuration?: number,
  expectedData?: any
): { passed: boolean; message: string } {
  if (!result.success) {
    return {
      passed: false,
      message: `Test failed: ${result.error?.message || 'Unknown error'}`
    };
  }
  
  if (expectedDuration && result.duration > expectedDuration) {
    return {
      passed: false,
      message: `Test exceeded expected duration: ${result.duration}ms > ${expectedDuration}ms`
    };
  }
  
  if (expectedData && JSON.stringify(result.data) !== JSON.stringify(expectedData)) {
    return {
      passed: false,
      message: 'Test data does not match expected result'
    };
  }
  
  return {
    passed: true,
    message: `Test passed in ${result.duration}ms`
  };
}

/**
 * Run test with timeout
 */
export async function runTestWithTimeout<T>(
  testName: string,
  testFunction: () => Promise<T>,
  timeout: number = TEST_CONFIG.MAX_TEST_DURATION
): Promise<TestResult> {
  const correlationId = generateTestCorrelationId(testName);
  
  try {
    const { result, duration } = await measureOperation(testName, async () => {
      return await Promise.race([
        testFunction(),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Test timeout: ${testName}`)), timeout);
        })
      ]);
    });
    
    return {
      success: true,
      duration,
      data: result
    };
  } catch (error) {
    return {
      success: false,
      duration: timeout,
      error: error as Error
    };
  }
}

/**
 * Assert test condition
 */
export function assertTest(
  condition: boolean,
  message: string,
  actual?: any,
  expected?: any
): void {
  if (!condition) {
    const errorMessage = expected !== undefined && actual !== undefined
      ? `${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`
      : message;
    throw new Error(errorMessage);
  }
}

/**
 * Create test summary report
 */
export function createTestSummaryReport(
  testResults: Array<{ name: string; result: TestResult }>
): {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  totalDuration: number;
  averageDuration: number;
  failureReasons: string[];
} {
  const totalTests = testResults.length;
  const passedTests = testResults.filter(t => t.result.success).length;
  const failedTests = totalTests - passedTests;
  const totalDuration = testResults.reduce((sum, t) => sum + t.result.duration, 0);
  const averageDuration = totalDuration / totalTests;
  const failureReasons = testResults
    .filter(t => !t.result.success)
    .map(t => `${t.name}: ${t.result.error?.message || 'Unknown error'}`);
  
  return {
    totalTests,
    passedTests,
    failedTests,
    totalDuration,
    averageDuration,
    failureReasons
  };
} 