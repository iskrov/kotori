/**
 * OPAQUE Tag Types
 * 
 * Type definitions for OPAQUE-based secret tags that integrate with
 * existing tag management while providing enhanced security features.
 */

import { SecretTag } from './index';

// OPAQUE Authentication Methods
export type OpaqueAuthMethod = 'registration' | 'login';

// OPAQUE Tag Creation States
export type OpaqueTagCreationState = 
  | 'initial'           // User entering tag details
  | 'phrase-entry'      // User entering activation phrase
  | 'phrase-confirm'    // User confirming activation phrase
  | 'registration'      // OPAQUE registration in progress
  | 'completing'        // Finalizing tag creation
  | 'success'           // Tag created successfully
  | 'error';            // Error occurred

// Enhanced Secret Tag with OPAQUE support
export interface OpaqueSecretTag extends Omit<SecretTag, 'phrase_salt'> {
  // OPAQUE-specific fields
  opaque_server_public_key?: string;  // Server's public key from OPAQUE
  auth_method: 'legacy' | 'opaque';   // Authentication method
  device_fingerprint?: string;        // Device binding
  session_metadata?: string;          // Encrypted session info
  
  // Enhanced security fields
  security_level: 'legacy' | 'standard' | 'enhanced';
  last_authentication?: string;       // ISO timestamp
  authentication_count: number;       // Number of successful auths
  
  // Migration support
  migrated_from?: string;             // Original tag ID if migrated
  migration_date?: string;            // When migration occurred
}

// OPAQUE Tag Creation Request
export interface OpaqueTagCreationRequest {
  tag_name: string;
  activation_phrase: string;
  color_code: string;
  device_fingerprint: string;
  security_level: 'standard' | 'enhanced';
}

// OPAQUE Tag Authentication Request  
export interface OpaqueTagAuthRequest {
  tag_id: string;
  activation_phrase: string;
  device_fingerprint: string;
}

// OPAQUE Tag Creation Response
export interface OpaqueTagCreationResponse {
  success: boolean;
  tag: OpaqueSecretTag;
  session_data?: {
    session_key: string;
    vault_key: string;
    expires_at: string;
  };
  error?: string;
}

// OPAQUE Tag Authentication Response
export interface OpaqueTagAuthResponse {
  success: boolean;
  session_data?: {
    session_key: string;
    vault_key: string;
    expires_at: string;
  };
  error?: string;
}

// UI State for OPAQUE Tag Creation
export interface OpaqueTagUIState {
  currentState: OpaqueTagCreationState;
  tagName: string;
  activationPhrase: string;
  confirmationPhrase: string;
  selectedColor: string;
  securityLevel: 'standard' | 'enhanced';
  
  // Validation states
  tagNameValid: boolean;
  phraseValid: boolean;
  phrasesMatch: boolean;
  
  // Loading and error states
  isLoading: boolean;
  error: string | null;
  
  // Progress tracking
  progress: number; // 0-100
  currentStep: number;
  totalSteps: number;
}

// OPAQUE Tag Form Validation
export interface OpaqueTagValidation {
  tagName: {
    isValid: boolean;
    error?: string;
  };
  activationPhrase: {
    isValid: boolean;
    error?: string;
    strength: 'weak' | 'medium' | 'strong';
  };
  confirmationPhrase: {
    isValid: boolean;
    error?: string;
  };
  securityLevel: {
    isValid: boolean;
    recommendation?: string;
  };
}

// OPAQUE Tag Migration Info
export interface OpaqueTagMigration {
  canMigrate: boolean;
  legacyTag: SecretTag;
  estimatedTime: number; // seconds
  securityBenefits: string[];
  risks: string[];
  requiresReAuth: boolean;
}

// OPAQUE Tag Session Info
export interface OpaqueTagSession {
  tagId: string;
  tagName: string;
  isActive: boolean;
  expiresAt: Date;
  deviceFingerprint: string;
  authMethod: 'voice' | 'manual';
  securityLevel: 'standard' | 'enhanced';
}

// OPAQUE Tag Settings
export interface OpaqueTagSettings {
  enableDeviceBinding: boolean;
  requirePhraseConfirmation: boolean;
  sessionTimeout: number; // minutes
  maxSessionExtensions: number;
  enableAnalytics: boolean;
  securityLevel: 'standard' | 'enhanced';
}

// OPAQUE Tag Analytics Event
export interface OpaqueTagAnalyticsEvent {
  type: 'creation' | 'authentication' | 'migration' | 'error';
  tagId: string;
  timestamp: Date;
  deviceFingerprint: string;
  authMethod?: 'voice' | 'manual';
  securityLevel: 'standard' | 'enhanced';
  metadata?: Record<string, any>;
}

// Component Props
export interface OpaqueTagCreationProps {
  onTagCreated: (tag: OpaqueSecretTag) => void;
  onCancel: () => void;
  existingTagNames: string[];
  settings?: Partial<OpaqueTagSettings>;
  mode?: 'creation' | 'migration';
  legacyTag?: SecretTag; // For migration mode
}

export interface OpaqueTagIndicatorProps {
  tag: OpaqueSecretTag;
  showSession?: boolean;
  showSecurityLevel?: boolean;
  onSessionToggle?: (tagId: string) => void;
  size?: 'small' | 'medium' | 'large';
}

export interface OpaqueTagMigrationProps {
  legacyTag: SecretTag;
  onMigrationStart: (tagId: string) => void;
  onMigrationComplete: (newTag: OpaqueSecretTag) => void;
  onMigrationCancel: () => void;
}

// Hook Return Types
export interface UseOpaqueTagReturn {
  // State
  uiState: OpaqueTagUIState;
  validation: OpaqueTagValidation;
  
  // Actions
  updateTagName: (name: string) => void;
  updateActivationPhrase: (phrase: string) => void;
  updateConfirmationPhrase: (phrase: string) => void;
  updateSecurityLevel: (level: 'standard' | 'enhanced') => void;
  updateColor: (color: string) => void;
  
  // Flow control
  nextStep: () => void;
  previousStep: () => void;
  createTag: () => Promise<OpaqueTagCreationResponse>;
  reset: () => void;
  
  // Validation
  validateCurrentStep: () => boolean;
  canProceed: boolean;
}

export interface UseOpaqueTagSessionReturn {
  // Session state
  activeSessions: OpaqueTagSession[];
  sessionCount: number;
  
  // Session actions
  authenticateTag: (tagId: string, phrase: string) => Promise<boolean>;
  deactivateSession: (tagId: string) => Promise<void>;
  extendSession: (tagId: string, minutes: number) => Promise<boolean>;
  
  // Session info
  isSessionActive: (tagId: string) => boolean;
  getSessionInfo: (tagId: string) => OpaqueTagSession | null;
  getTimeRemaining: (tagId: string) => number; // minutes
  
  // Events
  onSessionExpired: (callback: (tagId: string) => void) => void;
  onSessionCreated: (callback: (session: OpaqueTagSession) => void) => void;
} 