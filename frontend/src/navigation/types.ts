import { NavigatorScreenParams } from '@react-navigation/native';

// Define Params for RecordScreen explicitly
export type RecordScreenParams = {
  startRecording?: boolean;
  journalId?: string; // If opening an existing entry for recording
};

// Journal stack params
export type JournalStackParamList = {
  JournalList: undefined;
  JournalEntryDetail: { entryId: string };
  JournalEntryForm: { journalId?: string };
  ReminderForm: { reminderId?: string };
};

// Main stack params - Define Record screen params directly here
export type MainStackParamList = {
  Home: undefined;
  Journal: NavigatorScreenParams<JournalStackParamList>;
  Record: RecordScreenParams | undefined; // Keep this definition
  Calendar: undefined;
  Settings: undefined;
};

// Auth stack params
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

// Root navigator params - This is where the issue might be
// Ensure that when navigating to Main, the nested params are correctly typed
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  // Specify that Main stack might have params, including Record's params
  Main: NavigatorScreenParams<MainStackParamList>; 
};

// Declare navigation types for useNavigation hook
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
} 