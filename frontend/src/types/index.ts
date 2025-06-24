// Navigation Types
export type RootStackParamList = {
  Main: undefined;
  Login: undefined;
  Register: undefined;
  JournalEntryDetail: { entryId: number } | undefined;
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
  JournalEntryDetail: { entryId: number };
  ReminderForm: { reminderId?: string };
  DeleteConfirmation: { entryId: number };
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
  id: number;
  name: string;
  color?: string;
  count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface JournalEntry {
  id: number;
  title: string;
  content: string;
  entry_date: string;
  audio_url: string | null;
  user_id?: string;
  tags: Tag[];
  created_at: string;
  updated_at: string;
  // Zero-Knowledge Encryption fields (for secret tag entries)
  encrypted_content?: string;
  encryption_iv?: string;
  encryption_salt?: string;
  encrypted_key?: string;
  key_derivation_iterations?: number;
  encryption_algorithm?: string;
  encryption_wrap_iv?: string;
  // Secret Tags fields
  secret_tag_id?: string | null;  // UUID of the secret tag (if any)
  secret_tag_hash?: string | null; // Hash of secret tag for server-side filtering
}

export interface JournalEntryCreate {
  title?: string;
  content: string;
  entry_date: string;
  audio_url?: string;
  tags?: string[];
  // Zero-Knowledge Encryption fields (for secret tag entries)
  encrypted_content?: string;
  encryption_iv?: string;
  encryption_salt?: string;
  encrypted_key?: string;
  key_derivation_iterations?: number;
  encryption_algorithm?: string;
  encryption_wrap_iv?: string;
  // Secret Tags fields
  secret_tag_id?: string | null;
  secret_tag_hash?: string | null;
}

export interface JournalEntryUpdate {
  title?: string;
  content?: string;
  entry_date?: string;
  audio_url?: string;
  tags?: string[];
  // Secret Tags fields
  secret_tag_id?: string | null;
  secret_tag_hash?: string | null;
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

// Secret Tag Types (Server-side Hash Verification)
export interface SecretTag {
  id: string;
  tag_name: string;
  phrase_salt: number[]; // 32-byte salt as array of integers
  color_code: string; // Hex color code for UI
  created_at: string;
  updated_at: string;
  user_id: number;
}

export interface SecretTagCreateRequest {
  tag_name: string;
  phrase_salt: number[]; // 32-byte salt as array of integers
  phrase_hash: string; // Argon2 hash of the secret phrase
  color_code: string; // Hex color code for UI
}

export interface SecretTagResponse {
  id: string;
  tag_name: string;
  phrase_salt: number[]; // 32-byte salt as array of integers
  color_code: string; // Hex color code for UI
  created_at: string;
  updated_at: string;
  user_id: number;
}

export interface SecretTagListResponse {
  tags: SecretTag[];
  total: number;
}

export interface PhraseVerificationRequest {
  phrase: string;
  tag_id: string;
}

export interface PhraseVerificationResponse {
  is_valid: boolean;
  tag_name: string;
} 