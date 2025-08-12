import { StyleSheet, Platform, Dimensions } from 'react-native';
import { kotoriColors, kotoriSpacing, kotoriTypography, kotoriShadows, kotoriBorderRadius } from './theme';

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
    backgroundColor: authColors.cardBg,
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
    color: authColors.danger,
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
