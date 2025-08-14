import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import SharePreviewScreen from '../index';
import { MainStackParamList } from '../../../navigation/types';
import shareService from '../../../services/shareService';

// Mock dependencies
jest.mock('../../../services/shareService');
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const mockShareService = shareService as jest.Mocked<typeof shareService>;

const Stack = createStackNavigator<MainStackParamList>();

const renderWithNavigation = (params: any) => {
  return render(
    <NavigationContainer>
      <ThemeProvider>
        <Stack.Navigator>
          <Stack.Screen
            name="SharePreview"
            component={SharePreviewScreen}
            initialParams={params}
          />
        </Stack.Navigator>
      </ThemeProvider>
    </NavigationContainer>
  );
};

describe('SharePreviewScreen API Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('New Share Generation', () => {
    const newShareParams = {
      templateId: 'template-1',
      dateRange: {
        start: '2025-01-20T00:00:00.000Z',
        end: '2025-01-26T23:59:59.000Z',
      },
      period: 'weekly' as const,
    };

    it('generates new share using API', async () => {
      const mockGeneratedShare = {
        id: 'share-123',
        title: 'Weekly Summary',
        content: {
          answers: [
            {
              question_id: 'q1',
              question_text: 'How has your mood been?',
              answer: 'Generally positive',
              confidence: 0.85,
            },
          ],
        },
        share_token: 'token-123',
        expires_at: '2025-02-02T00:00:00.000Z',
      };

      mockShareService.generateShare.mockResolvedValue(mockGeneratedShare);

      renderWithNavigation(newShareParams);

      // Should show loading initially
      expect(screen.getByText('Generating your summary...')).toBeTruthy();
      expect(screen.getByText('Processing your journal entries with AI')).toBeTruthy();

      // Wait for API call to complete
      await waitFor(() => {
        expect(screen.getByText('Review Summary')).toBeTruthy();
      });

      // Verify API was called correctly
      expect(mockShareService.generateShare).toHaveBeenCalledWith({
        template_id: 'template-1',
        date_range: {
          start: '2025-01-20T00:00:00.000Z',
          end: '2025-01-26T23:59:59.000Z',
        },
        period: 'weekly',
        language: 'en',
      });

      // Verify share data is displayed
      expect(screen.getByText('Weekly Summary')).toBeTruthy();
      expect(screen.getByText('How has your mood been?')).toBeTruthy();
      expect(screen.getByText('Generally positive')).toBeTruthy();
    });

    it('handles share generation errors', async () => {
      mockShareService.generateShare.mockRejectedValue(new Error('Network error'));

      renderWithNavigation(newShareParams);

      await waitFor(() => {
        expect(screen.getByText('Processing Failed')).toBeTruthy();
      });

      expect(screen.getByText(/Unable to create share summary/)).toBeTruthy();
    });

    it('handles missing parameters', async () => {
      const incompleteParams = {
        templateId: 'template-1',
        // Missing dateRange and period
      };

      renderWithNavigation(incompleteParams);

      await waitFor(() => {
        expect(screen.getByText('Processing Failed')).toBeTruthy();
      });

      expect(screen.getByText(/Missing required parameters/)).toBeTruthy();
    });
  });

  describe('Existing Share Loading', () => {
    const existingShareParams = {
      shareId: 'share-456',
      fromHistory: true,
    };

    it('loads existing share using API', async () => {
      const mockExistingShare = {
        id: 'share-456',
        title: 'Medical Visit Summary',
        content: {
          answers: [
            {
              question_id: 'q1',
              question_text: 'Any symptoms to report?',
              answer: 'No significant symptoms',
              confidence: 0.92,
            },
          ],
        },
        share_token: 'token-456',
        expires_at: '2025-02-03T00:00:00.000Z',
        created_at: '2025-01-27T10:00:00.000Z',
      };

      mockShareService.getShare.mockResolvedValue(mockExistingShare);

      renderWithNavigation(existingShareParams);

      // Should show loading for existing share
      expect(screen.getByText('Loading your summary...')).toBeTruthy();
      expect(screen.getByText('Retrieving share details')).toBeTruthy();

      // Wait for API call to complete
      await waitFor(() => {
        expect(screen.getByText('Review Summary')).toBeTruthy();
      });

      // Verify API was called correctly
      expect(mockShareService.getShare).toHaveBeenCalledWith('share-456');

      // Verify share data is displayed
      expect(screen.getByText('Medical Visit Summary')).toBeTruthy();
      expect(screen.getByText('Any symptoms to report?')).toBeTruthy();
      expect(screen.getByText('No significant symptoms')).toBeTruthy();
    });

    it('handles existing share loading errors', async () => {
      mockShareService.getShare.mockRejectedValue(new Error('Share not found'));

      renderWithNavigation(existingShareParams);

      await waitFor(() => {
        expect(screen.getByText('Processing Failed')).toBeTruthy();
      });

      expect(screen.getByText(/Unable to load share summary/)).toBeTruthy();
    });
  });

  describe('Share Updates', () => {
    const shareParams = {
      templateId: 'template-1',
      dateRange: {
        start: '2025-01-20T00:00:00.000Z',
        end: '2025-01-26T23:59:59.000Z',
      },
      period: 'weekly' as const,
    };

    it('updates share when answers are edited', async () => {
      const mockOriginalShare = {
        id: 'share-789',
        title: 'Weekly Summary',
        content: {
          answers: [
            {
              question_id: 'q1',
              question_text: 'How has your mood been?',
              answer: 'Generally positive',
              confidence: 0.85,
            },
          ],
        },
        share_token: 'token-789',
        expires_at: '2025-02-02T00:00:00.000Z',
      };

      const mockUpdatedShare = {
        ...mockOriginalShare,
        content: {
          answers: [
            {
              question_id: 'q1',
              question_text: 'How has your mood been?',
              answer: 'Very positive with some challenges',
              confidence: 0.85,
            },
          ],
        },
      };

      mockShareService.generateShare.mockResolvedValue(mockOriginalShare);
      mockShareService.updateShare.mockResolvedValue(mockUpdatedShare);

      renderWithNavigation(shareParams);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Review Summary')).toBeTruthy();
      });

      // Edit an answer
      const answerText = screen.getByText('Generally positive');
      fireEvent.press(answerText);

      await waitFor(() => {
        expect(screen.getByText('Save')).toBeTruthy();
      });

      const textInput = screen.getByDisplayValue('Generally positive');
      fireEvent.changeText(textInput, 'Very positive with some challenges');

      const saveButton = screen.getByText('Save');
      fireEvent.press(saveButton);

      // Confirm the share
      const shareButton = screen.getByText('Share Summary');
      fireEvent.press(shareButton);

      // Verify update API was called
      await waitFor(() => {
        expect(mockShareService.updateShare).toHaveBeenCalledWith('share-789', {
          content: {
            answers: [
              {
                question_id: 'q1',
                question_text: 'How has your mood been?',
                answer: 'Very positive with some challenges',
                confidence: 0.85,
              },
            ],
          },
        });
      });
    });

    it('handles share update errors', async () => {
      const mockOriginalShare = {
        id: 'share-789',
        title: 'Weekly Summary',
        content: {
          answers: [
            {
              question_id: 'q1',
              question_text: 'How has your mood been?',
              answer: 'Generally positive',
              confidence: 0.85,
            },
          ],
        },
        share_token: 'token-789',
        expires_at: '2025-02-02T00:00:00.000Z',
      };

      mockShareService.generateShare.mockResolvedValue(mockOriginalShare);
      mockShareService.updateShare.mockRejectedValue(new Error('Update failed'));

      renderWithNavigation(shareParams);

      await waitFor(() => {
        expect(screen.getByText('Review Summary')).toBeTruthy();
      });

      // Edit and save an answer
      const answerText = screen.getByText('Generally positive');
      fireEvent.press(answerText);

      await waitFor(() => {
        const textInput = screen.getByDisplayValue('Generally positive');
        fireEvent.changeText(textInput, 'Very positive');
        
        const saveButton = screen.getByText('Save');
        fireEvent.press(saveButton);
      });

      // Try to confirm share
      const shareButton = screen.getByText('Share Summary');
      fireEvent.press(shareButton);

      // Should show update error
      await waitFor(() => {
        expect(screen.getByText('Update Failed')).toBeTruthy();
      });
    });
  });
});
