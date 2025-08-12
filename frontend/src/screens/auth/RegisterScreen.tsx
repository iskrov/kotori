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
import { authStyles, authColors, spacing, typography } from '../../styles/authStyles';

// Ensure web browser redirect results are handled
WebBrowser.maybeCompleteAuthSession();

type RegisterScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const RegisterScreen = () => {
  const navigation = useNavigation<RegisterScreenNavigationProp>();
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
      return { level: 66, text: 'Moderate', color: '#F59E0B' };
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
    <View style={authStyles.container}>
      <SafeScrollView 
        style={authStyles.scrollContainer}
        contentContainerStyle={authStyles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* Main Card */}
        <View style={authStyles.card}>
          {/* Logo and Title */}
          <View style={authStyles.logoSection}>
            <Image 
              source={logo} 
              style={authStyles.logo} 
              resizeMode="contain"
              accessibilityLabel="Kotori logo"
              accessibilityRole="image"
            />
            <Text style={authStyles.appTitle}>Kotori</Text>
            <Text style={authStyles.appSubtitle}>Your AI-powered voice journal</Text>
          </View>

          {/* Form Header */}
          <View style={authStyles.formHeader}>
            <Text style={authStyles.formTitle}>Create your account</Text>
            <Text style={authStyles.formSubtitle}>Start a private, voice-first journal.</Text>
          </View>

          {/* Error Message */}
          {errorMessage && (
            <View style={authStyles.errorContainer}>
              <Text style={authStyles.errorText} accessibilityRole="alert">
                {errorMessage}
              </Text>
            </View>
          )}
          
          {/* Success Message */}
          {successMessage && (
            <View style={authStyles.successContainer}>
              <Text style={authStyles.successText}>
                {successMessage}
              </Text>
              <Pressable 
                onPress={navigateToLogin}
                style={{ marginTop: spacing.xs }}
                accessibilityLabel="Sign in now"
                accessibilityRole="link"
              >
                <Text style={authStyles.footerLink}>Sign in now →</Text>
              </Pressable>
            </View>
          )}
          
          {/* Name Input */}
          <View style={authStyles.inputContainer}>
            <View style={[
              authStyles.inputWrapper,
              nameFocused && authStyles.inputWrapperFocused
            ]}>
              <Ionicons 
                name="person-outline" 
                size={18} 
                color={authColors.textMuted} 
                style={authStyles.inputIcon}
                accessibilityElementsHidden={true}
              />
              <TextInput
                style={authStyles.input}
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
          <View style={authStyles.inputContainer}>
            <View style={[
              authStyles.inputWrapper,
              emailFocused && authStyles.inputWrapperFocused
            ]}>
              <Ionicons 
                name="mail-outline" 
                size={18} 
                color={authColors.textMuted} 
                style={authStyles.inputIcon}
                accessibilityElementsHidden={true}
              />
              <TextInput
                style={authStyles.input}
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
          <View style={authStyles.inputContainer}>
            <View style={[
              authStyles.inputWrapper,
              passwordFocused && authStyles.inputWrapperFocused
            ]}>
              <Ionicons 
                name="lock-closed-outline" 
                size={18} 
                color={authColors.textMuted} 
                style={authStyles.inputIcon}
                accessibilityElementsHidden={true}
              />
              <TextInput
                style={authStyles.input}
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
                style={authStyles.eyeIcon}
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
              <View style={authStyles.passwordStrengthContainer}>
                <View style={authStyles.passwordStrengthBar}>
                  <View 
                    style={[
                      authStyles.passwordStrengthFill,
                      { 
                        width: `${passwordStrength.level}%`,
                        backgroundColor: passwordStrength.color 
                      }
                    ]}
                  />
                </View>
                <Text style={[
                  authStyles.passwordStrengthText,
                  { color: passwordStrength.color }
                ]}>
                  {passwordStrength.text}
                </Text>
              </View>
            )}
          </View>
          
          {/* Confirm Password Input */}
          <View style={authStyles.inputContainer}>
            <View style={[
              authStyles.inputWrapper,
              confirmPasswordFocused && authStyles.inputWrapperFocused
            ]}>
              <Ionicons 
                name="lock-closed-outline" 
                size={18} 
                color={authColors.textMuted} 
                style={authStyles.inputIcon}
                accessibilityElementsHidden={true}
              />
              <TextInput
                style={authStyles.input}
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
              <Text style={authStyles.errorText}>Passwords do not match</Text>
            )}
          </View>
          
          {/* Terms and Privacy Notice */}
          <View style={authStyles.termsContainer}>
            <Text style={authStyles.termsText}>
              By continuing, you agree to our{' '}
              <Text style={authStyles.termsLink}>Terms</Text>
              {' '}and{' '}
              <Text style={authStyles.termsLink}>Privacy Policy</Text>.
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
            style={authStyles.primaryButton}
          />
          
          {/* Divider */}
          <View style={authStyles.dividerContainer}>
            <View style={authStyles.dividerLine} />
            <Text style={authStyles.dividerText}>or</Text>
            <View style={authStyles.dividerLine} />
          </View>
          
          {/* Google Sign Up */}
          <Pressable 
            style={({ pressed }) => [
              authStyles.secondaryButton,
              pressed && { opacity: 0.8 }
            ]}
            onPress={handleGoogleRegister}
            disabled={isLoading || authLoading}
            accessibilityLabel="Continue with Google"
            accessibilityRole="button"
          >
            <Ionicons name="logo-google" size={20} color={authColors.googleRed} />
            <Text style={authStyles.secondaryButtonText}>Continue with Google</Text>
          </Pressable>
          
          {/* Footer Link */}
          <View style={authStyles.footerContainer}>
            <Text style={authStyles.footerText}>Already have an account?</Text>
            <Pressable 
              onPress={navigateToLogin}
              accessibilityLabel="Sign in to existing account"
              accessibilityRole="link"
            >
              <Text style={authStyles.footerLink}>Sign in</Text>
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