import { Platform } from 'react-native';

export interface AppColors {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  secondary: string;
  secondaryLight: string;
  background: string;
  surface: string;
  card: string;
  text: string;
  textSecondary: string;
  textDisabled: string;
  border: string;
  borderLight: string;
  notification: string;
  error: string;
  errorLight: string;
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  disabled: string;
  inputBackground: string;
  statusBar: 'auto' | 'dark-content' | 'light-content';
  tabBarActive: string;
  tabBarInactive: string;
  shadow: string;
  onPrimary: string;
  onSurface: string;
  overlay: string;
  // Semantic colors for better UX
  accent: string;
  accentLight: string;
  // Grayscale
  black: string;
  white: string;
  gray50: string;
  gray100: string;
  gray200: string;
  gray300: string;
  gray400: string;
  gray500: string;
  gray600: string;
  gray700: string;
  gray800: string;
  gray900: string;
  // Skeleton colors
  skeleton: string;
  skeletonHighlight: string;
}

export interface AppTypography {
  fontFamilies: {
    regular: string;
    medium: string;
    semiBold: string;
    bold: string;
    light: string;
  };
  fontSizes: {
    xs: number; // 12
    sm: number; // 14
    md: number; // 16 (base)
    lg: number; // 18
    xl: number; // 20
    xxl: number; // 24
    xxxl: number; // 30
    display: number; // 36
  };
  lineHeights: {
    tight: number; // 1.25
    normal: number; // 1.5
    loose: number; // 1.75
  };
  letterSpacing: {
    tight: number;
    normal: number;
    wide: number;
  };
}

export interface AppSpacing {
  none: number; // 0
  xs: number;   // 4
  sm: number;   // 8
  md: number;   // 16 (base)
  lg: number;   // 24
  xl: number;   // 32
  xxl: number;  // 48
  xxxl: number; // 64
}

export interface AppBorderRadius {
  none: number;
  sm: number;   // 4
  md: number;   // 8
  lg: number;   // 12
  xl: number;   // 16
  xxl: number;  // 24
  full: number; // 9999
}

export interface AppShadows {
  none: object;
  sm: object;
  md: object;
  lg: object;
  xl: object;
}

export interface AppAnimations {
  duration: {
    fast: number;
    normal: number;
    slow: number;
  };
  easing: {
    ease: string;
    easeIn: string;
    easeOut: string;
    easeInOut: string;
  };
}

export interface AppTheme {
  colors: AppColors;
  typography: AppTypography;
  spacing: AppSpacing;
  borderRadius: AppBorderRadius;
  shadows: AppShadows;
  animations: AppAnimations;
  isDarkMode: boolean;
}

// Enhanced Light Theme with modern color palette
export const lightModeColors: AppColors = {
  primary: '#6366F1', // Modern indigo
  primaryLight: '#A5B4FC',
  primaryDark: '#4338CA',
  secondary: '#06B6D4', // Cyan
  secondaryLight: '#67E8F9',
  background: '#FAFAFA',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  text: '#111827',
  textSecondary: '#6B7280',
  textDisabled: '#9CA3AF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  notification: '#EF4444',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  disabled: '#D1D5DB',
  inputBackground: '#FFFFFF',
  statusBar: 'dark-content',
  shadow: 'rgba(0, 0, 0, 0.1)',
  onPrimary: '#FFFFFF',
  onSurface: '#111827',
  overlay: 'rgba(0, 0, 0, 0.5)',
  accent: '#8B5CF6', // Purple accent
  accentLight: '#DDD6FE',
  tabBarActive: '#6366F1',
  tabBarInactive: '#9CA3AF',

  black: '#000000',
  white: '#FFFFFF',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',
  // Skeleton colors
  skeleton: '#E5E7EB',
  skeletonHighlight: '#F3F4F6',
};

// Enhanced Dark Theme
export const darkModeColors: AppColors = {
  primary: '#818CF8', // Lighter indigo for dark mode
  primaryLight: '#C7D2FE',
  primaryDark: '#6366F1',
  secondary: '#22D3EE',
  secondaryLight: '#7DD3FC',
  background: '#0F172A',
  surface: '#1E293B',
  card: '#1E293B',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  textDisabled: '#64748B',
  border: '#334155',
  borderLight: '#475569',
  notification: '#F87171',
  error: '#F87171',
  errorLight: '#450A0A',
  success: '#34D399',
  successLight: '#064E3B',
  warning: '#FBBF24',
  warningLight: '#451A03',
  disabled: '#475569',
  inputBackground: '#334155',
  statusBar: 'light-content',
  shadow: 'rgba(0, 0, 0, 0.3)',
  onPrimary: '#0F172A',
  onSurface: '#F1F5F9',
  overlay: 'rgba(0, 0, 0, 0.7)',
  accent: '#A78BFA',
  accentLight: '#312E81',
  tabBarActive: '#818CF8',
  tabBarInactive: '#64748B',

  black: '#000000',
  white: '#FFFFFF',
  gray50: '#1E293B',
  gray100: '#334155',
  gray200: '#475569',
  gray300: '#64748B',
  gray400: '#94A3B8',
  gray500: '#CBD5E1',
  gray600: '#E2E8F0',
  gray700: '#F1F5F9',
  gray800: '#F8FAFC',
  gray900: '#FFFFFF',
  // Skeleton colors
  skeleton: '#334155',
  skeletonHighlight: '#475569',
};

export const typography: AppTypography = {
  fontFamilies: {
    regular: Platform.OS === 'ios' ? 'SF Pro Text' : 'Roboto',
    medium: Platform.OS === 'ios' ? 'SF Pro Text Medium' : 'Roboto Medium',
    semiBold: Platform.OS === 'ios' ? 'SF Pro Text Semibold' : 'Roboto Medium',
    bold: Platform.OS === 'ios' ? 'SF Pro Text Bold' : 'Roboto Bold',
    light: Platform.OS === 'ios' ? 'SF Pro Text Light' : 'Roboto Light',
  },
  fontSizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 30,
    display: 36,
  },
  lineHeights: {
    tight: 1.25,
    normal: 1.5,
    loose: 1.75,
  },
  letterSpacing: {
    tight: -0.025,
    normal: 0,
    wide: 0.025,
  },
};

export const spacing: AppSpacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const borderRadius: AppBorderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999,
};

export const shadows: AppShadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 25,
    elevation: 12,
  },
};

export const animations: AppAnimations = {
  duration: {
    fast: 150,
    normal: 300,
    slow: 500,
  },
  easing: {
    ease: 'ease',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
  },
};

// Default theme export
const defaultTheme: AppTheme = {
  colors: lightModeColors,
  typography,
  spacing,
  borderRadius,
  shadows,
  animations,
  isDarkMode: false,
};

export default defaultTheme; 