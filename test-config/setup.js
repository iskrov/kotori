/**
 * Base Test Setup
 * 
 * Common setup configuration for all test environments
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.OPAQUE_TEST_MODE = 'true';

// Configure global test timeout
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

beforeAll(() => {
  // Only show errors in test output, suppress warnings and logs
  console.error = jest.fn();
  console.warn = jest.fn();
  console.log = jest.fn();
});

afterAll(() => {
  // Restore original console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.log = originalConsoleLog;
});

// Global test utilities
global.testUtils = {
  // Generate random test data
  generateRandomEmail: () => {
    const randomId = Math.random().toString(36).substring(2, 15);
    return `test_${randomId}@example.com`;
  },
  
  generateRandomPassword: () => {
    return `test_password_${Math.random().toString(36).substring(2, 15)}`;
  },
  
  generateRandomBytes: (length = 32) => {
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
    return bytes;
  },
  
  // Wait for async operations
  waitFor: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Validate base64 strings
  isValidBase64: (str) => {
    try {
      return btoa(atob(str)) === str;
    } catch (err) {
      return false;
    }
  },
  
  // Common test assertions
  expectValidOpaqueResponse: (response) => {
    expect(response).toBeDefined();
    expect(typeof response).toBe('object');
    expect(response.success).toBeDefined();
    expect(typeof response.success).toBe('boolean');
    expect(response.message).toBeDefined();
    expect(typeof response.message).toBe('string');
  },
  
  expectValidCryptoKey: (key) => {
    expect(key).toBeDefined();
    expect(key instanceof Uint8Array).toBe(true);
    expect(key.length).toBeGreaterThan(0);
  }
};

// Mock crypto.getRandomValues for consistent testing
if (typeof crypto === 'undefined') {
  global.crypto = {
    getRandomValues: (array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    },
    subtle: {
      importKey: jest.fn(),
      deriveKey: jest.fn(),
      deriveBits: jest.fn(),
      encrypt: jest.fn(),
      decrypt: jest.fn()
    }
  };
}

// Configure fetch mock for tests
if (typeof fetch === 'undefined') {
  global.fetch = jest.fn();
}

// Error handling for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Clean up after each test
afterEach(() => {
  // Clear all mocks
  jest.clearAllMocks();
  
  // Clear any timers
  jest.clearAllTimers();
  
  // Reset fetch mock
  if (global.fetch && global.fetch.mockClear) {
    global.fetch.mockClear();
  }
}); 