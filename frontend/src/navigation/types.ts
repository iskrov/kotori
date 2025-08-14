import { NavigatorScreenParams } from '@react-navigation/native';

// Define Params for RecordScreen explicitly
export type RecordScreenParams = {
  journalId?: string; // If opening an existing entry for recording
  selectedDate?: string; // Date from calendar in YYYY-MM-DD format
  vibeEmoji?: string; // Emoji for vibe check-in
  vibeTag?: string; // Associated tag for vibe
  prefilledPrompt?: string; // Prefilled prompt based on vibe selection
  title?: string; // Entry title based on vibe
};

// Journal stack params (nested within Journal tab)
export type JournalStackParamList = {
  JournalList: undefined;
  JournalEntryDetail: { entryId: string };
  ReminderForm: { reminderId?: string };
  DeleteConfirmation: { entryId: string };
};

// Tab Navigator params - Only contains tab screens
export type MainTabParamList = {
  Home: undefined;
  Journal: NavigatorScreenParams<JournalStackParamList>;
  Share: undefined;
  Calendar: undefined;
  Settings: undefined;
};

// Share Preview screen params
export type SharePreviewParams = {
  templateId?: string;
  dateRange?: { start: string; end: string };
  period?: 'daily' | 'weekly' | 'monthly';
  shareId?: string;
  fromHistory?: boolean;
  enableReshare?: boolean;
  target_language?: string; // desired output language for the report
};

export type ShareHistoryParams = undefined;

// Main Stack Navigator (contains the tab navigator)
export type MainStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  Record: RecordScreenParams | undefined;
  TagManagement: undefined;
  TagDeleteConfirmation: { tagId: string; tagName: string; tagType: 'regular' | 'secret' };
  JournalEntryDetail: { entryId: string };
  ReminderForm: { reminderId?: string };
  DeleteConfirmation: { entryId: string };
  SharePreview: SharePreviewParams;
  ShareHistory: ShareHistoryParams;
};

// Auth stack params
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

// Root navigator params - Top level navigation
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainStackParamList>; 
};

// Declare navigation types for useNavigation hook
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
} 