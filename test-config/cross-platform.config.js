/**
 * Cross-Platform Test Configuration
 * 
 * This configuration file defines test environments and settings
 * for running OPAQUE tests across different platforms.
 */

const path = require('path');

// Base configuration shared across all platforms
const baseConfig = {
  testTimeout: 30000, // 30 seconds for crypto operations
  setupFilesAfterEnv: ['<rootDir>/test-config/setup.js'],
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.{js,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/*.test.{js,ts,tsx}',
    '!src/**/node_modules/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Higher threshold for crypto modules
    './src/services/opaqueAuth.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/services/opaqueKeyManager.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  }
};

// Platform-specific configurations
const platformConfigs = {
  // Web browser testing configuration
  web: {
    ...baseConfig,
    displayName: 'Web Browser Tests',
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: [
      '<rootDir>/test-config/setup.js',
      '<rootDir>/test-config/web-setup.js'
    ],
    testMatch: [
      '<rootDir>/src/**/__tests__/**/*.web.test.{js,ts,tsx}',
      '<rootDir>/src/**/*.web.test.{js,ts,tsx}'
    ],
    moduleNameMapping: {
      '^@react-native-async-storage/async-storage$': '<rootDir>/test-config/mocks/asyncStorage.web.js'
    },
    globals: {
      crypto: {
        getRandomValues: true,
        subtle: true
      }
    }
  },

  // React Native testing configuration
  'react-native': {
    ...baseConfig,
    displayName: 'React Native Tests',
    preset: 'react-native',
    setupFilesAfterEnv: [
      '<rootDir>/test-config/setup.js',
      '<rootDir>/test-config/react-native-setup.js'
    ],
    testMatch: [
      '<rootDir>/src/**/__tests__/**/*.native.test.{js,ts,tsx}',
      '<rootDir>/src/**/*.native.test.{js,ts,tsx}',
      '<rootDir>/src/**/__tests__/**/*.test.{js,ts,tsx}',
      '<rootDir>/src/**/*.test.{js,ts,tsx}'
    ],
    transform: {
      '^.+\\.(js|ts|tsx)$': 'babel-jest'
    },
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    transformIgnorePatterns: [
      'node_modules/(?!(react-native|@react-native|@serenity-kit)/)'
    ]
  },

  // End-to-end testing configuration
  e2e: {
    ...baseConfig,
    displayName: 'End-to-End Tests',
    testMatch: [
      '<rootDir>/src/**/__tests__/**/*.e2e.test.{js,ts,tsx}',
      '<rootDir>/src/**/*.e2e.test.{js,ts,tsx}'
    ],
    setupFilesAfterEnv: [
      '<rootDir>/test-config/setup.js',
      '<rootDir>/test-config/e2e-setup.js'
    ],
    testTimeout: 60000 // Longer timeout for E2E tests
  },

  // Integration testing configuration
  integration: {
    ...baseConfig,
    displayName: 'Integration Tests',
    testMatch: [
      '<rootDir>/src/**/__tests__/**/*.integration.test.{js,ts,tsx}',
      '<rootDir>/src/**/*.integration.test.{js,ts,tsx}'
    ],
    setupFilesAfterEnv: [
      '<rootDir>/test-config/setup.js',
      '<rootDir>/test-config/integration-setup.js'
    ]
  }
};

// Performance testing configuration
const performanceConfig = {
  ...baseConfig,
  displayName: 'Performance Tests',
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.perf.test.{js,ts,tsx}',
    '<rootDir>/src/**/*.perf.test.{js,ts,tsx}'
  ],
  setupFilesAfterEnv: [
    '<rootDir>/test-config/setup.js',
    '<rootDir>/test-config/performance-setup.js'
  ],
  testTimeout: 120000, // 2 minutes for performance tests
  maxWorkers: 1 // Run performance tests sequentially
};

// Security testing configuration
const securityConfig = {
  ...baseConfig,
  displayName: 'Security Tests',
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.security.test.{js,ts,tsx}',
    '<rootDir>/src/**/*.security.test.{js,ts,tsx}'
  ],
  setupFilesAfterEnv: [
    '<rootDir>/test-config/setup.js',
    '<rootDir>/test-config/security-setup.js'
  ]
};

// Export configurations
module.exports = {
  // Multi-project configuration for running all platforms
  projects: [
    platformConfigs.web,
    platformConfigs['react-native'],
    platformConfigs.e2e,
    platformConfigs.integration,
    performanceConfig,
    securityConfig
  ],

  // Individual platform configurations
  platformConfigs,
  baseConfig,

  // Test environment variables
  testEnvironmentOptions: {
    OPAQUE_TEST_MODE: 'true',
    OPAQUE_SERVER_URL: process.env.OPAQUE_SERVER_URL || 'http://localhost:8000',
    OPAQUE_LOG_LEVEL: process.env.OPAQUE_LOG_LEVEL || 'error'
  },

  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],

  // Global test settings
  verbose: true,
  bail: false, // Continue running tests even if some fail
  maxWorkers: '50%', // Use half of available CPU cores
  
  // Test result processors
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: '<rootDir>/test-results',
      outputName: 'junit.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: true
    }]
  ]
}; 