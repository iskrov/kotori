// Navigation Types
export type RootStackParamList = {
  Main: undefined;
  Login: undefined;
  Register: undefined;
  JournalEntryDetail: { entryId: string } | undefined;
  JournalEntryForm: { journalId?: string };
  ReminderForm: { reminderId?: string };
  Settings: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Journal: undefined;
  Record: undefined;
  Calendar: undefined;
  Settings: undefined;
};

export type JournalStackParamList = {
  JournalList: undefined;
  JournalEntryDetail: { entryId: string };
  JournalEntryForm: { journalId?: string };
  ReminderForm: { reminderId?: string };
};

// Reminder Frequency
export enum ReminderFrequency {
  DAILY = 'daily',
  WEEKDAYS = 'weekdays',
  WEEKENDS = 'weekends',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  CUSTOM = 'custom',
}

// Data Models
export interface User {
  id: string;
  email: string;
  full_name: string;
  is_active?: boolean;
  is_superuser?: boolean;
  avatar_url?: string;
  profile_picture?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  name: string;
  count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface JournalEntry {
  id: string;
  title: string;
  content: string;
  entry_date: string;
  audio_url: string | null;
  user_id?: string;
  tags: Tag[];
  created_at: string;
  updated_at: string;
}

export interface JournalEntryCreate {
  title?: string;
  content: string;
  entry_date: string;
  audio_url?: string;
  tags?: string[];
}

export interface JournalEntryUpdate {
  title?: string;
  content?: string;
  entry_date?: string;
  audio_url?: string;
  tags?: string[];
}

export interface Reminder {
  id: string;
  title: string;
  message?: string;
  description?: string;
  frequency?: ReminderFrequency;
  is_active: boolean;
  days_of_week?: number[];
  custom_days?: string | null;
  time: string;
  user_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ReminderCreate {
  title: string;
  message: string;
  frequency: ReminderFrequency;
  time: string;
  is_active?: boolean;
  custom_days?: string;
}

export interface ReminderUpdate {
  title?: string;
  message?: string;
  frequency?: ReminderFrequency;
  time?: string;
  is_active?: boolean;
  custom_days?: string;
}

// API Response Types
export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface ApiError {
  detail: string;
  status_code: number;
} 