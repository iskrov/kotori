/**
 * useOpaqueTag Hook
 * 
 * React hook for managing OPAQUE-based secret tag creation and validation
 * with step-by-step UI flow and enhanced security features.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { opaqueTagManager } from '../services/OpaqueTagManager';
import { sessionStorageManager } from '../services/SessionStorageManager';
import logger from '../utils/logger';
import {
  UseOpaqueTagReturn,
  OpaqueTagUIState,
  OpaqueTagValidation,
  OpaqueTagCreationResponse,
  OpaqueTagCreationRequest,
  OpaqueTagCreationState
} from '../types/opaqueTypes';

/**
 * Default UI state
 */
const getInitialUIState = (): OpaqueTagUIState => ({
  currentState: 'initial',
  tagName: '',
  activationPhrase: '',
  confirmationPhrase: '',
  selectedColor: '#007AFF',
  securityLevel: 'standard',
  
  // Validation states
  tagNameValid: false,
  phraseValid: false,
  phrasesMatch: false,
  
  // Loading and error states
  isLoading: false,
  error: null,
  
  // Progress tracking
  progress: 0,
  currentStep: 1,
  totalSteps: 4
});

/**
 * Default validation state
 */
const getInitialValidation = (): OpaqueTagValidation => ({
  tagName: {
    isValid: false
  },
  activationPhrase: {
    isValid: false,
    strength: 'weak'
  },
  confirmationPhrase: {
    isValid: false
  },
  securityLevel: {
    isValid: true,
    recommendation: 'Standard security provides good protection for most use cases'
  }
});

/**
 * OPAQUE Tag Hook
 */
