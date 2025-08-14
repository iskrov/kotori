// Comprehensive language configuration based on Google Cloud Speech-to-Text V2
export interface LanguageOption {
  code: string;
  name: string;
  region?: string;
  popular?: boolean; // Flag for most commonly used languages
}

// Most popular languages for transcription (shown first in the selector)
export const POPULAR_LANGUAGES: LanguageOption[] = [
  // Auto-detect option
  { code: 'auto', name: 'Auto-detect', popular: true },
  
  // Top 10 most commonly used languages globally
  { code: 'en-US', name: 'English', region: 'United States', popular: true },
  { code: 'zh-CN', name: 'Chinese', region: 'Simplified', popular: true },
  { code: 'es-ES', name: 'Spanish', region: 'Spain', popular: true },
  { code: 'hi-IN', name: 'Hindi', region: 'India', popular: true },
  { code: 'ar-SA', name: 'Arabic', region: 'Saudi Arabia', popular: true },
  { code: 'pt-BR', name: 'Portuguese', region: 'Brazil', popular: true },
  { code: 'ru-RU', name: 'Russian', region: 'Russia', popular: true },
  { code: 'ja-JP', name: 'Japanese', region: 'Japan', popular: true },
  { code: 'de-DE', name: 'German', region: 'Germany', popular: true },
  { code: 'fr-FR', name: 'French', region: 'France', popular: true },
];

