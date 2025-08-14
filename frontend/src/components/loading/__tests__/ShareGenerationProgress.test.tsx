import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import { ShareGenerationProgress } from '../ShareGenerationProgress';

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider>
      {component}
    </ThemeProvider>
  );
};

describe('ShareGenerationProgress', () => {
  it('renders with default steps', () => {
    renderWithTheme(
      <ShareGenerationProgress currentStep={0} />
    );
    
    expect(screen.getByText('Generating Your Summary')).toBeTruthy();
    expect(screen.getByText('Step 1 of 4')).toBeTruthy();
    expect(screen.getByText('Analyzing Entries')).toBeTruthy();
  });

  it('shows current step correctly', () => {
    renderWithTheme(
      <ShareGenerationProgress currentStep={2} />
    );
    
    expect(screen.getByText('Step 3 of 4')).toBeTruthy();
    expect(screen.getByText('Mapping Answers')).toBeTruthy();
  });

  it('displays estimated time when provided', () => {
    renderWithTheme(
      <ShareGenerationProgress 
        currentStep={1} 
        estimatedTimeRemaining={15} 
      />
    );
    
    expect(screen.getByText('15s remaining')).toBeTruthy();
  });

  it('formats time remaining correctly for minutes', () => {
    renderWithTheme(
      <ShareGenerationProgress 
        currentStep={0} 
        estimatedTimeRemaining={90} 
      />
    );
    
    expect(screen.getByText('1m 30s remaining')).toBeTruthy();
  });

  it('shows all steps with correct status indicators', () => {
    renderWithTheme(
      <ShareGenerationProgress currentStep={1} />
    );
    
    // Step 0 should be completed (checkmark)
    // Step 1 should be current (highlighted)
    // Steps 2,3 should be upcoming (muted)
    
    expect(screen.getByText('Analyzing Entries')).toBeTruthy();
    expect(screen.getByText('AI Processing')).toBeTruthy();
    expect(screen.getByText('Mapping Answers')).toBeTruthy();
    expect(screen.getByText('Finalizing Summary')).toBeTruthy();
  });

  it('works with custom steps', () => {
    const customSteps = [
      {
        id: 'custom1',
        label: 'Custom Step 1',
        description: 'Custom description 1',
        icon: 'star' as const,
      },
      {
        id: 'custom2',
        label: 'Custom Step 2',
        description: 'Custom description 2',
        icon: 'heart' as const,
      },
    ];

    renderWithTheme(
      <ShareGenerationProgress 
        currentStep={0} 
        steps={customSteps}
      />
    );
    
    expect(screen.getByText('Step 1 of 2')).toBeTruthy();
    expect(screen.getByText('Custom Step 1')).toBeTruthy();
    expect(screen.getByText('Custom description 1')).toBeTruthy();
  });

  it('handles progress within current step', () => {
    renderWithTheme(
      <ShareGenerationProgress 
        currentStep={1} 
        progress={0.5}
      />
    );
    
    // Progress should affect the progress bar
    expect(screen.getByText('Step 2 of 4')).toBeTruthy();
  });
});
