import { NavigatorScreenParams } from '@react-navigation/native';

// Define Params for RecordScreen explicitly
export type RecordScreenParams = {
  startRecording?: boolean;
  journalId?: string; // If opening an existing entry for recording
};

// Journal stack params (nested within Journal tab)
export type JournalStackParamList = {
  JournalList: undefined;
  JournalEntryDetail: { entryId: string };
  JournalEntryForm: { journalId?: string };
  ReminderForm: { reminderId?: string };
  DeleteConfirmation: { entryId: string };
};

// Tab Navigator params - Only contains tab screens
export type MainTabParamList = {
  Home: undefined;
  Journal: NavigatorScreenParams<JournalStackParamList>;
  Calendar: undefined;
  Settings: undefined;
};

// Main Stack Navigator (contains the tab navigator)
export type MainStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  Record: RecordScreenParams | undefined;
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