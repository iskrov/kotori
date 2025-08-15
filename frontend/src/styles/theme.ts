import { Platform } from 'react-native';

// Re-export interfaces from the original theme for compatibility
export {
  AppColors,
  AppTypography,
  AppSpacing,
  AppBorderRadius,
  AppShadows,
  AppAnimations,
  AppTheme
} from '../config/theme';

import type { AppColors, AppTypography, AppSpacing, AppBorderRadius, AppShadows, AppAnimations } from '../config/theme';

// Kotori Design System - Calm, Low-Stimulation Color Palette
export const kotoriColors = {
  // Primary teal palette
  primary: '#2DA6A0',           // Main teal
  primaryLight: '#7CD4CF',      // Light teal for accents
  primaryDark: '#1E8B86',       // Dark teal for hover states
  primary600: '#1E8B86',        // Alias for hover states
  
  // Background colors
  bgSoft: '#F7F9FB',           // Very light gray-blue background
  background: '#F7F9FB',        // Alias for React Native compatibility
  surface: '#FFFFFF',           // Card/surface backgrounds
  card: '#FFFFFF',              // Card backgrounds
  
  // Text colors - avoiding pure black for softer contrast
  textHeading: '#0E1726',       // Deep gray for headings
  text: '#0E1726',              // Alias for primary text
  textBody: '#3C4A5E',          // Medium gray for body text
  textSecondary: '#3C4A5E',     // Alias for secondary text
  textMuted: '#8FA0B2',         // Muted gray for tertiary text
  textDisabled: '#8FA0B2',      // Disabled text color
  
  // Border and separator colors
  border: '#E6ECF1',            // Light gray borders
  borderLight: '#F3F4F6',       // Very light borders
  
  // Interactive states
  focus: '#2DA6A0',             // Focus ring color
  focusRing: '#7CD4CF40',       // Focus ring with opacity
  
  // Chip and tag colors
  chipBackground: '#E8F6F5',    // Very light teal for chips
  chipText: '#2DA6A0',          // Teal text for chips
  
  // Status colors
  error: '#DC3545',             // Error red
  errorLight: '#FEE2E2',        // Light error background
  success: '#10B981',           // Success green
  successLight: '#D1FAE5',      // Light success background
  warning: '#F59E0B',           // Warning orange
  warningLight: '#FEF3C7',      // Light warning background
  
  // Navigation colors
  tabBarActive: '#2DA6A0',      // Active tab color
  tabBarInactive: '#8FA0B2',    // Inactive tab color
  
  // Other semantic colors
  white: '#FFFFFF',
  black: '#000000',
  primaryContrast: '#FFFFFF',
  shadow: 'rgba(14, 23, 38, 0.06)', // Soft shadow color
  overlay: 'rgba(0, 0, 0, 0.5)',
  disabled: '#E6ECF1',
  notification: '#DC3545',
  
  // Input colors
  inputBackground: '#FFFFFF',
  
  // Status bar
  statusBar: 'dark-content' as const,
  
  // Additional semantic colors for compatibility
  onPrimary: '#FFFFFF',
  onSurface: '#0E1726',
  accent: '#2DA6A0',
  accentLight: '#E8F6F5',
  secondary: '#2DA6A0',         // Using teal as secondary
  secondaryLight: '#7CD4CF',
  
  // Grayscale palette
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

// Dark mode colors - adjusted for calm teal theme
export const kotoriDarkColors = {
  // Primary teal palette (adjusted for dark mode)
  primary: '#7CD4CF',           // Lighter teal for dark mode
  primaryLight: '#A8E6E2',      // Very light teal
  primaryDark: '#2DA6A0',       // Original teal as dark variant
  primary600: '#2DA6A0',        // Hover state
  
  // Background colors for dark mode
  bgSoft: '#0F172A',           // Dark blue-gray background
  background: '#0F172A',        // Dark background
  surface: '#1E293B',           // Dark surface
  card: '#1E293B',              // Dark card backgrounds
  
  // Text colors for dark mode
  textHeading: '#F1F5F9',       // Light gray for headings
  text: '#F1F5F9',              // Primary text
  textBody: '#CBD5E1',          // Medium gray for body
  textSecondary: '#CBD5E1',     // Secondary text
  textMuted: '#94A3B8',         // Muted text
  textDisabled: '#64748B',      // Disabled text
  
  // Borders for dark mode
  border: '#334155',            // Dark borders
  borderLight: '#475569',       // Lighter dark borders
  
  // Interactive states for dark mode
  focus: '#7CD4CF',             // Light teal focus
  focusRing: '#7CD4CF40',       // Focus ring with opacity
  
  // Chips for dark mode
  chipBackground: '#1E4A47',    // Dark teal chip background
  chipText: '#7CD4CF',          // Light teal text
  
  // Status colors for dark mode
  error: '#F87171',
  errorLight: '#450A0A',
  success: '#34D399',
  successLight: '#064E3B',
  warning: '#FBBF24',
  warningLight: '#451A03',
  
  // Navigation for dark mode
  tabBarActive: '#7CD4CF',
  tabBarInactive: '#64748B',
  
  // Other colors for dark mode
  white: '#FFFFFF',
  black: '#000000',
  primaryContrast: '#0F172A',
  shadow: 'rgba(0, 0, 0, 0.3)',
  overlay: 'rgba(0, 0, 0, 0.7)',
  disabled: '#475569',
  notification: '#F87171',
  inputBackground: '#334155',
  statusBar: 'light-content' as const,
  onPrimary: '#0F172A',
  onSurface: '#F1F5F9',
  accent: '#7CD4CF',
  accentLight: '#1E4A47',
  secondary: '#7CD4CF',
  secondaryLight: '#A8E6E2',
  
  // Grayscale for dark mode
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
  
  // Skeleton for dark mode
  skeleton: '#334155',
  skeletonHighlight: '#475569',
};

// Enhanced typography system with Inter/Nunito fonts
export const kotoriTypography: AppTypography = {
  fontFamilies: {
    regular: Platform.select({
      web: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif',
      ios: 'System',
      android: 'Roboto',
    }) || 'System',
    medium: Platform.select({
      web: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif',
      ios: 'System',
      android: 'Roboto Medium',
    }) || 'System',
    semiBold: Platform.select({
      web: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif',
      ios: 'System',
      android: 'Roboto Medium',
    }) || 'System',
    bold: Platform.select({
      web: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif',
      ios: 'System Bold',
      android: 'Roboto Bold',
    }) || 'System',
    light: Platform.select({
      web: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif',
      ios: 'System Light',
      android: 'Roboto Light',
    }) || 'System',
  },
  fontSizes: {
    xs: 12,
    sm: 14,
    md: 16,    // Base size
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 30,
    display: 36,
  },
  lineHeights: {
    tight: 1.25,
    normal: 1.5,   // Optimized for readability
    loose: 1.6,    // Slightly more relaxed for better readability
  },
  letterSpacing: {
    tight: -0.025,
    normal: 0,
    wide: 0.025,
  },
};

// Spacing system optimized for calm design
export const kotoriSpacing: AppSpacing = {
  none: 0,
  xs: 8,     // Increased from 4 for better breathing room
  sm: 12,    // Increased from 8
  md: 16,    // Base spacing unit
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

// Border radius for soft, friendly appearance
export const kotoriBorderRadius: AppBorderRadius = {
  none: 0,
  sm: 6,     // Slightly more rounded
  md: 8,
  lg: 12,
  xl: 16,    // Standard for cards
  xxl: 24,
  full: 9999,
};

// Soft shadows for calm, elevated feel
export const kotoriShadows: AppShadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#0E1726',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#0E1726',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 4,
  },
  lg: {
    shadowColor: '#0E1726',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
    elevation: 8,
  },
  xl: {
    shadowColor: '#0E1726',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.1,
    shadowRadius: 40,
    elevation: 12,
  },
};

