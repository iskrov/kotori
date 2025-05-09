// Language configuration for the application
export interface LanguageOption {
  code: string;
  name: string;
  selected?: boolean;
}

// List of supported languages for transcription
export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en-US', name: 'English (US)' },
  { code: 'en-GB', name: 'English (UK)' },
  { code: 'es-ES', name: 'Spanish' },
  { code: 'fr-FR', name: 'French' },
  { code: 'de-DE', name: 'German' },
  { code: 'it-IT', name: 'Italian' },
  { code: 'pt-BR', name: 'Portuguese' },
  { code: 'ru-RU', name: 'Russian' },
  { code: 'ja-JP', name: 'Japanese' },
  { code: 'ko-KR', name: 'Korean' },
  { code: 'zh-CN', name: 'Chinese' },
  { code: 'zh-TW', name: 'Chinese' },
  { code: 'ar-SA', name: 'Arabic' },
  { code: 'hi-IN', name: 'Hindi' },
  { code: 'nl-NL', name: 'Dutch' },
  { code: 'pl-PL', name: 'Polish' },
  { code: 'tr-TR', name: 'Turkish' },
];

// Maximum number of languages that can be selected at once
export const MAX_LANGUAGE_SELECTION = 3;

// Get a human-readable language name from a language code
export function getLanguageName(languageCode: string): string | null {
  const language = SUPPORTED_LANGUAGES.find(lang => lang.code === languageCode);
  if (language) return language.name;
  
  // Try to match by primary language code (before the dash)
  const langPart = languageCode.split('-')[0];
  const match = SUPPORTED_LANGUAGES.find(lang => lang.code.startsWith(langPart + '-'));
  return match ? match.name : null;
}

// Format language options for initial state (with default selection)
export function getInitialLanguageOptions(defaultCode: string = 'en-US'): LanguageOption[] {
  return SUPPORTED_LANGUAGES.map(lang => ({
    ...lang,
    selected: lang.code === defaultCode
  }));
} 