// Comprehensive list of all supported languages from Google Cloud Speech-to-Text V2
// Based on https://cloud.google.com/speech-to-text/v2/docs/speech-to-text-supported-languages
export const ALL_LANGUAGES: LanguageOption[] = [
  // Auto-detect
  { code: 'auto', name: 'Auto-detect', popular: true },
  
  // A
  { code: 'af-ZA', name: 'Afrikaans', region: 'South Africa' },
  { code: 'sq-AL', name: 'Albanian', region: 'Albania' },
  { code: 'am-ET', name: 'Amharic', region: 'Ethiopia' },
  { code: 'ar-DZ', name: 'Arabic', region: 'Algeria' },
  { code: 'ar-BH', name: 'Arabic', region: 'Bahrain' },
  { code: 'ar-EG', name: 'Arabic', region: 'Egypt' },
  { code: 'ar-IQ', name: 'Arabic', region: 'Iraq' },
  { code: 'ar-IL', name: 'Arabic', region: 'Israel' },
  { code: 'ar-JO', name: 'Arabic', region: 'Jordan' },
  { code: 'ar-KW', name: 'Arabic', region: 'Kuwait' },
  { code: 'ar-LB', name: 'Arabic', region: 'Lebanon' },
  { code: 'ar-MA', name: 'Arabic', region: 'Morocco' },
  { code: 'ar-OM', name: 'Arabic', region: 'Oman' },
  { code: 'ar-QA', name: 'Arabic', region: 'Qatar' },
  { code: 'ar-SA', name: 'Arabic', region: 'Saudi Arabia', popular: true },
  { code: 'ar-PS', name: 'Arabic', region: 'State of Palestine' },
  { code: 'ar-TN', name: 'Arabic', region: 'Tunisia' },
  { code: 'ar-AE', name: 'Arabic', region: 'United Arab Emirates' },
  { code: 'ar-YE', name: 'Arabic', region: 'Yemen' },
  { code: 'hy-AM', name: 'Armenian', region: 'Armenia' },
  { code: 'az-AZ', name: 'Azerbaijani', region: 'Azerbaijan' },
  
  // B
  { code: 'eu-ES', name: 'Basque', region: 'Spain' },
  { code: 'bn-BD', name: 'Bengali', region: 'Bangladesh' },
  { code: 'bn-IN', name: 'Bengali', region: 'India' },
  { code: 'bs-BA', name: 'Bosnian', region: 'Bosnia and Herzegovina' },
  { code: 'bg-BG', name: 'Bulgarian', region: 'Bulgaria' },
  { code: 'my-MM', name: 'Burmese', region: 'Myanmar' },
  
  // C
  { code: 'ca-ES', name: 'Catalan', region: 'Spain' },
  { code: 'zh-CN', name: 'Chinese', region: 'Simplified', popular: true },
  { code: 'zh-TW', name: 'Chinese', region: 'Traditional' },
  { code: 'hr-HR', name: 'Croatian', region: 'Croatia' },
  { code: 'cs-CZ', name: 'Czech', region: 'Czech Republic' },
  
  // D
  { code: 'da-DK', name: 'Danish', region: 'Denmark' },
  { code: 'nl-BE', name: 'Dutch', region: 'Belgium' },
  { code: 'nl-NL', name: 'Dutch', region: 'Netherlands' },
  
  // E
  { code: 'en-AU', name: 'English', region: 'Australia' },
  { code: 'en-CA', name: 'English', region: 'Canada' },
  { code: 'en-GH', name: 'English', region: 'Ghana' },
  { code: 'en-HK', name: 'English', region: 'Hong Kong' },
  { code: 'en-IN', name: 'English', region: 'India' },
  { code: 'en-IE', name: 'English', region: 'Ireland' },
  { code: 'en-KE', name: 'English', region: 'Kenya' },
  { code: 'en-NZ', name: 'English', region: 'New Zealand' },
  { code: 'en-NG', name: 'English', region: 'Nigeria' },
  { code: 'en-PK', name: 'English', region: 'Pakistan' },
  { code: 'en-PH', name: 'English', region: 'Philippines' },
  { code: 'en-SG', name: 'English', region: 'Singapore' },
  { code: 'en-ZA', name: 'English', region: 'South Africa' },
  { code: 'en-TZ', name: 'English', region: 'Tanzania' },
  { code: 'en-GB', name: 'English', region: 'United Kingdom' },
  { code: 'en-US', name: 'English', region: 'United States', popular: true },
  { code: 'et-EE', name: 'Estonian', region: 'Estonia' },
  
  // F
  { code: 'fil-PH', name: 'Filipino', region: 'Philippines' },
  { code: 'fi-FI', name: 'Finnish', region: 'Finland' },
  { code: 'fr-BE', name: 'French', region: 'Belgium' },
  { code: 'fr-CA', name: 'French', region: 'Canada' },
  { code: 'fr-FR', name: 'French', region: 'France', popular: true },
  { code: 'fr-CH', name: 'French', region: 'Switzerland' },
  
  // G
  { code: 'gl-ES', name: 'Galician', region: 'Spain' },
  { code: 'ka-GE', name: 'Georgian', region: 'Georgia' },
  { code: 'de-AT', name: 'German', region: 'Austria' },
  { code: 'de-DE', name: 'German', region: 'Germany', popular: true },
  { code: 'de-CH', name: 'German', region: 'Switzerland' },
  { code: 'el-GR', name: 'Greek', region: 'Greece' },
  { code: 'gu-IN', name: 'Gujarati', region: 'India' },
  
  // H
  { code: 'iw-IL', name: 'Hebrew', region: 'Israel' },
  { code: 'hi-IN', name: 'Hindi', region: 'India', popular: true },
  { code: 'hu-HU', name: 'Hungarian', region: 'Hungary' },
  
  // I
  { code: 'is-IS', name: 'Icelandic', region: 'Iceland' },
  { code: 'id-ID', name: 'Indonesian', region: 'Indonesia' },
  { code: 'it-IT', name: 'Italian', region: 'Italy' },
  { code: 'it-CH', name: 'Italian', region: 'Switzerland' },
  
  // J
  { code: 'ja-JP', name: 'Japanese', region: 'Japan', popular: true },
  { code: 'jv-ID', name: 'Javanese', region: 'Indonesia' },
  
  // K
  { code: 'kn-IN', name: 'Kannada', region: 'India' },
  { code: 'kk-KZ', name: 'Kazakh', region: 'Kazakhstan' },
  { code: 'km-KH', name: 'Khmer', region: 'Cambodia' },
  { code: 'ko-KR', name: 'Korean', region: 'South Korea' },
  { code: 'ky-KG', name: 'Kyrgyz', region: 'Kyrgyzstan' },
  
  // L
  { code: 'lo-LA', name: 'Lao', region: 'Laos' },
  { code: 'lv-LV', name: 'Latvian', region: 'Latvia' },
  { code: 'lt-LT', name: 'Lithuanian', region: 'Lithuania' },
  
  // M
  { code: 'mk-MK', name: 'Macedonian', region: 'North Macedonia' },
  { code: 'ms-MY', name: 'Malay', region: 'Malaysia' },
  { code: 'ml-IN', name: 'Malayalam', region: 'India' },
  { code: 'mt-MT', name: 'Maltese', region: 'Malta' },
  { code: 'mr-IN', name: 'Marathi', region: 'India' },
  { code: 'mn-MN', name: 'Mongolian', region: 'Mongolia' },
  
  // N
  { code: 'ne-NP', name: 'Nepali', region: 'Nepal' },
  { code: 'no-NO', name: 'Norwegian', region: 'Norway' },
  
  // P
  { code: 'ps-AF', name: 'Pashto', region: 'Afghanistan' },
  { code: 'fa-IR', name: 'Persian', region: 'Iran' },
  { code: 'pl-PL', name: 'Polish', region: 'Poland' },
  { code: 'pt-BR', name: 'Portuguese', region: 'Brazil', popular: true },
  { code: 'pt-PT', name: 'Portuguese', region: 'Portugal' },
  { code: 'pa-IN', name: 'Punjabi', region: 'India' },
  
  // R
  { code: 'ro-RO', name: 'Romanian', region: 'Romania' },
  { code: 'ru-RU', name: 'Russian', region: 'Russia', popular: true },
  
  // S
  { code: 'sr-RS', name: 'Serbian', region: 'Serbia' },
  { code: 'si-LK', name: 'Sinhala', region: 'Sri Lanka' },
  { code: 'sk-SK', name: 'Slovak', region: 'Slovakia' },
  { code: 'sl-SI', name: 'Slovenian', region: 'Slovenia' },
  { code: 'es-AR', name: 'Spanish', region: 'Argentina' },
  { code: 'es-BO', name: 'Spanish', region: 'Bolivia' },
  { code: 'es-CL', name: 'Spanish', region: 'Chile' },
  { code: 'es-CO', name: 'Spanish', region: 'Colombia' },
  { code: 'es-CR', name: 'Spanish', region: 'Costa Rica' },
  { code: 'es-DO', name: 'Spanish', region: 'Dominican Republic' },
  { code: 'es-EC', name: 'Spanish', region: 'Ecuador' },
  { code: 'es-SV', name: 'Spanish', region: 'El Salvador' },
  { code: 'es-GT', name: 'Spanish', region: 'Guatemala' },
  { code: 'es-HN', name: 'Spanish', region: 'Honduras' },
  { code: 'es-MX', name: 'Spanish', region: 'Mexico' },
  { code: 'es-NI', name: 'Spanish', region: 'Nicaragua' },
  { code: 'es-PA', name: 'Spanish', region: 'Panama' },
  { code: 'es-PY', name: 'Spanish', region: 'Paraguay' },
  { code: 'es-PE', name: 'Spanish', region: 'Peru' },
  { code: 'es-PR', name: 'Spanish', region: 'Puerto Rico' },
  { code: 'es-ES', name: 'Spanish', region: 'Spain', popular: true },
  { code: 'es-US', name: 'Spanish', region: 'United States' },
  { code: 'es-UY', name: 'Spanish', region: 'Uruguay' },
  { code: 'es-VE', name: 'Spanish', region: 'Venezuela' },
  { code: 'sw-KE', name: 'Swahili', region: 'Kenya' },
  { code: 'sw-TZ', name: 'Swahili', region: 'Tanzania' },
  { code: 'sv-SE', name: 'Swedish', region: 'Sweden' },
  
  // T
  { code: 'ta-IN', name: 'Tamil', region: 'India' },
  { code: 'ta-MY', name: 'Tamil', region: 'Malaysia' },
  { code: 'ta-SG', name: 'Tamil', region: 'Singapore' },
  { code: 'ta-LK', name: 'Tamil', region: 'Sri Lanka' },
  { code: 'te-IN', name: 'Telugu', region: 'India' },
  { code: 'th-TH', name: 'Thai', region: 'Thailand' },
  { code: 'tr-TR', name: 'Turkish', region: 'Turkey' },
  
  // U
  { code: 'uk-UA', name: 'Ukrainian', region: 'Ukraine' },
  { code: 'ur-IN', name: 'Urdu', region: 'India' },
  { code: 'ur-PK', name: 'Urdu', region: 'Pakistan' },
  { code: 'uz-UZ', name: 'Uzbek', region: 'Uzbekistan' },
  
  // V
  { code: 'vi-VN', name: 'Vietnamese', region: 'Vietnam' },
  
  // W-Z
  { code: 'cy-GB', name: 'Welsh', region: 'United Kingdom' },
  { code: 'zu-ZA', name: 'Zulu', region: 'South Africa' },
];

// Export the combined list for backwards compatibility
export const SUPPORTED_LANGUAGES = ALL_LANGUAGES;

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