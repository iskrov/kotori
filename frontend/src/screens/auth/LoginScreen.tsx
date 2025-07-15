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
import { RootStackParamList, MainStackParamList } from '../../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';

import { useAuth } from '../../contexts/AuthContext';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppTheme } from '../../config/theme';
import SafeScrollView from '../../components/SafeScrollView';
import logger from '../../utils/logger';
import LogViewer from '../../utils/LogViewer';
import OpaqueAuthButton from '../../components/OpaqueAuthButton';

// Ensure web browser redirect results are handled
WebBrowser.maybeCompleteAuthSession();

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const LoginScreen = () => {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const { isLoading: authLoading } = useAuth();
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showLogViewer, setShowLogViewer] = useState(false);
  
  // Check if we're in development mode
  const isDev = __DEV__;
  
  // Clear error message when inputs change
  useEffect(() => {
    if (errorMessage) {
      setErrorMessage(null);
    }
  }, [email, password]);
  
  const handleGoogleLogin = async () => {
    setErrorMessage('Google login is not available with OPAQUE zero-knowledge authentication. Please use email/password registration and login.');
  };
  
  const navigateToRegister = () => {
    navigation.navigate('Auth', { screen: 'Register' });
  };

  const openLogViewer = () => {
    setShowLogViewer(true);
  };
  
  return (
    <View style={styles.container}>
      <SafeScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Card */}
        <View style={styles.welcomeCard}>
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Ionicons name="mic" size={32} color={theme.colors.primary} />
            </View>
            <Text style={styles.appName}>Welcome Back</Text>
            <Text style={styles.tagline}>Sign in to continue your journey</Text>
          </View>
        </View>

        {/* Login Form Card */}
        <View style={styles.formCard}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>Sign In</Text>
            <Text style={styles.formSubtitle}>Enter your credentials to access your account</Text>
          </View>

          {errorMessage && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={20} color={theme.colors.error} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}
          
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
          
          <OpaqueAuthButton
            mode="login"
            email={email}
            password={password}
            onSuccess={() => {
              // Navigation will be handled by AuthContext
              logger.info('Login successful via OPAQUE');
            }}
            onError={(error: string) => {
              setErrorMessage(error);
            }}
            disabled={!email || !password || isLoading || authLoading}
            style={styles.loginButton}
          />
          
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>
          
          <TouchableOpacity 
            style={styles.googleButton}
            onPress={handleGoogleLogin}
            disabled={isLoading || authLoading}
          >
            <Ionicons name="logo-google" size={20} color="#EA4335" />
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </TouchableOpacity>
        </View>

        {/* Register Prompt Card */}
        <View style={styles.registerCard}>
          <Text style={styles.registerText}>Don't have an account?</Text>
          <TouchableOpacity onPress={navigateToRegister} style={styles.registerButton}>
            <Text style={styles.registerButtonText}>Create Account</Text>
            <Ionicons name="arrow-forward" size={16} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        {isDev && (
          <TouchableOpacity 
            style={styles.debugButton}
            onPress={openLogViewer}
          >
            <Ionicons name="bug-outline" size={16} color={theme.colors.textSecondary} />
            <Text style={styles.debugButtonText}>Show Logs</Text>
          </TouchableOpacity>
        )}
      </SafeScrollView>
      
      <LogViewer 
        visible={showLogViewer} 
        onClose={() => setShowLogViewer(false)} 
      />
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
  loginButton: {
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
  registerCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    ...theme.shadows.sm,
    borderColor: theme.isDarkMode ? theme.colors.border : 'transparent',
    borderWidth: theme.isDarkMode ? 1 : 0,
  },
  registerText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  registerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryLight + '20',
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  registerButtonText: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: '600',
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamilies.semiBold,
    marginRight: theme.spacing.xs,
  },
  debugButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    marginTop: theme.spacing.lg,
    alignSelf: 'center',
  },
  debugButtonText: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.medium,
    marginLeft: theme.spacing.xs,
  },
});

export default LoginScreen; 