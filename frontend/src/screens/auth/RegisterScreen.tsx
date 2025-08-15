import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  Pressable,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';

import { useAuth } from '../../contexts/AuthContext';
import SafeScrollView from '../../components/SafeScrollView';
import OpaqueAuthButton from '../../components/OpaqueAuthButton';
import logo from '../../../assets/logo.png';
import { authStyles, authColors, spacing, typography, getAuthStyles } from '../../styles/authStyles';
import { useAppTheme } from '../../contexts/ThemeContext';

// Ensure web browser redirect results are handled
WebBrowser.maybeCompleteAuthSession();

type RegisterScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const RegisterScreen = () => {
  const navigation = useNavigation<RegisterScreenNavigationProp>();
  const { theme } = useAppTheme();
  const themed = getAuthStyles(theme);
  const { isLoading: authLoading } = useAuth();
  
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
  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false);
  
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
    setErrorMessage('Google registration is not available with secure authentication. Please use email and password.');
  };
  
  // Calculate password strength
  const getPasswordStrength = (): { level: number; text: string; color: string } => {
    if (!password) return { level: 0, text: '', color: authColors.border };
    
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    
    if (strength <= 2) {
      return { level: 33, text: 'Weak', color: authColors.textMuted };
    } else if (strength <= 3) {
      return { level: 66, text: 'Moderate', color: authColors.warning };
    } else {
      return { level: 100, text: 'Strong', color: authColors.success };
    }
  };
  
  const passwordStrength = getPasswordStrength();
  
  const navigateToLogin = () => {
    navigation.navigate('Auth', { screen: 'Login' });
  };
  
  // Check if inputs are valid without side effects
  // Form validation is now handled by OpaqueAuthButton component
  
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
            <Text style={themed.formTitle}>Create your account</Text>
            <Text style={themed.formSubtitle}>Start a private, voice-first journal.</Text>
          </View>

          {/* Error Message */}
          {errorMessage && (
            <View style={themed.errorContainer}>
              <Text style={themed.errorText} accessibilityRole="alert">
                {errorMessage}
              </Text>
            </View>
          )}
          
          {/* Success Message */}
          {successMessage && (
            <View style={themed.successContainer}>
              <Text style={themed.successText}>
                {successMessage}
              </Text>
              <Pressable 
                onPress={navigateToLogin}
                style={{ marginTop: spacing.xs }}
                accessibilityLabel="Sign in now"
                accessibilityRole="link"
              >
                <Text style={themed.footerLink}>Sign in now →</Text>
              </Pressable>
            </View>
          )}
          
          {/* Name Input */}
          <View style={themed.inputContainer}>
            <View style={[
              themed.inputWrapper,
              nameFocused && themed.inputWrapperFocused
            ]}>
              <Ionicons 
                name="person-outline" 
                size={18} 
                color={authColors.textMuted} 
                style={themed.inputIcon}
                accessibilityElementsHidden={true}
              />
              <TextInput
                style={themed.input}
                placeholder="Name"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoCorrect={false}
                autoComplete="name"
                placeholderTextColor={authColors.textMuted}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                accessibilityLabel="Your name"
                accessibilityHint="Enter your full name"
              />
            </View>
          </View>
          
          {/* Email Input */}
          <View style={themed.inputContainer}>
            <View style={[
              themed.inputWrapper,
              emailFocused && themed.inputWrapperFocused
            ]}>
              <Ionicons 
                name="mail-outline" 
                size={18} 
                color={authColors.textMuted} 
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
                placeholderTextColor={authColors.textMuted}
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
                color={authColors.textMuted} 
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
                autoComplete="new-password"
                placeholderTextColor={authColors.textMuted}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                accessibilityLabel="Password"
                accessibilityHint="Create a strong password"
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
                  color={authColors.textMuted} 
                />
              </Pressable>
            </View>
            
            {/* Password Strength Meter */}
            {password.length > 0 && (
              <View style={themed.passwordStrengthContainer}>
                <View style={themed.passwordStrengthBar}>
                  <View 
                    style={[
                      themed.passwordStrengthFill,
                      { 
                        width: `${passwordStrength.level}%`,
                        backgroundColor: passwordStrength.color 
                      }
                    ]}
                  />
                </View>
                <Text style={[
                  themed.passwordStrengthText,
                  { color: passwordStrength.color }
                ]}>
                  {passwordStrength.text}
                </Text>
              </View>
            )}
          </View>
          
          {/* Confirm Password Input */}
          <View style={themed.inputContainer}>
            <View style={[
              themed.inputWrapper,
              confirmPasswordFocused && themed.inputWrapperFocused
            ]}>
              <Ionicons 
                name="lock-closed-outline" 
                size={18} 
                color={authColors.textMuted} 
                style={themed.inputIcon}
                accessibilityElementsHidden={true}
              />
              <TextInput
                style={themed.input}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                placeholderTextColor={authColors.textMuted}
                onFocus={() => setConfirmPasswordFocused(true)}
                onBlur={() => setConfirmPasswordFocused(false)}
                accessibilityLabel="Confirm password"
                accessibilityHint="Re-enter your password"
              />
            </View>
            {confirmPassword.length > 0 && password !== confirmPassword && (
              <Text style={themed.errorText}>Passwords do not match</Text>
            )}
          </View>
          
          {/* Terms and Privacy Notice */}
          <View style={themed.termsContainer}>
            <Text style={themed.termsText}>
              By continuing, you agree to our{' '}
              <Text style={themed.termsLink}>Terms</Text>
              {' '}and{' '}
              <Text style={themed.termsLink}>Privacy Policy</Text>.
            </Text>
          </View>
          
          {/* Create Account Button */}
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
            style={themed.primaryButton}
          />
          
          {/* Divider */}
          <View style={themed.dividerContainer}>
            <View style={themed.dividerLine} />
            <Text style={themed.dividerText}>or</Text>
            <View style={themed.dividerLine} />
          </View>
          
          {/* Google Sign Up */}
          <Pressable 
            style={({ pressed }) => [
              themed.secondaryButton,
              pressed && { opacity: 0.8 }
            ]}
            onPress={handleGoogleRegister}
            disabled={isLoading || authLoading}
            accessibilityLabel="Continue with Google"
            accessibilityRole="button"
          >
            <Ionicons name="logo-google" size={20} color={authColors.googleRed} />
            <Text style={themed.secondaryButtonText}>Continue with Google</Text>
          </Pressable>
          
          {/* Footer Link */}
          <View style={themed.footerContainer}>
            <Text style={themed.footerText}>Already have an account?</Text>
            <Pressable 
              onPress={navigateToLogin}
              accessibilityLabel="Sign in to existing account"
              accessibilityRole="link"
            >
              <Text style={themed.footerLink}>Sign in</Text>
            </Pressable>
          </View>
        </View>
      </SafeScrollView>
    </View>
  );
};

// Remove all the old styles since we're using authStyles now
const styles = StyleSheet.create({
  // Empty styles object since we're using authStyles
});

export default RegisterScreen; 