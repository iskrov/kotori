// Simplified language configuration for single language speech recognition
export interface LanguageOption {
  code: string;
  name: string;
  region?: string;
}

// Simplified list of most common languages for transcription
export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  // Auto-detect option
  { code: 'auto', name: 'Auto-detect' },
  
  // English variants
  { code: 'en-US', name: 'English', region: 'United States' },
  { code: 'en-GB', name: 'English', region: 'United Kingdom' },
  { code: 'en-AU', name: 'English', region: 'Australia' },
  { code: 'en-CA', name: 'English', region: 'Canada' },
  
  // Spanish variants
  { code: 'es-ES', name: 'Spanish', region: 'Spain' },
  { code: 'es-MX', name: 'Spanish', region: 'Mexico' },
  { code: 'es-US', name: 'Spanish', region: 'United States' },
  
  // French variants
  { code: 'fr-FR', name: 'French', region: 'France' },
  { code: 'fr-CA', name: 'French', region: 'Canada' },
  
  // German
  { code: 'de-DE', name: 'German', region: 'Germany' },
  
  // Italian
  { code: 'it-IT', name: 'Italian', region: 'Italy' },
  
  // Portuguese
  { code: 'pt-BR', name: 'Portuguese', region: 'Brazil' },
  { code: 'pt-PT', name: 'Portuguese', region: 'Portugal' },
  
  // Chinese
  { code: 'zh-CN', name: 'Chinese', region: 'Simplified' },
  { code: 'zh-TW', name: 'Chinese', region: 'Traditional' },
  
  // Japanese
  { code: 'ja-JP', name: 'Japanese', region: 'Japan' },
  
  // Korean
  { code: 'ko-KR', name: 'Korean', region: 'South Korea' },
  
  // Russian
  { code: 'ru-RU', name: 'Russian', region: 'Russia' },
  
  // Arabic
  { code: 'ar-SA', name: 'Arabic', region: 'Saudi Arabia' },
  
  // Hindi
  { code: 'hi-IN', name: 'Hindi', region: 'India' },
  
  // Dutch
  { code: 'nl-NL', name: 'Dutch', region: 'Netherlands' },
  
  // Polish
  { code: 'pl-PL', name: 'Polish', region: 'Poland' },
  
  // Turkish
  { code: 'tr-TR', name: 'Turkish', region: 'Turkey' },
  
  // Swedish
  { code: 'sv-SE', name: 'Swedish', region: 'Sweden' },
  
  // Norwegian
  { code: 'no-NO', name: 'Norwegian', region: 'Norway' },
  
  // Danish
  { code: 'da-DK', name: 'Danish', region: 'Denmark' },
  
  // Finnish
  { code: 'fi-FI', name: 'Finnish', region: 'Finland' },
];

// Get a human-readable language name from a language code
export function getLanguageName(languageCode: string): string | null {
  const language = SUPPORTED_LANGUAGES.find(lang => lang.code === languageCode);
  if (language) {
    if (language.code === 'auto') return language.name;
    return language.region ? `${language.name} (${language.region})` : language.name;
  }
  
  // Try to match by primary language code (before the dash)
  const langPart = languageCode.split('-')[0];
  const match = SUPPORTED_LANGUAGES.find(lang => lang.code.startsWith(langPart + '-'));
  return match ? (match.region ? `${match.name} (${match.region})` : match.name) : null;
}

// Get default language code
export function getDefaultLanguageCode(): string {
  return 'auto'; // Default to auto-detect
}

// Validate single language code
export function validateLanguageCode(languageCode: string): boolean {
  return SUPPORTED_LANGUAGES.some(lang => lang.code === languageCode);
} 