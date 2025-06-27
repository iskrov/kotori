/**
 * TypeScript type definitions for OPAQUE protocol operations
 * Provides strong typing for all OPAQUE-related interfaces
 */

// Core OPAQUE protocol types
export interface OpaqueCredentials {
  password: string;
  userIdentifier?: string;
}

export interface OpaqueRegistrationState {
  clientState: string;
  password: string;
  timestamp: Date;
}

export interface OpaqueLoginState {
  clientState: string;
  password: string;
  timestamp: Date;
}

// Server communication types
export interface ServerRegistrationRequest {
  registrationRequest: string;
  userIdentifier: string;
}

export interface ServerRegistrationResponse {
  registrationResponse: string;
  serverPublicKey: string;
}

export interface ServerLoginRequest {
  credentialRequest: string;
  userIdentifier: string;
}

export interface ServerLoginResponse {
  credentialResponse: string;
}

// Session and key management types
export interface OpaqueSession {
  sessionKey: Uint8Array;
  exportKey: Uint8Array;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface SecretTagSession {
  tagId: Uint8Array;
  dataKey: Uint8Array;
  vaultId: string;
  secretPhrase: string;
  createdAt: Date;
  expiresAt: Date;
  autoExtend: boolean;
}

export interface VaultConfiguration {
  tagId: Uint8Array;
  vaultId: string;
  dataKey: Uint8Array;
  encryptionAlgorithm: 'AES-GCM';
  keyDerivationInfo: string;
}

// Authentication result types
export interface AuthenticationResult {
  success: boolean;
  session?: OpaqueSession;
  error?: string;
  retryable: boolean;
}

export interface VoiceAuthenticationResult {
  found: boolean;
  tagId?: Uint8Array;
  vaultIds?: string[];
  dataKeys?: Map<string, Uint8Array>;
  content?: string; // For non-secret content
}

// Encryption and key derivation types
export interface EncryptionKey {
  key: Uint8Array;
  algorithm: 'AES-GCM' | 'ChaCha20-Poly1305';
  iv: Uint8Array;
}

export interface KeyDerivationParams {
  salt: Uint8Array;
  info: string;
  length: number;
  algorithm: 'HKDF-SHA256' | 'HKDF-SHA512';
}

export interface DerivedKeySet {
  encryptionKey: Uint8Array;
  macKey: Uint8Array;
  tagIdKey: Uint8Array;
  vaultKey: Uint8Array;
}

// Memory management types
export interface SecureMemoryOptions {
  autoCleanup: boolean;
  cleanupDelay: number; // in milliseconds
  maxMemoryLifetime: number; // in milliseconds
}

export interface MemoryEntry {
  data: Uint8Array;
  createdAt: Date;
  lastAccessed: Date;
  autoCleanup: boolean;
}

// Configuration and initialization types
export interface OpaqueClientConfig {
  enableWebAssembly: boolean;
  memoryManagement: SecureMemoryOptions;
  networkTimeout: number;
  maxRetryAttempts: number;
  debugMode: boolean;
}

export interface InitializationStatus {
  initialized: boolean;
  webAssemblyLoaded: boolean;
  error?: string;
  timestamp: Date;
}

// Error and logging types
export interface ErrorContext {
  operation: string;
  timestamp: Date;
  userAgent: string;
  platform: string;
  errorCode: string;
}

export interface SecurityEvent {
  type: 'AUTHENTICATION' | 'REGISTRATION' | 'KEY_DERIVATION' | 'MEMORY_CLEANUP';
  success: boolean;
  userId?: string;
  timestamp: Date;
  duration: number; // in milliseconds
  details?: Record<string, unknown>;
}

// Constants and enums
export enum OpaqueOperation {
  REGISTRATION_START = 'registration_start',
  REGISTRATION_FINISH = 'registration_finish',
  LOGIN_START = 'login_start',
  LOGIN_FINISH = 'login_finish',
  KEY_DERIVATION = 'key_derivation',
  MEMORY_CLEANUP = 'memory_cleanup'
}

export enum PlatformType {
  IOS = 'ios',
  ANDROID = 'android',
  WEB = 'web'
}

export enum SecurityLevel {
  STANDARD = 'standard',
  HIGH = 'high',
  MAXIMUM = 'maximum'
}

// Utility types for better type safety
export type SecureString = string & { readonly __brand: unique symbol };
export type UserId = string & { readonly __brand: unique symbol };
export type VaultId = string & { readonly __brand: unique symbol };
export type TagId = Uint8Array & { readonly __brand: unique symbol };

// Type guards for runtime type checking
export function isValidOpaqueSession(obj: unknown): obj is OpaqueSession {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'sessionKey' in obj &&
    'exportKey' in obj &&
    'userId' in obj &&
    'createdAt' in obj &&
    'expiresAt' in obj &&
    obj.sessionKey instanceof Uint8Array &&
    obj.exportKey instanceof Uint8Array &&
    typeof (obj as OpaqueSession).userId === 'string' &&
    (obj as OpaqueSession).createdAt instanceof Date &&
    (obj as OpaqueSession).expiresAt instanceof Date
  );
}

export function isValidAuthenticationResult(obj: unknown): obj is AuthenticationResult {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'success' in obj &&
    'retryable' in obj &&
    typeof (obj as AuthenticationResult).success === 'boolean' &&
    typeof (obj as AuthenticationResult).retryable === 'boolean'
  );
}

export function isSecureUint8Array(arr: Uint8Array): boolean {
  return arr instanceof Uint8Array && arr.length > 0;
}

// Helper types for API responses
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  timestamp: Date;
}

export type OpaqueApiResponse<T> = ApiResponse<T>;

// Event listener types for reactive programming
export interface OpaqueEventListener {
  onInitialized?: (status: InitializationStatus) => void;
  onAuthenticated?: (session: OpaqueSession) => void;
  onAuthenticationFailed?: (error: string) => void;
  onSessionExpired?: (userId: string) => void;
  onMemoryCleared?: () => void;
  onError?: (error: unknown) => void;
}

// Constants for configuration
export const OPAQUE_CONSTANTS = {
  SESSION_KEY_LENGTH: 32, // bytes
  EXPORT_KEY_LENGTH: 32, // bytes
  TAG_ID_LENGTH: 16, // bytes
  VAULT_KEY_LENGTH: 32, // bytes
  IV_LENGTH: 12, // bytes for AES-GCM
  DEFAULT_TIMEOUT: 10000, // milliseconds
  DEFAULT_MAX_RETRIES: 3,
  DEFAULT_MEMORY_LIFETIME: 300000, // 5 minutes
  MINIMUM_PASSWORD_LENGTH: 8,
  MAXIMUM_PASSWORD_LENGTH: 1024
} as const;

// Type for the constants to ensure type safety
export type OpaqueConstants = typeof OPAQUE_CONSTANTS; 