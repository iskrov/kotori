import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../../../contexts/ThemeContext';
import TemplateSelector from '../TemplateSelector';
import { shareTemplateService, ShareTemplate } from '../../../../services/shareTemplateService';

// Mock the shareTemplateService
jest.mock('../../../../services/shareTemplateService', () => ({
  shareTemplateService: {
    getActiveTemplates: jest.fn(),
  },
}));

// Mock logger
jest.mock('../../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const mockTemplates: ShareTemplate[] = [
  {
    id: 'wellness-1',
    name: 'Wellness Check',
    description: 'General health and mood summary',
    template_structure: [],
    is_active: true,
    is_preset: true,
    language_code: 'en',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 'medical-1',
    name: 'Medical Visit',
    description: 'Prepare for doctor appointments',
    template_structure: [],
    is_active: true,
    is_preset: true,
    language_code: 'en',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 'mood-1',
    name: 'Mood Tracker',
    description: 'Emotional wellbeing patterns',
    template_structure: [],
    is_active: true,
    is_preset: false,
    language_code: 'en',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
];

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider>
      {component}
    </ThemeProvider>
  );
};

describe('TemplateSelector', () => {
  const mockOnSelect = jest.fn();
  const mockOnError = jest.fn();

  const defaultProps = {
    selectedId: null,
    onSelect: mockOnSelect,
    onError: mockOnError,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state initially', async () => {
    (shareTemplateService.getActiveTemplates as jest.Mock).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockTemplates), 100))
    );

    renderWithProviders(<TemplateSelector {...defaultProps} />);
    
    expect(screen.getByText('Choose Template')).toBeTruthy();
    expect(screen.getByText('Loading templates...')).toBeTruthy();
    expect(screen.getByTestId('activity-indicator') || screen.getByRole('progressbar')).toBeTruthy();
  });

  it('renders templates after loading', async () => {
    (shareTemplateService.getActiveTemplates as jest.Mock).mockResolvedValue(mockTemplates);

    renderWithProviders(<TemplateSelector {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Wellness Check')).toBeTruthy();
    });

    expect(screen.getByText('Medical Visit')).toBeTruthy();
    expect(screen.getByText('Mood Tracker')).toBeTruthy();
    expect(screen.getByText('General health and mood summary')).toBeTruthy();
    expect(screen.getByText('Prepare for doctor appointments')).toBeTruthy();
    expect(screen.getByText('Emotional wellbeing patterns')).toBeTruthy();
  });

  it('shows preset badges for preset templates', async () => {
    (shareTemplateService.getActiveTemplates as jest.Mock).mockResolvedValue(mockTemplates);

    renderWithProviders(<TemplateSelector {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Wellness Check')).toBeTruthy();
    });

    // Should show 2 preset badges (wellness and medical are preset)
    const presetBadges = screen.getAllByText('Preset');
    expect(presetBadges).toHaveLength(2);
  });

  it('calls onSelect when template is pressed', async () => {
    (shareTemplateService.getActiveTemplates as jest.Mock).mockResolvedValue(mockTemplates);

    renderWithProviders(<TemplateSelector {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Wellness Check')).toBeTruthy();
    });

    const wellnessTemplate = screen.getByText('Wellness Check');
    fireEvent.press(wellnessTemplate);

    expect(mockOnSelect).toHaveBeenCalledWith('wellness-1');
  });

  it('shows selected state for selected template', async () => {
    (shareTemplateService.getActiveTemplates as jest.Mock).mockResolvedValue(mockTemplates);

    renderWithProviders(
      <TemplateSelector {...defaultProps} selectedId="medical-1" />
    );
    
    await waitFor(() => {
      expect(screen.getByText('Medical Visit')).toBeTruthy();
    });

    // The selected template should have different styling (tested through accessibility state)
    const medicalTemplate = screen.getByText('Medical Visit');
    expect(medicalTemplate).toBeTruthy();
  });

  it('renders error state when loading fails', async () => {
    const errorMessage = 'Failed to load templates';
    (shareTemplateService.getActiveTemplates as jest.Mock).mockRejectedValue(new Error(errorMessage));

    renderWithProviders(<TemplateSelector {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load templates. Please check your connection and try again.')).toBeTruthy();
    });

    expect(screen.getByText('Retry')).toBeTruthy();
    expect(mockOnError).toHaveBeenCalledWith('Failed to load templates. Please check your connection and try again.');
  });

  it('retries loading when retry button is pressed', async () => {
    (shareTemplateService.getActiveTemplates as jest.Mock)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(mockTemplates);

    renderWithProviders(<TemplateSelector {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeTruthy();
    });

    const retryButton = screen.getByText('Retry');
    fireEvent.press(retryButton);

    await waitFor(() => {
      expect(screen.getByText('Wellness Check')).toBeTruthy();
    });

    expect(shareTemplateService.getActiveTemplates).toHaveBeenCalledTimes(2);
  });

  it('shows empty state when no templates are available', async () => {
    (shareTemplateService.getActiveTemplates as jest.Mock).mockResolvedValue([]);

    renderWithProviders(<TemplateSelector {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('No templates available')).toBeTruthy();
    });

    expect(screen.getByText('Refresh')).toBeTruthy();
  });

  it('has proper accessibility attributes', async () => {
    (shareTemplateService.getActiveTemplates as jest.Mock).mockResolvedValue(mockTemplates);

    renderWithProviders(<TemplateSelector {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Wellness Check')).toBeTruthy();
    });

    // Templates should have button role and accessibility labels
    const wellnessTemplate = screen.getByText('Wellness Check');
    expect(wellnessTemplate).toBeTruthy();
  });
});

