import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Pressable,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList, MainStackParamList } from '../../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';

import { useAuth } from '../../contexts/AuthContext';
import SafeScrollView from '../../components/SafeScrollView';
import logger from '../../utils/logger';
import LogViewer from '../../utils/LogViewer';
import OpaqueAuthButton from '../../components/OpaqueAuthButton';
import logo from '../../../assets/logo.png';
import { authStyles, authColors, spacing, getAuthStyles } from '../../styles/authStyles';
import { useAppTheme } from '../../contexts/ThemeContext';
import { kotoriTypography } from '../../styles/theme';

// Ensure web browser redirect results are handled
WebBrowser.maybeCompleteAuthSession();

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const LoginScreen = () => {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const { theme } = useAppTheme();
  const themed = getAuthStyles(theme);
  const { isLoading: authLoading } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showLogViewer, setShowLogViewer] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  
  // Check if we're in development mode
  const isDev = __DEV__;
  
  // Clear error message when inputs change
  useEffect(() => {
    if (errorMessage) {
      setErrorMessage(null);
    }
  }, [email, password]);
  
  const handleGoogleLogin = async () => {
    setErrorMessage('Google login is not available with secure authentication. Please use email and password.');
  };
  
  const navigateToRegister = () => {
    navigation.navigate('Auth', { screen: 'Register' });
  };

  const openLogViewer = () => {
    setShowLogViewer(true);
  };
  
  return (
    <View style={themed.container}>
      <SafeScrollView 
        style={themed.scrollContainer}
        contentContainerStyle={themed.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Main Card */}
        <View style={themed.card}>
          {/* Logo and Title */}
          <View style={themed.logoSection}>
            <Image 
              source={logo} 
              style={themed.logo} 
              resizeMode="contain"
              accessibilityLabel="Kotori logo"
              accessibilityRole="image"
            />
            <Text style={themed.appTitle}>Kotori</Text>
            <Text style={themed.appSubtitle}>Your AI-powered voice journal</Text>
        </View>

          {/* Form Header */}
          <View style={themed.formHeader}>
            <Text style={themed.formTitle}>Welcome back</Text>
            <Text style={themed.formSubtitle}>Log in to continue your private journal.</Text>
          </View>

          {/* Error Message */}
          {errorMessage && (
            <View style={themed.errorContainer}>
              <Text style={themed.errorText} accessibilityRole="alert">
                {errorMessage}
              </Text>
            </View>
          )}
          
          {/* Email Input */}
          <View style={themed.inputContainer}>
            <View style={[
              themed.inputWrapper,
              emailFocused && themed.inputWrapperFocused
            ]}>
              <Ionicons 
                name="mail-outline" 
                size={18} 
                color={theme.colors.textMuted}
                style={themed.inputIcon}
                accessibilityElementsHidden={true}
              />
              <TextInput
                style={themed.input}
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                placeholderTextColor={theme.colors.textMuted}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                accessibilityLabel="Email address"
                accessibilityHint="Enter your email address"
              />
            </View>
          </View>
          
          {/* Password Input */}
          <View style={themed.inputContainer}>
            <View style={[
              themed.inputWrapper,
              passwordFocused && themed.inputWrapperFocused
            ]}>
              <Ionicons 
                name="lock-closed-outline" 
                size={18} 
                color={theme.colors.textMuted}
                style={themed.inputIcon}
                accessibilityElementsHidden={true}
              />
              <TextInput
                style={themed.input}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                placeholderTextColor={theme.colors.textMuted}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                accessibilityLabel="Password"
                accessibilityHint="Enter your password"
              />
              <Pressable 
                onPress={() => setShowPassword(!showPassword)}
                style={themed.eyeIcon}
                accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                accessibilityRole="button"
              >
                <Ionicons 
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'} 
                  size={18} 
                  color={theme.colors.textMuted}
                />
              </Pressable>
            </View>
          </View>
          
          {/* Sign In Button */}
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
            style={themed.primaryButton}
          />

          {/* Divider */}
          <View style={themed.dividerContainer}>
            <View style={themed.dividerLine} />
            <Text style={themed.dividerText}>or</Text>
            <View style={themed.dividerLine} />
          </View>
          
          {/* Google Sign In */}
          <Pressable 
            style={({ pressed }) => [
              themed.secondaryButton,
              pressed && { opacity: 0.8 }
            ]}
            onPress={handleGoogleLogin}
            disabled={isLoading || authLoading}
            accessibilityLabel="Continue with Google"
            accessibilityRole="button"
          >
            <Ionicons name="logo-google" size={20} color={theme.colors.text} />
            <Text style={themed.secondaryButtonText}>Continue with Google</Text>
          </Pressable>

          {/* Footer Link */}
          <View style={themed.footerContainer}>
            <Text style={themed.footerText}>Don't have an account?</Text>
            <Pressable 
              onPress={navigateToRegister}
              accessibilityLabel="Create a new account"
              accessibilityRole="link"
            >
              <Text style={themed.footerLink}>Create one</Text>
            </Pressable>
        </View>
        </View>

        {/* Debug Button (Dev Only) */}
        {isDev && (
          <Pressable 
            style={({ pressed }) => [
              styles.debugButton,
              pressed && { opacity: 0.7 }
            ]}
            onPress={openLogViewer}
            accessibilityLabel="Show debug logs"
            accessibilityRole="button"
          >
            <Ionicons name="bug-outline" size={16} color={authColors.textMuted} />
            <Text style={styles.debugButtonText}>Show Logs</Text>
          </Pressable>
        )}
      </SafeScrollView>
      
      <LogViewer 
        visible={showLogViewer} 
        onClose={() => setShowLogViewer(false)} 
      />
    </View>
  );
};

// Minimal additional styles for debug button only
const styles = StyleSheet.create({
  debugButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: authColors.cardBg,
    borderRadius: 8,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.lg,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: authColors.border,
  },
  debugButtonText: {
    fontSize: kotoriTypography.fontSizes.xs,
    fontFamily: kotoriTypography.fontFamilies.regular,
    color: authColors.textMuted,
    marginLeft: spacing.xs,
  },
});

export default LoginScreen; 