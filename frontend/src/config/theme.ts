import { Platform } from 'react-native';

export interface AppColors {
  primary: string;
  secondary: string;
  background: string;
  card: string;
  text: string;
  textSecondary: string;
  textDisabled: string;
  border: string;
  notification: string;
  error: string;
  success: string;
  warning: string;
  disabled: string;
  inputBackground: string;
  statusBar: 'auto' | 'dark-content' | 'light-content';
  tabBarActive: string;
  tabBarInactive: string;
  shadow: string;
  onPrimary: string;
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
}

export interface AppTypography {
  fontFamilies: {
    regular: string;
    bold: string;
    semiBold: string;
    light: string;
    // Add more as needed (e.g., italic, specific display fonts)
  };
  fontSizes: {
    xs: number; // 12
    sm: number; // 14
    md: number; // 16 (base)
    lg: number; // 18
    xl: number; // 20
    xxl: number; // 24
    xxxl: number; // 30
    // Add more as needed
  };
  lineHeights: {
    tight: number; // 1.25
    normal: number; // 1.5
    loose: number; // 1.75
  };
  // Potentially letterSpacing, textDecoration, etc.
}

export interface AppSpacing {
  none: number; // 0
  xs: number;   // 4
  sm: number;   // 8
  md: number;   // 16 (base)
  lg: number;   // 24
  xl: number;   // 32
  xxl: number;  // 48
  // Add more as needed
}

export interface AppTheme {
  colors: AppColors;
  typography: AppTypography;
  spacing: AppSpacing;
  isDarkMode: boolean; // Add a flag to indicate current mode
  // Potentially breakpoints for responsive design, borderRadii, shadows, etc.
}

// Current App Theme (derived from existing styles, can be swapped for B&W later)
const currentColors: AppColors = {
  primary: '#7D4CDB', // Purpleish color seen in HomeScreen
  secondary: '#007bff', // A generic secondary, placeholder
  background: '#f8f9fa', // Light gray background from HomeScreen
  card: '#ffffff',       // White for cards
  text: '#333333',       // Dark gray text from HomeScreen
  textSecondary: '#666666', // Lighter gray text from HomeScreen
  textDisabled: '#AEAEAE',
  border: '#dddddd',
  notification: '#ffc107', // Example notification color
  error: '#e74c3c',       // Error color from App.tsx
  success: '#28a745',     // Example success color
  warning: '#FFC107',
  disabled: '#cccccc',
  inputBackground: '#FFFFFF',
  statusBar: 'auto',
  tabBarActive: '#7D4CDB',
  tabBarInactive: '#8e8e93',
  shadow: 'rgba(0, 0, 0, 0.1)',
  onPrimary: '#FFFFFF',
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
};

// Light Theme (Black & White)
export const lightModeColors: AppColors = {
  primary: '#7D4CDB', 
  secondary: '#03DAC6', 
  background: '#F5F5F5', 
  card: '#FFFFFF', 
  text: '#121212', 
  textSecondary: '#757575', 
  textDisabled: '#AEAEAE',
  border: '#E0E0E0', 
  notification: '#FF3B30', 
  error: '#D32F2F', 
  success: '#4CAF50', 
  warning: '#FFC107', 
  disabled: '#BDBDBD', 
  inputBackground: '#FFFFFF', 
  statusBar: 'dark-content',
  shadow: 'rgba(0, 0, 0, 0.1)',
  onPrimary: '#FFFFFF',
  tabBarActive: '#7D4CDB',
  tabBarInactive: '#8E8E93',

  black: '#000000',
  white: '#FFFFFF',
  gray50: '#FAFAFA',
  gray100: '#F5F5F5',
  gray200: '#EEEEEE',
  gray300: '#E0E0E0',
  gray400: '#BDBDBD',
  gray500: '#9E9E9E',
  gray600: '#757575',
  gray700: '#616161',
  gray800: '#424242',
  gray900: '#212121',
};

// Dark Theme
export const darkModeColors: AppColors = {
  primary: '#BB86FC', 
  secondary: '#03DAC5', 
  background: '#121212', 
  card: '#1E1E1E', 
  text: '#E0E0E0', 
  textSecondary: '#B0B0B0', 
  textDisabled: '#555555',
  border: '#272727', 
  notification: '#FF453A', 
  error: '#CF6679', 
  success: '#66BB6A', 
  warning: '#FFEB3B', 
  disabled: '#424242', 
  inputBackground: '#2C2C2C', 
  statusBar: 'light-content',
  shadow: 'rgba(0, 0, 0, 0.4)',
  onPrimary: '#000000',
  tabBarActive: '#BB86FC',
  tabBarInactive: '#707070',

  black: '#000000',
  white: '#FFFFFF',
  gray50: '#2A2A2A',
  gray100: '#3C3C3C',
  gray200: '#4A4A4A',
  gray300: '#5E5E5E',
  gray400: '#757575',
  gray500: '#9E9E9E',
  gray600: '#B0B0B0',
  gray700: '#C7C7C7',
  gray800: '#DEDEDE',
  gray900: '#F5F5F5',
};

export const typography: AppTypography = {
  fontFamilies: {
    regular: Platform.OS === 'ios' ? 'System' : 'Roboto', // Example, replace with your actual fonts
    bold: Platform.OS === 'ios' ? 'System-Bold' : 'Roboto-Bold',
    semiBold: Platform.OS === 'ios' ? 'System-Semibold' : 'Roboto-Medium',
    light: Platform.OS === 'ios' ? 'System-Light' : 'Roboto-Light',
  },
  fontSizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 30,
  },
  lineHeights: {
    tight: 1.25,
    normal: 1.5,
    loose: 1.75,
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
};

// Default theme export (will be light mode initially)
// This will be replaced by the ThemeProvider logic later.
const defaultTheme: AppTheme = {
  colors: lightModeColors, 
  typography,
  spacing,
  isDarkMode: false,
};

export default defaultTheme; 