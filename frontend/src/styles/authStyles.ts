import { StyleSheet, Platform, Dimensions } from 'react-native';
import { kotoriColors, kotoriSpacing, kotoriTypography, kotoriShadows, kotoriBorderRadius } from './theme';
import type { AppTheme } from '../config/theme';

// Get screen dimensions for responsive design
const { width: screenWidth } = Dimensions.get('window');

// Use the centralized color tokens
export const authColors = kotoriColors;

// Use centralized design tokens
export const spacing = kotoriSpacing;

// Responsive card width
export const getCardWidth = () => {
  if (Platform.OS === 'web') {
    return Math.min(screenWidth - 32, 440);
  }
  return screenWidth - 32;
};

// Shared auth screen styles
export const authStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: authColors.background,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  
  // Main card container
  card: {
    backgroundColor: authColors.surface,
    borderRadius: kotoriBorderRadius.xxl,
    padding: Platform.select({
      web: 40,
      default: 28,
    }),
    width: '100%',
    maxWidth: 440,
    marginBottom: spacing.lg,
    ...kotoriShadows.md,
  },
  
  // Logo and header section
  logoSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: spacing.md,
  },
  appTitle: {
    fontSize: kotoriTypography.fontSizes.xxxl,
    fontFamily: kotoriTypography.fontFamilies.semiBold,
    fontWeight: '600',
    color: authColors.textHeading,
    marginBottom: spacing.xs,
  },
  appSubtitle: {
    fontSize: kotoriTypography.fontSizes.lg,
    fontFamily: kotoriTypography.fontFamilies.regular,
    fontWeight: '400',
    color: authColors.textMuted,
    textAlign: 'center',
  },
  
  // Form header
  formHeader: {
    marginBottom: spacing.xl,
  },
  formTitle: {
    fontSize: kotoriTypography.fontSizes.xxl,
    fontFamily: kotoriTypography.fontFamilies.semiBold,
    fontWeight: '600',
    color: authColors.textHeading,
    marginBottom: spacing.xs,
  },
  formSubtitle: {
    fontSize: kotoriTypography.fontSizes.md,
    fontFamily: kotoriTypography.fontFamilies.regular,
    fontWeight: '400',
    color: authColors.textBody,
  },
  
  // Input styles
  inputContainer: {
    marginBottom: spacing.md,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: authColors.card,
    borderWidth: 1,
    borderColor: authColors.border,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: spacing.md,
  },
  inputWrapperFocused: {
    borderColor: authColors.focus,
    ...Platform.select({
      web: {
        boxShadow: `0 0 0 2px ${authColors.focusRing}`,
      },
      default: {},
    }),
  },
  inputIcon: {
    marginRight: spacing.sm,
    color: authColors.textMuted,
    fontSize: 18,
  },
  input: {
    flex: 1,
    fontSize: kotoriTypography.fontSizes.md,
    fontFamily: kotoriTypography.fontFamilies.regular,
    fontWeight: '400',
    color: authColors.textBody,
    paddingVertical: 0,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
      default: {},
    }),
  },
  eyeIcon: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
  
  // Button styles
  primaryButton: {
    backgroundColor: authColors.primary,
    borderRadius: 14,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  primaryButtonPressed: {
    backgroundColor: authColors.primary600,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: authColors.white,
    fontSize: kotoriTypography.fontSizes.md,
    fontFamily: kotoriTypography.fontFamilies.medium,
    fontWeight: '500',
  },
  
  // Secondary button (Google)
  secondaryButton: {
    backgroundColor: authColors.white,
    borderWidth: 1,
    borderColor: authColors.border,
    borderRadius: 14,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: authColors.textBody,
    fontSize: kotoriTypography.fontSizes.md,
    fontFamily: kotoriTypography.fontFamilies.medium,
    fontWeight: '500',
    marginLeft: spacing.sm,
  },
  
  // Divider
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: authColors.border,
  },
  dividerText: {
    marginHorizontal: spacing.md,
    fontSize: kotoriTypography.fontSizes.sm,
    fontFamily: kotoriTypography.fontFamilies.regular,
    color: authColors.textMuted,
  },
  
  // Error and success messages
  errorContainer: {
    marginBottom: spacing.md,
  },
  errorText: {
    color: authColors.error,
    fontSize: kotoriTypography.fontSizes.xs,
    fontFamily: kotoriTypography.fontFamilies.regular,
    marginTop: 4,
  },
  successContainer: {
    backgroundColor: `${authColors.success}10`,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  successText: {
    color: authColors.success,
    fontSize: kotoriTypography.fontSizes.sm,
    fontFamily: kotoriTypography.fontFamilies.regular,
  },
  
  // Footer link
  footerContainer: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  footerText: {
    fontSize: kotoriTypography.fontSizes.md,
    fontFamily: kotoriTypography.fontFamilies.regular,
    color: authColors.textMuted,
    marginBottom: spacing.xs,
  },
  footerLink: {
    color: authColors.primary,
    fontSize: kotoriTypography.fontSizes.md,
    fontFamily: kotoriTypography.fontFamilies.medium,
    fontWeight: '500',
  },
  
  // Terms and privacy
  termsContainer: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  termsText: {
    fontSize: kotoriTypography.fontSizes.xs,
    fontFamily: kotoriTypography.fontFamilies.regular,
    color: authColors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    color: authColors.primary,
    textDecorationLine: 'underline',
  },
  
  // Password strength meter
  passwordStrengthContainer: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  passwordStrengthBar: {
    height: 3,
    backgroundColor: authColors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  passwordStrengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  passwordStrengthText: {
    fontSize: kotoriTypography.fontSizes.xs,
    fontFamily: kotoriTypography.fontFamilies.regular,
    marginTop: 4,
  },
  
  // Utility classes
  hiddenText: {
    position: 'absolute',
    left: -9999,
    width: 1,
    height: 1,
    overflow: 'hidden',
  },
});

