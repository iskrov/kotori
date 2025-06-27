/**
 * E2E Test Environment Setup
 * Configures the testing environment for comprehensive OPAQUE workflow testing
 */

import { jest } from '@jest/globals';
import { ErrorLogger } from '../../../services/ErrorLogger';
import { SessionManager } from '../../../services/SessionManager';
import { VoicePhraseDetector } from '../../../services/VoicePhraseDetector';
import { EncryptedEntryManager } from '../../../services/EncryptedEntryManager';
import { OpaqueTagManager } from '../../../services/OpaqueTagManager';

// Test configuration constants
export const TEST_CONFIG = {
  // Performance targets
  AUTHENTICATION_TIMEOUT: 500, // 500ms target
  VOICE_PROCESSING_TIMEOUT: 2000, // 2s target
  ENCRYPTION_TIMEOUT: 100, // 100ms target
  SESSION_TIMEOUT: 50, // 50ms target
  
  // Test data
  TEST_USER_ID: 'test-user-123',
  TEST_SECRET_TAG: 'test-secret-phrase',
  TEST_VOICE_PHRASE: 'open my secure journal',
  TEST_JOURNAL_CONTENT: 'This is a test journal entry for E2E testing',
  
  // Mock configuration
  MOCK_AUDIO_DURATION: 1500, // 1.5 seconds
  MOCK_TRANSCRIPTION_DELAY: 300, // 300ms
  MOCK_AUTHENTICATION_DELAY: 200, // 200ms
  MOCK_ENCRYPTION_DELAY: 50, // 50ms
  
  // Test environment
  TEST_DEVICE_ID: 'test-device-456',
  TEST_SESSION_DURATION: 30 * 60 * 1000, // 30 minutes
  TEST_RETRY_COUNT: 3,
  
  // Memory and performance limits
  MAX_MEMORY_USAGE: 100 * 1024 * 1024, // 100MB
  MAX_CONCURRENT_SESSIONS: 5,
  MAX_TEST_DURATION: 30000, // 30 seconds per test
};

// Global test state
interface TestState {
  isSetup: boolean;
  mockServices: MockServices;
  performanceMonitor: PerformanceMonitor;
  testData: TestData;
  cleanup: (() => Promise<void>)[];
}

interface MockServices {
  audioRecorder: any;
  speechToText: any;
  networkClient: any;
  storage: any;
  permissions: any;
}

interface PerformanceMonitor {
  startTime: number;
  memoryUsage: number[];
  operationTimes: Map<string, number[]>;
  errors: any[];
}

interface TestData {
  users: Map<string, any>;
  sessions: Map<string, any>;
  entries: Map<string, any>;
  voiceData: Map<string, any>;
}

let globalTestState: TestState;

/**
 * Initialize the E2E test environment
 */
export async function setupE2ETestEnvironment(): Promise<TestState> {
  if (globalTestState?.isSetup) {
    return globalTestState;
  }

  console.log('Setting up E2E test environment...');

  // Initialize test state
  globalTestState = {
    isSetup: false,
    mockServices: await createMockServices(),
    performanceMonitor: createPerformanceMonitor(),
    testData: createTestData(),
    cleanup: []
  };

  // Setup mock implementations
  await setupMockImplementations(globalTestState.mockServices);
  
  // Initialize performance monitoring
  startPerformanceMonitoring(globalTestState.performanceMonitor);
  
  // Setup error handling for tests
  setupTestErrorHandling();
  
  // Register cleanup handlers
  setupCleanupHandlers(globalTestState);

  globalTestState.isSetup = true;
  console.log('E2E test environment setup complete');
  
  return globalTestState;
}

/**
 * Create mock services for testing
 */
async function createMockServices(): Promise<MockServices> {
  return {
    audioRecorder: createMockAudioRecorder(),
    speechToText: createMockSpeechToText(),
    networkClient: createMockNetworkClient(),
    storage: createMockStorage(),
    permissions: createMockPermissions()
  };
}

/**
 * Create mock audio recorder
 */
function createMockAudioRecorder() {
  return {
    startRecording: jest.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { success: true, recordingId: 'mock-recording-123' };
    }),
    
    stopRecording: jest.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return {
        success: true,
        audioData: new ArrayBuffer(1024),
        duration: TEST_CONFIG.MOCK_AUDIO_DURATION
      };
    }),
    
    isRecording: jest.fn().mockReturnValue(false),
    
    hasPermission: jest.fn().mockResolvedValue(true),
    
    requestPermission: jest.fn().mockResolvedValue(true)
  };
}

/**
 * Create mock speech-to-text service
 */
