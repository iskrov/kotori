import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator,
  Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';

import { useAuth } from '../../contexts/AuthContext';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppTheme } from '../../config/theme';
import SafeScrollView from '../../components/SafeScrollView';
import OpaqueAuthButton from '../../components/OpaqueAuthButton';

// Ensure web browser redirect results are handled
WebBrowser.maybeCompleteAuthSession();

type RegisterScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const RegisterScreen = () => {
  const navigation = useNavigation<RegisterScreenNavigationProp>();
  const { isLoading: authLoading } = useAuth();
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
  
  // Debug navigation changes
  useEffect(() => {
    console.log('RegisterScreen mounted');
    return () => {
      console.log('RegisterScreen unmounted');
    };
  }, []);
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Clear error and success messages when inputs change
  useEffect(() => {
    if (errorMessage) {
      setErrorMessage(null);
    }
    if (successMessage) {
      setSuccessMessage(null);
    }
  }, [name, email, password, confirmPassword]);
  
  const handleGoogleRegister = async () => {
    setErrorMessage('Google registration is not available with secure zero-knowledge authentication. Please use email/password registration.');
  };
  
  const navigateToLogin = () => {
    navigation.navigate('Auth', { screen: 'Login' });
  };
  
  // Check if inputs are valid without side effects
  // Form validation is now handled by OpaqueAuthButton component
  
  return (
    <View style={styles.container}>
      <SafeScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerContainer}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={navigateToLogin}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        {/* Welcome Card */}
        <View style={styles.welcomeCard}>
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Ionicons name="person-add" size={32} color={theme.colors.primary} />
            </View>
            <Text style={styles.appName}>Create Account</Text>
            <Text style={styles.tagline}>Join us and start your journaling journey</Text>
          </View>
        </View>

        {/* Registration Form Card */}
        <View style={styles.formCard}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>Sign Up</Text>
            <Text style={styles.formSubtitle}>Fill in your information to get started</Text>
          </View>

          {errorMessage && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={20} color={theme.colors.error} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}
          
          {successMessage && (
            <View style={styles.successContainer}>
              <Ionicons name="checkmark-circle-outline" size={20} color={theme.colors.success} />
              <View style={styles.successTextContainer}>
                <Text style={styles.successText}>{successMessage}</Text>
                <TouchableOpacity onPress={navigateToLogin} style={styles.signInLinkContainer}>
                  <Text style={styles.signInLinkText}>Sign in now</Text>
                  <Ionicons name="arrow-forward" size={16} color={theme.colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Name"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoCorrect={false}
                placeholderTextColor={theme.colors.textDisabled}
              />
            </View>
          </View>
          
          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email address"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor={theme.colors.textDisabled}
              />
            </View>
          </View>
          
          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor={theme.colors.textDisabled}
              />
              <TouchableOpacity 
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                <Ionicons 
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'} 
                  size={20} 
                  color={theme.colors.textSecondary} 
                />
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor={theme.colors.textDisabled}
              />
            </View>
          </View>

          {/* Password Requirements */}
          <View style={styles.passwordRequirements}>
            <Text style={styles.requirementsTitle}>Password Requirements:</Text>
            <View style={styles.requirementItem}>
              <Ionicons 
                name={password.length >= 8 ? 'checkmark-circle' : 'ellipse-outline'} 
                size={16} 
                color={password.length >= 8 ? theme.colors.success : theme.colors.textDisabled} 
              />
              <Text style={[styles.requirementText, { color: password.length >= 8 ? theme.colors.success : theme.colors.textDisabled }]}>
                At least 8 characters
              </Text>
            </View>
            <View style={styles.requirementItem}>
              <Ionicons 
                name={password === confirmPassword && password.length > 0 ? 'checkmark-circle' : 'ellipse-outline'} 
                size={16} 
                color={password === confirmPassword && password.length > 0 ? theme.colors.success : theme.colors.textDisabled} 
              />
              <Text style={[styles.requirementText, { color: password === confirmPassword && password.length > 0 ? theme.colors.success : theme.colors.textDisabled }]}>
                Passwords match
              </Text>
            </View>
          </View>
          
          <OpaqueAuthButton
            mode="register"
            name={name}
            email={email}
            password={password}
            confirmPassword={confirmPassword}
            onSuccess={() => {
              // Show success message instead of navigating
              setErrorMessage(null);
              setSuccessMessage('Account created successfully! You can now sign in with your credentials.');
              console.log('Registration successful via OPAQUE button');
            }}
            onError={(error) => {
              // Show the server error directly - validation should have been done before submission
              console.log('RegisterScreen onError called with:', error);
              setSuccessMessage(null);
              setErrorMessage(error);
            }}
            disabled={isLoading || authLoading || !!successMessage}
            style={styles.registerButton}
          />
          
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>
          
          <TouchableOpacity 
            style={styles.googleButton}
            onPress={handleGoogleRegister}
            disabled={isLoading || authLoading}
          >
            <Ionicons name="logo-google" size={20} color="#EA4335" />
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </TouchableOpacity>
        </View>

        {/* Login Prompt Card */}
        <View style={styles.loginCard}>
          <Text style={styles.loginText}>Already have an account?</Text>
          <TouchableOpacity onPress={navigateToLogin} style={styles.loginButton}>
            <Text style={styles.loginButtonText}>Sign In</Text>
            <Ionicons name="arrow-forward" size={16} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
      </SafeScrollView>
    </View>
  );
};

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.sm,
  },
  welcomeCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
    ...theme.shadows.md,
    borderColor: theme.isDarkMode ? theme.colors.border : 'transparent',
    borderWidth: theme.isDarkMode ? 1 : 0,
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primaryLight + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  appName: {
    fontSize: theme.typography.fontSizes.xxxl,
    fontWeight: 'bold',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.bold,
    marginBottom: theme.spacing.sm,
  },
  tagline: {
    fontSize: theme.typography.fontSizes.lg,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
    ...theme.shadows.md,
    borderColor: theme.isDarkMode ? theme.colors.border : 'transparent',
    borderWidth: theme.isDarkMode ? 1 : 0,
  },
  formHeader: {
    marginBottom: theme.spacing.xl,
  },
  formTitle: {
    fontSize: theme.typography.fontSizes.xxl,
    fontWeight: 'bold',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.bold,
    marginBottom: theme.spacing.xs,
  },
  formSubtitle: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.errorLight,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.error + '30',
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.medium,
    marginLeft: theme.spacing.sm,
    flex: 1,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.successLight || theme.colors.success + '20',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.success + '30',
  },
  successText: {
    color: theme.colors.success,
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.medium,
    marginBottom: theme.spacing.sm,
  },
  successTextContainer: {
    flex: 1,
    marginLeft: theme.spacing.sm,
  },
  signInLinkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
  },
  signInLinkText: {
    color: theme.colors.primary,
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.medium,
    marginRight: theme.spacing.xs,
  },
  inputContainer: {
    marginBottom: theme.spacing.lg,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    height: 56,
  },
  inputIcon: {
    marginRight: theme.spacing.md,
  },
  input: {
    flex: 1,
    fontSize: theme.typography.fontSizes.md,
    fontFamily: theme.typography.fontFamilies.regular,
    color: theme.colors.text,
  },
  eyeIcon: {
    padding: theme.spacing.xs,
  },
  passwordRequirements: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  requirementsTitle: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: '600',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.semiBold,
    marginBottom: theme.spacing.sm,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  requirementText: {
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.regular,
    marginLeft: theme.spacing.sm,
  },
  registerButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.lg,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
    ...theme.shadows.sm,
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
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.medium,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    height: 56,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  googleButtonText: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: '600',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.semiBold,
    marginLeft: theme.spacing.sm,
  },
  loginCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    ...theme.shadows.sm,
    borderColor: theme.isDarkMode ? theme.colors.border : 'transparent',
    borderWidth: theme.isDarkMode ? 1 : 0,
  },
  loginText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryLight + '20',
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  loginButtonText: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: '600',
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamilies.semiBold,
    marginRight: theme.spacing.xs,
  },
});

export default RegisterScreen; 