// Theme-aware auth styles for dark mode support
export const getAuthStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContainer: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      alignItems: 'center',
      paddingVertical: theme.spacing.xl,
      paddingHorizontal: theme.spacing.md,
    },
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.borderRadius.xxl,
      padding: Platform.select({ web: 40, default: 28 }),
      width: '100%',
      maxWidth: 440,
      marginBottom: theme.spacing.lg,
      ...theme.shadows.md,
      borderWidth: 1,
      borderColor: theme.isDarkMode ? theme.colors.border : 'transparent',
    },
    logoSection: {
      alignItems: 'center',
      marginBottom: theme.spacing.xl,
    },
    logo: {
      width: 80,
      height: 80,
      marginBottom: theme.spacing.md,
    },
    appTitle: {
      fontSize: theme.typography.fontSizes.xxxl,
      fontFamily: theme.typography.fontFamilies.semiBold,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: theme.spacing.xs,
    },
    appSubtitle: {
      fontSize: theme.typography.fontSizes.lg,
      fontFamily: theme.typography.fontFamilies.regular,
      fontWeight: '400',
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    formHeader: {
      marginBottom: theme.spacing.xl,
    },
    formTitle: {
      fontSize: theme.typography.fontSizes.xxl,
      fontFamily: theme.typography.fontFamilies.semiBold,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: theme.spacing.xs,
    },
    formSubtitle: {
      fontSize: theme.typography.fontSizes.md,
      fontFamily: theme.typography.fontFamilies.regular,
      fontWeight: '400',
      color: theme.colors.textSecondary,
    },
    inputContainer: {
      marginBottom: theme.spacing.md,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.inputBackground ?? theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      height: 48,
      paddingHorizontal: theme.spacing.md,
    },
    inputWrapperFocused: {
      borderColor: theme.colors.primary,
      ...Platform.select({
        web: {
          boxShadow: `0 0 0 2px ${theme.colors.primaryLight + '40'}`,
        },
        default: {},
      }),
    },
    inputIcon: {
      marginRight: theme.spacing.sm,
      color: theme.colors.textSecondary,
      fontSize: 18,
    },
    input: {
      flex: 1,
      fontSize: theme.typography.fontSizes.md,
      fontFamily: theme.typography.fontFamilies.regular,
      fontWeight: '400',
      color: theme.colors.text,
      paddingVertical: 0,
      ...Platform.select({ web: { outlineStyle: 'none' }, default: {} }),
    },
    eyeIcon: {
      padding: theme.spacing.xs,
      marginLeft: theme.spacing.xs,
    },
    primaryButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 14,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: theme.spacing.xs,
      marginBottom: theme.spacing.lg,
    },
    primaryButtonPressed: {
      backgroundColor: theme.colors.primaryDark || theme.colors.primary,
    },
    primaryButtonDisabled: {
      opacity: 0.5,
    },
    primaryButtonText: {
      color: theme.colors.onPrimary,
      fontSize: theme.typography.fontSizes.md,
      fontFamily: theme.typography.fontFamilies.medium,
      fontWeight: '500',
    },
    secondaryButton: {
      backgroundColor: theme.isDarkMode ? theme.colors.card : theme.colors.white,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 14,
      height: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryButtonText: {
      color: theme.colors.text,
      fontSize: theme.typography.fontSizes.md,
      fontFamily: theme.typography.fontFamilies.medium,
      fontWeight: '500',
      marginLeft: theme.spacing.sm,
    },
    dividerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: theme.spacing.lg,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.colors.border,
    },
    dividerText: {
      marginHorizontal: theme.spacing.md,
      fontSize: theme.typography.fontSizes.sm,
      fontFamily: theme.typography.fontFamilies.regular,
      color: theme.colors.textSecondary,
    },
    errorContainer: { marginBottom: theme.spacing.md },
    errorText: {
      color: theme.colors.error,
      fontSize: theme.typography.fontSizes.xs,
      fontFamily: theme.typography.fontFamilies.regular,
      marginTop: 4,
    },
    successContainer: {
      backgroundColor: `${theme.colors.success}10`,
      borderRadius: 8,
      padding: theme.spacing.sm,
      marginBottom: theme.spacing.md,
    },
    successText: {
      color: theme.colors.success,
      fontSize: theme.typography.fontSizes.sm,
      fontFamily: theme.typography.fontFamilies.regular,
    },
    footerContainer: { alignItems: 'center', marginTop: theme.spacing.lg },
    footerText: {
      fontSize: theme.typography.fontSizes.md,
      fontFamily: theme.typography.fontFamilies.regular,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.xs,
    },
    footerLink: {
      color: theme.colors.primary,
      fontSize: theme.typography.fontSizes.md,
      fontFamily: theme.typography.fontFamilies.medium,
      fontWeight: '500',
    },
    termsContainer: {
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
    },
    termsText: {
      fontSize: theme.typography.fontSizes.xs,
      fontFamily: theme.typography.fontFamilies.regular,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
    },
    termsLink: { color: theme.colors.primary, textDecorationLine: 'underline' },
    passwordStrengthContainer: { marginTop: theme.spacing.xs, marginBottom: theme.spacing.sm },
    passwordStrengthBar: {
      height: 3,
      backgroundColor: theme.colors.border,
      borderRadius: 2,
      overflow: 'hidden',
    },
    passwordStrengthFill: { height: '100%', borderRadius: 2 },
    passwordStrengthText: {
      fontSize: theme.typography.fontSizes.xs,
      fontFamily: theme.typography.fontFamilies.regular,
      marginTop: 4,
    },
    hiddenText: { position: 'absolute', left: -9999, width: 1, height: 1, overflow: 'hidden' },
  });