function createMockSpeechToText() {
  return {
    transcribe: jest.fn().mockImplementation(async (audioData: ArrayBuffer) => {
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.MOCK_TRANSCRIPTION_DELAY));
      return {
        success: true,
        transcript: TEST_CONFIG.TEST_VOICE_PHRASE,
        confidence: 0.95,
        duration: TEST_CONFIG.MOCK_AUDIO_DURATION
      };
    }),
    
    isAvailable: jest.fn().mockReturnValue(true),
    
    getLanguages: jest.fn().mockReturnValue(['en-US', 'en-GB']),
    
    setLanguage: jest.fn().mockImplementation(async (language: string) => {
      return { success: true, language };
    })
  };
}

/**
 * Create mock network client
 */
function createMockNetworkClient() {
  return {
    post: jest.fn().mockImplementation(async (url: string, data: any) => {
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.MOCK_AUTHENTICATION_DELAY));
      
      if (url.includes('/auth/register')) {
        return {
          success: true,
          data: {
            userId: TEST_CONFIG.TEST_USER_ID,
            registrationData: 'mock-registration-data'
          }
        };
      }
      
      if (url.includes('/auth/login')) {
        return {
          success: true,
          data: {
            sessionId: 'mock-session-123',
            sessionKey: 'mock-session-key',
            expiresAt: Date.now() + TEST_CONFIG.TEST_SESSION_DURATION
          }
        };
      }
      
      return { success: true, data: {} };
    }),
    
    get: jest.fn().mockImplementation(async (url: string) => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { success: true, data: {} };
    }),
    
    isOnline: jest.fn().mockReturnValue(true)
  };
}

/**
 * Create mock storage service
 */
function createMockStorage() {
  const storage = new Map<string, any>();
  
  return {
    setItem: jest.fn().mockImplementation(async (key: string, value: any) => {
      storage.set(key, value);
      return { success: true };
    }),
    
    getItem: jest.fn().mockImplementation(async (key: string) => {
      return { success: true, data: storage.get(key) };
    }),
    
    removeItem: jest.fn().mockImplementation(async (key: string) => {
      storage.delete(key);
      return { success: true };
    }),
    
    clear: jest.fn().mockImplementation(async () => {
      storage.clear();
      return { success: true };
    }),
    
    getAllKeys: jest.fn().mockImplementation(async () => {
      return { success: true, data: Array.from(storage.keys()) };
    })
  };
}

/**
 * Create mock permissions service
 */
function createMockPermissions() {
  return {
    checkPermission: jest.fn().mockImplementation(async (permission: string) => {
      return { granted: true, permission };
    }),
    
    requestPermission: jest.fn().mockImplementation(async (permission: string) => {
      return { granted: true, permission };
    }),
    
    hasPermission: jest.fn().mockReturnValue(true)
  };
}

/**
 * Setup mock implementations for services
 */
async function setupMockImplementations(mockServices: MockServices) {
  // Mock global objects that might be used
  global.navigator = {
    ...global.navigator,
    mediaDevices: {
      getUserMedia: jest.fn().mockResolvedValue({
        getTracks: jest.fn().mockReturnValue([
          { stop: jest.fn() }
        ])
      })
    },
    onLine: true
  } as any;

  // Mock fetch for network requests
  global.fetch = jest.fn().mockImplementation(async (url: string, options: any) => {
    const response = await mockServices.networkClient.post(url, options?.body);
    return {
      ok: response.success,
      json: async () => response.data,
      status: response.success ? 200 : 400
    };
  });

  // Mock console methods to reduce noise in tests
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  
  console.log = jest.fn();
  console.warn = jest.fn();
  
  // Restore console for important messages
  globalTestState.cleanup.push(async () => {
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
  });
}

/**
 * Create performance monitor
 */
function createPerformanceMonitor(): PerformanceMonitor {
  return {
    startTime: Date.now(),
    memoryUsage: [],
    operationTimes: new Map(),
    errors: []
  };
}

/**
 * Start performance monitoring
 */
function startPerformanceMonitoring(monitor: PerformanceMonitor) {
  // Monitor memory usage every second during tests
  const memoryInterval = setInterval(() => {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      monitor.memoryUsage.push(usage.heapUsed);
    }
  }, 1000);

  globalTestState.cleanup.push(async () => {
    clearInterval(memoryInterval);
  });
}

/**
 * Setup test error handling
 */