export const useOpaqueTag = (
  existingTagNames: string[] = [],
  onTagCreated?: (tag: any) => void
): UseOpaqueTagReturn => {
  const [uiState, setUIState] = useState<OpaqueTagUIState>(getInitialUIState);
  const [validation, setValidation] = useState<OpaqueTagValidation>(getInitialValidation);
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * Validate tag name
   */
  const validateTagName = useCallback((name: string) => {
    if (!name.trim()) {
      return { isValid: false, error: 'Tag name cannot be empty' };
    }
    
    if (name.length < 2) {
      return { isValid: false, error: 'Tag name must be at least 2 characters' };
    }
    
    if (name.length > 50) {
      return { isValid: false, error: 'Tag name must be less than 50 characters' };
    }
    
    if (existingTagNames.some(existing => existing.toLowerCase() === name.toLowerCase())) {
      return { isValid: false, error: 'A tag with this name already exists' };
    }
    
    return { isValid: true };
  }, [existingTagNames]);

  /**
   * Validate activation phrase
   */
  const validateActivationPhrase = useCallback((phrase: string) => {
    if (!phrase.trim()) {
      return { isValid: false, error: 'Activation phrase cannot be empty', strength: 'weak' as const };
    }
    
    if (phrase.length < 3) {
      return { isValid: false, error: 'Activation phrase must be at least 3 characters', strength: 'weak' as const };
    }
    
    if (phrase.length > 100) {
      return { isValid: false, error: 'Activation phrase must be less than 100 characters', strength: 'weak' as const };
    }
    
    // Check for common words that might be accidentally triggered
    const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    if (commonWords.includes(phrase.toLowerCase().trim())) {
      return { 
        isValid: false, 
        error: 'Please choose a more unique phrase to avoid accidental activation',
        strength: 'weak' as const 
      };
    }
    
    // Determine strength
    let strength: 'weak' | 'medium' | 'strong' = 'weak';
    if (phrase.length >= 8) strength = 'medium';
    if (phrase.length >= 12 && /\d/.test(phrase)) strength = 'strong';
    
    return { isValid: true, strength };
  }, []);

  /**
   * Validate confirmation phrase
   */
  const validateConfirmationPhrase = useCallback((phrase: string, originalPhrase: string) => {
    if (!phrase.trim()) {
      return { isValid: false, error: 'Please confirm your activation phrase' };
    }
    
    if (phrase !== originalPhrase) {
      return { isValid: false, error: 'Phrases do not match' };
    }
    
    return { isValid: true };
  }, []);

  /**
   * Update tag name
   */
  const updateTagName = useCallback((name: string) => {
    const tagValidation = validateTagName(name);
    
    setUIState(prev => ({
      ...prev,
      tagName: name,
      tagNameValid: tagValidation.isValid
    }));
    
    setValidation(prev => ({
      ...prev,
      tagName: tagValidation
    }));
  }, [validateTagName]);

  /**
   * Update activation phrase
   */
  const updateActivationPhrase = useCallback((phrase: string) => {
    const phraseValidation = validateActivationPhrase(phrase);
    const confirmValidation = validateConfirmationPhrase(uiState.confirmationPhrase, phrase);
    
    setUIState(prev => ({
      ...prev,
      activationPhrase: phrase,
      phraseValid: phraseValidation.isValid,
      phrasesMatch: confirmValidation.isValid
    }));
    
    setValidation(prev => ({
      ...prev,
      activationPhrase: phraseValidation,
      confirmationPhrase: confirmValidation
    }));
  }, [validateActivationPhrase, validateConfirmationPhrase, uiState.confirmationPhrase]);

  /**
   * Update confirmation phrase
   */
  const updateConfirmationPhrase = useCallback((phrase: string) => {
    const confirmValidation = validateConfirmationPhrase(phrase, uiState.activationPhrase);
    
    setUIState(prev => ({
      ...prev,
      confirmationPhrase: phrase,
      phrasesMatch: confirmValidation.isValid
    }));
    
    setValidation(prev => ({
      ...prev,
      confirmationPhrase: confirmValidation
    }));
  }, [validateConfirmationPhrase, uiState.activationPhrase]);

  /**
   * Update security level
   */
  const updateSecurityLevel = useCallback((level: 'standard' | 'enhanced') => {
    const recommendation = level === 'enhanced' 
      ? 'Enhanced security provides maximum protection but requires more device resources'
      : 'Standard security provides good protection for most use cases';
    
    setUIState(prev => ({
      ...prev,
      securityLevel: level
    }));
    
    setValidation(prev => ({
      ...prev,
      securityLevel: {
        isValid: true,
        recommendation
      }
    }));
  }, []);

  /**
   * Update color
   */
  const updateColor = useCallback((color: string) => {
    setUIState(prev => ({
      ...prev,
      selectedColor: color
    }));
  }, []);

  /**
   * Calculate progress based on current step
   */
  const calculateProgress = useCallback((state: OpaqueTagCreationState): number => {
    switch (state) {
      case 'initial': return 0;
      case 'phrase-entry': return 25;
      case 'phrase-confirm': return 50;
      case 'registration': return 75;
      case 'completing': return 90;
      case 'success': return 100;
      case 'error': return 0;
      default: return 0;
    }
  }, []);

  /**
   * Update current state
   */
  const updateState = useCallback((newState: OpaqueTagCreationState) => {
    const progress = calculateProgress(newState);
    const currentStep = newState === 'initial' ? 1 : 
                      newState === 'phrase-entry' ? 2 :
                      newState === 'phrase-confirm' ? 3 :
                      newState === 'registration' ? 4 : 4;
    
    setUIState(prev => ({
      ...prev,
      currentState: newState,
      progress,
      currentStep
    }));
  }, [calculateProgress]);

  /**
   * Validate current step
   */
  const validateCurrentStep = useCallback((): boolean => {
    switch (uiState.currentState) {
      case 'initial':
        return uiState.tagNameValid && !!uiState.selectedColor;
      case 'phrase-entry':
        return uiState.phraseValid;
      case 'phrase-confirm':
        return uiState.phrasesMatch;
      case 'registration':
        return true;
      default:
        return false;
    }
  }, [uiState]);

  /**
   * Move to next step
   */
  const nextStep = useCallback(() => {
    if (!validateCurrentStep()) {
      return;
    }

    switch (uiState.currentState) {
      case 'initial':
        updateState('phrase-entry');
        break;
      case 'phrase-entry':
        updateState('phrase-confirm');
        break;
      case 'phrase-confirm':
        updateState('registration');
        break;
      default:
        break;
    }
  }, [uiState.currentState, validateCurrentStep, updateState]);

  /**
   * Move to previous step
   */
  const previousStep = useCallback(() => {
    switch (uiState.currentState) {
      case 'phrase-entry':
        updateState('initial');
        break;
      case 'phrase-confirm':
        updateState('phrase-entry');
        break;
      case 'registration':
        updateState('phrase-confirm');
        break;
      default:
        break;
    }
  }, [uiState.currentState, updateState]);

  /**
   * Create OPAQUE tag
   */
  const createTag = useCallback(async (): Promise<OpaqueTagCreationResponse> => {
    if (!mountedRef.current) {
      return { success: false, tag: {} as any, error: 'Component unmounted' };
    }

    try {
      updateState('registration');
      setUIState(prev => ({ ...prev, isLoading: true, error: null }));

      // Get device fingerprint
      const deviceFingerprint = sessionStorageManager.getDeviceFingerprint();
      if (!deviceFingerprint) {
        throw new Error('Device fingerprinting required for OPAQUE tags');
      }

      // Create tag request
      const request: OpaqueTagCreationRequest = {
        tag_name: uiState.tagName.trim(),
        activation_phrase: uiState.activationPhrase.trim(),
        color_code: uiState.selectedColor,
        device_fingerprint: deviceFingerprint.hash,
        security_level: uiState.securityLevel
      };

      updateState('completing');

      // Create OPAQUE tag
      const response = await opaqueTagManager.createOpaqueTag(request);

      if (!mountedRef.current) {
        return { success: false, tag: {} as any, error: 'Component unmounted' };
      }

      if (response.success) {
        updateState('success');
        onTagCreated?.(response.tag);
        
        // Show success message
        Alert.alert(
          'OPAQUE Tag Created!',
          `Your secure tag "${uiState.tagName}" has been created with enhanced zero-knowledge protection.`,
          [{ text: 'OK' }]
        );
      } else {
        updateState('error');
        setUIState(prev => ({ ...prev, error: response.error || 'Failed to create tag' }));
      }

      return response;
    } catch (error) {
      if (!mountedRef.current) {
        return { success: false, tag: {} as any, error: 'Component unmounted' };
      }

      logger.error('Failed to create OPAQUE tag:', error);
      updateState('error');
      
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setUIState(prev => ({ ...prev, error: errorMessage }));
      
      return {
        success: false,
        tag: {} as any,
        error: errorMessage
      };
    } finally {
      if (mountedRef.current) {
        setUIState(prev => ({ ...prev, isLoading: false }));
      }
    }
  }, [uiState, updateState, onTagCreated]);

  /**
   * Reset hook state
   */
  const reset = useCallback(() => {
    setUIState(getInitialUIState());
    setValidation(getInitialValidation());
  }, []);

  /**
   * Check if user can proceed to next step
   */
  const canProceed = validateCurrentStep();

  return {
    // State
    uiState,
    validation,
    
    // Actions
    updateTagName,
    updateActivationPhrase,
    updateConfirmationPhrase,
    updateSecurityLevel,
    updateColor,
    
    // Flow control
    nextStep,
    previousStep,
    createTag,
    reset,
    
    // Validation
    validateCurrentStep,
    canProceed
  };
}; 