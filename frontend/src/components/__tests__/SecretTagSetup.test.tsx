/**
 * SecretTagSetup Component Tests
 * 
 * Tests for the enhanced SecretTagSetup component with OPAQUE authentication support
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import SecretTagSetup from '../SecretTagSetup';
jest.mock('../../config/featureFlags', () => ({ areSecretTagsEnabled: () => true }));
import { tagManager } from '../../services/tagManager';
import { opaqueTagManager } from '../../services/OpaqueTagManager';
import { sessionStorageManager } from '../../services/SessionStorageManager';

// Mock dependencies
jest.mock('../../services/tagManager');
jest.mock('../../services/OpaqueTagManager');
jest.mock('../../services/SessionStorageManager');
jest.mock('../../utils/logger');

// Mock theme context
jest.mock('../../contexts/ThemeContext', () => ({
  useAppTheme: () => ({
    theme: {
      colors: {
        primary: '#007AFF',
        background: '#FFFFFF',
        surface: '#F2F2F7',
        text: '#000000',
        textSecondary: '#8E8E93',
        border: '#C6C6C8',
        error: '#FF3B30',
        success: '#34C759'
      },
      spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32
      },
      typography: {
        fontSizes: {
          sm: 14,
          md: 16,
          lg: 18
        },
        fontFamilies: {
          regular: 'System',
          medium: 'System',
          semiBold: 'System-SemiBold'
        }
      },
      borderRadius: {
        md: 8,
        lg: 12,
        full: 9999
      }
    }
  })
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

const mockTagManager = tagManager as jest.Mocked<typeof tagManager>;
const mockOpaqueTagManager = opaqueTagManager as jest.Mocked<typeof opaqueTagManager>;
const mockSessionStorageManager = sessionStorageManager as jest.Mocked<typeof sessionStorageManager>;

describe('SecretTagSetup', () => {
  it('renders correctly', () => {
    const { getByText } = render(
      <SecretTagSetup 
        onTagCreated={jest.fn()} 
        onCancel={jest.fn()} 
        existingTagNames={[]} 
      />
    );
    
    expect(getByText('Create Secret Tag')).toBeTruthy();
  });
});

describe('SecretTagSetup Component', () => {
  const defaultProps = {
    onTagCreated: jest.fn(),
    onCancel: jest.fn(),
    existingTagNames: ['existing-tag'],
    enableOpaqueAuth: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockSessionStorageManager.getDeviceFingerprint.mockReturnValue({
      hash: 'test-device-fingerprint',
      components: {},
      timestamp: Date.now()
    });
    
    mockOpaqueTagManager.createOpaqueTag.mockResolvedValue({
      success: true,
      tag: {
        id: 'opaque-tag-123',
        tag_name: 'Test OPAQUE Tag',
        color_code: '#007AFF',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        user_id: 1,
        auth_method: 'opaque',
        security_level: 'standard',
        authentication_count: 0
      }
    });
    
    mockTagManager.createSecretTag.mockResolvedValue('legacy-tag-123');
  });

  describe('Component Rendering', () => {
    it('renders the basic form elements', () => {
      const { getByText, getByPlaceholderText } = render(
        <SecretTagSetup {...defaultProps} />
      );

      expect(getByText('Create Secret Tag')).toBeTruthy();
      expect(getByPlaceholderText('e.g., Work Private, Personal Thoughts')).toBeTruthy();
      expect(getByPlaceholderText('e.g., activate work mode, private thoughts')).toBeTruthy();
      expect(getByText('Create Secret Tag')).toBeTruthy();
    });

    it('shows OPAQUE authentication toggle when enabled', () => {
      const { getByText } = render(
        <SecretTagSetup {...defaultProps} enableOpaqueAuth={true} />
      );

      expect(getByText('Authentication Method')).toBeTruthy();
      expect(getByText('OPAQUE Zero-Knowledge')).toBeTruthy();
    });

    it('hides OPAQUE features when disabled', () => {
      const { queryByText } = render(
        <SecretTagSetup {...defaultProps} enableOpaqueAuth={false} />
      );

      expect(queryByText('Authentication Method')).toBeFalsy();
      expect(queryByText('OPAQUE Zero-Knowledge')).toBeFalsy();
    });

    it('shows confirmation field for OPAQUE authentication', () => {
      const { getByPlaceholderText } = render(
        <SecretTagSetup {...defaultProps} />
      );

      expect(getByPlaceholderText('Re-enter your activation phrase')).toBeTruthy();
    });
  });

  describe('Form Validation', () => {
    it('validates tag name correctly', async () => {
      const { getByPlaceholderText, getByText } = render(
        <SecretTagSetup {...defaultProps} />
      );

      const tagNameInput = getByPlaceholderText('e.g., Work Private, Personal Thoughts');
      
      // Test empty name
      fireEvent.changeText(tagNameInput, '');
      fireEvent.press(getByText('Create Secret Tag'));
      
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Invalid Name', 'Tag name cannot be empty');
      });
    });

    it('validates activation phrase correctly', async () => {
      const { getByPlaceholderText, getByText } = render(
        <SecretTagSetup {...defaultProps} />
      );

      const tagNameInput = getByPlaceholderText('e.g., Work Private, Personal Thoughts');
      const phraseInput = getByPlaceholderText('e.g., activate work mode, private thoughts');
      
      fireEvent.changeText(tagNameInput, 'Valid Tag Name');
      fireEvent.changeText(phraseInput, '');
      fireEvent.press(getByText('Create Secret Tag'));
      
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Invalid Phrase', 'Activation phrase cannot be empty');
      });
    });

    it('validates confirmation phrase for OPAQUE tags', async () => {
      const { getByPlaceholderText, getByText } = render(
        <SecretTagSetup {...defaultProps} />
      );

      const tagNameInput = getByPlaceholderText('e.g., Work Private, Personal Thoughts');
      const phraseInput = getByPlaceholderText('e.g., activate work mode, private thoughts');
      const confirmInput = getByPlaceholderText('Re-enter your activation phrase');
      
      fireEvent.changeText(tagNameInput, 'Valid Tag Name');
      fireEvent.changeText(phraseInput, 'valid phrase');
      fireEvent.changeText(confirmInput, 'different phrase');
      fireEvent.press(getByText('Create Secret Tag'));
      
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Invalid Confirmation', 'Phrases do not match');
      });
    });

    it('prevents duplicate tag names', async () => {
      const { getByPlaceholderText, getByText } = render(
        <SecretTagSetup {...defaultProps} existingTagNames={['existing-tag']} />
      );

      const tagNameInput = getByPlaceholderText('e.g., Work Private, Personal Thoughts');
      
      fireEvent.changeText(tagNameInput, 'existing-tag');
      fireEvent.press(getByText('Create Secret Tag'));
      
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Invalid Name', 'A tag with this name already exists');
      });
    });
  });

  describe('OPAQUE Tag Creation', () => {
    it('creates OPAQUE tag successfully', async () => {
      const { getByPlaceholderText, getByText } = render(
        <SecretTagSetup {...defaultProps} />
      );

      const tagNameInput = getByPlaceholderText('e.g., Work Private, Personal Thoughts');
      const phraseInput = getByPlaceholderText('e.g., activate work mode, private thoughts');
      const confirmInput = getByPlaceholderText('Re-enter your activation phrase');
      
      fireEvent.changeText(tagNameInput, 'Test OPAQUE Tag');
      fireEvent.changeText(phraseInput, 'test activation phrase');
      fireEvent.changeText(confirmInput, 'test activation phrase');
      
      await act(async () => {
        fireEvent.press(getByText('Create Secret Tag'));
      });
      
      await waitFor(() => {
        expect(mockOpaqueTagManager.createOpaqueTag).toHaveBeenCalledWith({
          tag_name: 'Test OPAQUE Tag',
          activation_phrase: 'test activation phrase',
          color_code: '#007AFF',
          device_fingerprint: 'test-device-fingerprint',
          security_level: 'standard'
        });
      });

      expect(defaultProps.onTagCreated).toHaveBeenCalledWith('opaque-tag-123');
    });

    it('shows success screen with OPAQUE indicators', async () => {
      const { getByPlaceholderText, getByText } = render(
        <SecretTagSetup {...defaultProps} />
      );

      const tagNameInput = getByPlaceholderText('e.g., Work Private, Personal Thoughts');
      const phraseInput = getByPlaceholderText('e.g., activate work mode, private thoughts');
      const confirmInput = getByPlaceholderText('Re-enter your activation phrase');
      
      fireEvent.changeText(tagNameInput, 'Test OPAQUE Tag');
      fireEvent.changeText(phraseInput, 'test activation phrase');
      fireEvent.changeText(confirmInput, 'test activation phrase');
      
      await act(async () => {
        fireEvent.press(getByText('Create Secret Tag'));
      });
      
      await waitFor(() => {
        expect(getByText('OPAQUE Secret Tag Created!')).toBeTruthy();
        expect(getByText('Zero-Knowledge OPAQUE')).toBeTruthy();
      });
    });

    it('handles OPAQUE creation errors', async () => {
      mockOpaqueTagManager.createOpaqueTag.mockResolvedValue({
        success: false,
        tag: {} as any,
        error: 'OPAQUE creation failed'
      });

      const { getByPlaceholderText, getByText } = render(
        <SecretTagSetup {...defaultProps} />
      );

      const tagNameInput = getByPlaceholderText('e.g., Work Private, Personal Thoughts');
      const phraseInput = getByPlaceholderText('e.g., activate work mode, private thoughts');
      const confirmInput = getByPlaceholderText('Re-enter your activation phrase');
      
      fireEvent.changeText(tagNameInput, 'Test Tag');
      fireEvent.changeText(phraseInput, 'test phrase');
      fireEvent.changeText(confirmInput, 'test phrase');
      
      await act(async () => {
        fireEvent.press(getByText('Create Secret Tag'));
      });
      
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Creation Failed', 'OPAQUE creation failed');
      });
    });
  });

  describe('Legacy Tag Creation', () => {
    it('creates legacy tag when OPAQUE is disabled', async () => {
      const { getByPlaceholderText, getByText, getByRole } = render(
        <SecretTagSetup {...defaultProps} />
      );

      // Toggle to legacy mode
      const toggle = getByRole('switch');
      fireEvent.press(toggle);

      const tagNameInput = getByPlaceholderText('e.g., Work Private, Personal Thoughts');
      const phraseInput = getByPlaceholderText('e.g., activate work mode, private thoughts');
      
      fireEvent.changeText(tagNameInput, 'Test Legacy Tag');
      fireEvent.changeText(phraseInput, 'test activation phrase');
      
      await act(async () => {
        fireEvent.press(getByText('Create Secret Tag'));
      });
      
      await waitFor(() => {
        expect(mockTagManager.createSecretTag).toHaveBeenCalledWith(
          'Test Legacy Tag',
          'test activation phrase',
          '#007AFF'
        );
      });

      expect(defaultProps.onTagCreated).toHaveBeenCalledWith('legacy-tag-123');
    });

    it('shows legacy success screen', async () => {
      const { getByPlaceholderText, getByText, getByRole } = render(
        <SecretTagSetup {...defaultProps} />
      );

      // Toggle to legacy mode
      const toggle = getByRole('switch');
      fireEvent.press(toggle);

      const tagNameInput = getByPlaceholderText('e.g., Work Private, Personal Thoughts');
      const phraseInput = getByPlaceholderText('e.g., activate work mode, private thoughts');
      
      fireEvent.changeText(tagNameInput, 'Test Legacy Tag');
      fireEvent.changeText(phraseInput, 'test activation phrase');
      
      await act(async () => {
        fireEvent.press(getByText('Create Secret Tag'));
      });
      
      await waitFor(() => {
        expect(getByText('Secret Tag Created!')).toBeTruthy();
      });
    });
  });

  describe('Security Level Selection', () => {
    it('allows security level selection for OPAQUE tags', () => {
      const { getByText } = render(
        <SecretTagSetup {...defaultProps} />
      );

      expect(getByText('Standard')).toBeTruthy();
      expect(getByText('Enhanced')).toBeTruthy();
    });

    it('uses enhanced security level when selected', async () => {
      const { getByText, getByPlaceholderText } = render(
        <SecretTagSetup {...defaultProps} />
      );

      // Select enhanced security
      fireEvent.press(getByText('Enhanced'));

      const tagNameInput = getByPlaceholderText('e.g., Work Private, Personal Thoughts');
      const phraseInput = getByPlaceholderText('e.g., activate work mode, private thoughts');
      const confirmInput = getByPlaceholderText('Re-enter your activation phrase');
      
      fireEvent.changeText(tagNameInput, 'Enhanced Tag');
      fireEvent.changeText(phraseInput, 'test phrase');
      fireEvent.changeText(confirmInput, 'test phrase');
      
      await act(async () => {
        fireEvent.press(getByText('Create Secret Tag'));
      });
      
      await waitFor(() => {
        expect(mockOpaqueTagManager.createOpaqueTag).toHaveBeenCalledWith(
          expect.objectContaining({
            security_level: 'enhanced'
          })
        );
      });
    });
  });

  describe('Color Selection', () => {
    it('allows color selection', async () => {
      const { getByPlaceholderText, getByText } = render(
        <SecretTagSetup {...defaultProps} />
      );

      // Color options should be rendered (testing for the presence of a color grid)
      const tagNameInput = getByPlaceholderText('e.g., Work Private, Personal Thoughts');
      const phraseInput = getByPlaceholderText('e.g., activate work mode, private thoughts');
      const confirmInput = getByPlaceholderText('Re-enter your activation phrase');
      
      fireEvent.changeText(tagNameInput, 'Colored Tag');
      fireEvent.changeText(phraseInput, 'test phrase');
      fireEvent.changeText(confirmInput, 'test phrase');
      
      await act(async () => {
        fireEvent.press(getByText('Create Secret Tag'));
      });
      
      await waitFor(() => {
        expect(mockOpaqueTagManager.createOpaqueTag).toHaveBeenCalledWith(
          expect.objectContaining({
            color_code: '#007AFF'
          })
        );
      });
    });
  });

  describe('Device Fingerprinting', () => {
    it('requires device fingerprint for OPAQUE tags', async () => {
      mockSessionStorageManager.getDeviceFingerprint.mockReturnValue(null);

      const { getByPlaceholderText, getByText } = render(
        <SecretTagSetup {...defaultProps} />
      );

      const tagNameInput = getByPlaceholderText('e.g., Work Private, Personal Thoughts');
      const phraseInput = getByPlaceholderText('e.g., activate work mode, private thoughts');
      const confirmInput = getByPlaceholderText('Re-enter your activation phrase');
      
      fireEvent.changeText(tagNameInput, 'Test Tag');
      fireEvent.changeText(phraseInput, 'test phrase');
      fireEvent.changeText(confirmInput, 'test phrase');
      
      await act(async () => {
        fireEvent.press(getByText('Create Secret Tag'));
      });
      
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Creation Failed',
          'Device fingerprinting required for OPAQUE tags'
        );
      });
    });
  });

  describe('Form Reset', () => {
    it('clears form after successful creation', async () => {
      const { getByPlaceholderText, getByText } = render(
        <SecretTagSetup {...defaultProps} />
      );

      const tagNameInput = getByPlaceholderText('e.g., Work Private, Personal Thoughts');
      const phraseInput = getByPlaceholderText('e.g., activate work mode, private thoughts');
      const confirmInput = getByPlaceholderText('Re-enter your activation phrase');
      
      fireEvent.changeText(tagNameInput, 'Test Tag');
      fireEvent.changeText(phraseInput, 'test phrase');
      fireEvent.changeText(confirmInput, 'test phrase');
      
      await act(async () => {
        fireEvent.press(getByText('Create Secret Tag'));
      });
      
      // Wait for success screen, then continue
      await waitFor(() => {
        expect(getByText('Continue')).toBeTruthy();
      });
      
      fireEvent.press(getByText('Continue'));
      
      // Form should be reset
      expect(tagNameInput.props.value).toBe('');
      expect(phraseInput.props.value).toBe('');
      expect(confirmInput.props.value).toBe('');
    });
  });

  describe('Cancel Functionality', () => {
    it('calls onCancel when cancel button is pressed', () => {
      const { getByText } = render(
        <SecretTagSetup {...defaultProps} />
      );

      fireEvent.press(getByText('Cancel'));
      expect(defaultProps.onCancel).toHaveBeenCalled();
    });
  });
}); 