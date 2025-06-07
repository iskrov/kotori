export interface Settings {
  hapticFeedbackEnabled: boolean;
  defaultLanguage: string;
  defaultEntryPrivacy: 'private' | 'public';
  autoSaveEnabled: boolean;
  autoRecordingEnabled: boolean;
}

// Re-export UserSettings from service for consistency
export type { UserSettings } from '../services/settingsService'; 