function setupTestErrorHandling() {
  // Create test-specific error logger
  const testErrorLogger = new ErrorLogger({
    enableLogging: true,
    logLevel: 'debug',
    enableRetry: false,
    enableUserFeedback: false,
    enableSecurityLogging: true
  });

  // Override global error handling for tests
  const originalErrorHandler = global.onerror;
  global.onerror = (message, source, lineno, colno, error) => {
    globalTestState.performanceMonitor.errors.push({
      message,
      source,
      lineno,
      colno,
      error,
      timestamp: Date.now()
    });
    return false;
  };

  globalTestState.cleanup.push(async () => {
    global.onerror = originalErrorHandler;
  });
}

/**
 * Create test data
 */
function createTestData(): TestData {
  return {
    users: new Map(),
    sessions: new Map(),
    entries: new Map(),
    voiceData: new Map()
  };
}

/**
 * Setup cleanup handlers
 */
function setupCleanupHandlers(testState: TestState) {
  // Process cleanup on exit
  const cleanup = async () => {
    console.log('Cleaning up E2E test environment...');
    
    for (const cleanupFn of testState.cleanup) {
      try {
        await cleanupFn();
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    }
    
    // Clear test data
    testState.testData.users.clear();
    testState.testData.sessions.clear();
    testState.testData.entries.clear();
    testState.testData.voiceData.clear();
    
    console.log('E2E test environment cleanup complete');
  };

  // Register cleanup for different exit scenarios
  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('uncaughtException', cleanup);
}

/**
 * Cleanup E2E test environment
 */
export async function cleanupE2ETestEnvironment(): Promise<void> {
  if (!globalTestState?.isSetup) {
    return;
  }

  for (const cleanupFn of globalTestState.cleanup) {
    try {
      await cleanupFn();
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  globalTestState.isSetup = false;
}

/**
 * Get current test state
 */
export function getTestState(): TestState {
  return globalTestState;
}

/**
 * Reset test state for new test
 */
export async function resetTestState(): Promise<void> {
  if (!globalTestState?.isSetup) {
    return;
  }

  // Clear test data but keep mocks
  globalTestState.testData.users.clear();
  globalTestState.testData.sessions.clear();
  globalTestState.testData.entries.clear();
  globalTestState.testData.voiceData.clear();

  // Reset performance monitoring
  globalTestState.performanceMonitor.startTime = Date.now();
  globalTestState.performanceMonitor.memoryUsage = [];
  globalTestState.performanceMonitor.operationTimes.clear();
  globalTestState.performanceMonitor.errors = [];

  // Reset mock call counts
  jest.clearAllMocks();
}

/**
 * Measure operation performance
 */
export function measureOperation<T>(
  operationName: string,
  operation: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  return new Promise(async (resolve, reject) => {
    const startTime = Date.now();
    
    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      
      // Record performance data
      if (globalTestState?.performanceMonitor) {
        const times = globalTestState.performanceMonitor.operationTimes.get(operationName) || [];
        times.push(duration);
        globalTestState.performanceMonitor.operationTimes.set(operationName, times);
      }
      
      resolve({ result, duration });
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Record error
      if (globalTestState?.performanceMonitor) {
        globalTestState.performanceMonitor.errors.push({
          operation: operationName,
          error,
          duration,
          timestamp: Date.now()
        });
      }
      
      reject(error);
    }
  });
}

/**
 * Get performance report
 */
export function getPerformanceReport(): {
  totalDuration: number;
  memoryUsage: { min: number; max: number; avg: number };
  operationTimes: Record<string, { min: number; max: number; avg: number; count: number }>;
  errorCount: number;
} {
  if (!globalTestState?.performanceMonitor) {
    return {
      totalDuration: 0,
      memoryUsage: { min: 0, max: 0, avg: 0 },
      operationTimes: {},
      errorCount: 0
    };
  }

  const monitor = globalTestState.performanceMonitor;
  const totalDuration = Date.now() - monitor.startTime;
  
  // Calculate memory statistics
  const memoryStats = monitor.memoryUsage.length > 0 ? {
    min: Math.min(...monitor.memoryUsage),
    max: Math.max(...monitor.memoryUsage),
    avg: monitor.memoryUsage.reduce((a, b) => a + b, 0) / monitor.memoryUsage.length
  } : { min: 0, max: 0, avg: 0 };
  
  // Calculate operation time statistics
  const operationStats: Record<string, { min: number; max: number; avg: number; count: number }> = {};
  
  for (const [operation, times] of monitor.operationTimes.entries()) {
    operationStats[operation] = {
      min: Math.min(...times),
      max: Math.max(...times),
      avg: times.reduce((a, b) => a + b, 0) / times.length,
      count: times.length
    };
  }
  
  return {
    totalDuration,
    memoryUsage: memoryStats,
    operationTimes: operationStats,
    errorCount: monitor.errors.length
  };
} 