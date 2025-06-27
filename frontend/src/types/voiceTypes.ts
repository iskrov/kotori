/**
 * Voice-related types for OPAQUE integration
 */

export interface VoiceAuthenticationResult {
  success: boolean;
  tagId?: string;
  tagName?: string;
  sessionKey?: Uint8Array;
  vaultKey?: Uint8Array;
  error?: string;
}

export interface VoicePhraseDetectionResult {
  found: boolean;
  tagId?: string;
  tagName?: string;
  action?: 'activate' | 'deactivate' | 'panic';
}

export interface VoiceSessionData {
  tagId: string;
  tagName: string;
  sessionKey: Uint8Array;
  vaultKey: Uint8Array;
  createdAt: Date;
  expiresAt: Date;
}

export interface VoiceTranscriptionOptions {
  languageCodes?: string[];
  maxAlternatives?: number;
  enableWordConfidence?: boolean;
  confidenceThreshold?: number;
  enableSecretTagDetection?: boolean;
}

export interface VoiceTranscriptionResult {
  transcript: string;
  detected_language_code?: string;
  confidence: number;
  alternatives: Array<{
    transcript: string;
    confidence: number;
  }>;
  word_confidence: Array<{
    word: string;
    confidence: number;
    start_time: number;
    end_time: number;
  }>;
  language_confidence: number;
  quality_metrics: {
    average_confidence: number;
    low_confidence_words: number;
    total_words: number;
  };
  secret_tag_detected?: VoicePhraseDetectionResult;
} 