// Gentle animations
export const kotoriAnimations: AppAnimations = {
  duration: {
    fast: 150,
    normal: 250,   // Slightly faster for better responsiveness
    slow: 400,     // Reduced for less jarring transitions
  },
  easing: {
    ease: 'ease',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
  },
};

// Component-level style patterns for reuse
export const componentStyles = {
  // Card component
  card: {
    backgroundColor: kotoriColors.surface,
    borderRadius: kotoriBorderRadius.xl,
    borderWidth: 1,
    borderColor: kotoriColors.border,
    shadowColor: kotoriColors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 4,
  },
  
  // Primary button
  primaryButton: {
    backgroundColor: kotoriColors.primary,
    borderRadius: 14,
    height: 48,
    paddingHorizontal: kotoriSpacing.lg,
  },
  
  // Secondary button
  secondaryButton: {
    backgroundColor: kotoriColors.surface,
    borderWidth: 1,
    borderColor: kotoriColors.border,
    borderRadius: 14,
    height: 48,
    paddingHorizontal: kotoriSpacing.lg,
  },
  
  // Input field
  input: {
    backgroundColor: kotoriColors.surface,
    borderWidth: 1,
    borderColor: kotoriColors.border,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: kotoriSpacing.md,
  },
  
  // Focus ring
  focusRing: {
    borderWidth: 2,
    borderColor: kotoriColors.focus,
    shadowColor: kotoriColors.focusRing,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  
  // Chip/tag
  chip: {
    backgroundColor: kotoriColors.chipBackground,
    borderRadius: kotoriBorderRadius.full,
    paddingHorizontal: kotoriSpacing.sm,
    paddingVertical: kotoriSpacing.xs,
  },
};

// Accessibility helpers
export const accessibilityTokens = {
  minTouchTarget: 48,
  focusOutlineWidth: 2,
  focusOutlineOffset: 2,
  contrastRatio: {
    normal: 4.5,
    large: 3.0,
  },
};

// Responsive breakpoints
export const breakpoints = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
  wide: 1440,
};

// Export updated color palettes as AppColors for compatibility
export const lightModeColors: AppColors = kotoriColors as AppColors;
export const darkModeColors: AppColors = kotoriDarkColors as AppColors;

// Export updated theme components
export const typography = kotoriTypography;
export const spacing = kotoriSpacing;
export const borderRadius = kotoriBorderRadius;
export const shadows = kotoriShadows;
export const animations = kotoriAnimations;
