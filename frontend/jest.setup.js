import '@testing-library/jest-native/extend-expect';
import { NativeModules } from 'react-native';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

// Mock Expo constants
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      apiUrl: 'http://localhost:8001',
      googleClientId: 'mock-google-client-id',
    },
  },
}));

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///mock/document/',
  cacheDirectory: 'file:///mock/cache/',
  writeAsStringAsync: jest.fn(() => Promise.resolve()),
  readAsStringAsync: jest.fn(() => Promise.resolve('mock file content')),
  deleteAsync: jest.fn(() => Promise.resolve()),
  makeDirectoryAsync: jest.fn(() => Promise.resolve()),
  getInfoAsync: jest.fn(() => Promise.resolve({ exists: true, isDirectory: false })),
}));

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
  MaterialIcons: 'MaterialIcons',
  FontAwesome: 'FontAwesome',
  AntDesign: 'AntDesign',
}));

// Mock expo-auth-session
jest.mock('expo-auth-session/providers/google', () => ({
  useAuthRequest: () => [
    { promptAsync: jest.fn(() => Promise.resolve({ type: 'success' })) },
    { type: null },
    jest.fn(),
  ],
}));

// Mock react navigation
jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      replace: jest.fn(),
    }),
    useRoute: () => ({
      params: {},
    }),
  };
});

// Do not mock axios; E2E tests use real backend

// Provide WebCrypto for Node test environment to support real OPAQUE usage
if (!global.crypto) {
  const { webcrypto } = require('crypto');
  global.crypto = webcrypto;
}

// Ensure TextEncoder/TextDecoder exist in Node environment
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  // @ts-ignore
  global.TextEncoder = TextEncoder;
  // @ts-ignore
  global.TextDecoder = TextDecoder;
}

// Suppress React Native warnings in tests
global.console.warn = jest.fn();

// Mock platform
NativeModules.PlatformConstants = {
  interfaceIdiom: 'phone',
  getConstants: () => ({
    interfaceIdiom: 'phone',
    isTesting: true,
    isTV: false,
    Version: 123,
    constants: {
      interfaceIdiom: 'phone',
      isTesting: true,
      isTV: false,
      Version: 123,
    }
  })
}; 