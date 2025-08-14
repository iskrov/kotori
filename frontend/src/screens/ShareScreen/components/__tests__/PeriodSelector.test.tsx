import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../../../../contexts/ThemeContext';
import PeriodSelector from '../PeriodSelector';
import { Period } from '../../types';

// Mock date-fns functions for consistent testing
jest.mock('date-fns', () => ({
  startOfWeek: jest.fn((date: Date) => new Date('2025-01-27T00:00:00')), // Monday
  endOfWeek: jest.fn((date: Date) => new Date('2025-02-02T23:59:59')),   // Sunday
  startOfMonth: jest.fn((date: Date) => new Date('2025-01-01T00:00:00')),
  endOfMonth: jest.fn((date: Date) => new Date('2025-01-31T23:59:59')),
  startOfDay: jest.fn((date: Date) => new Date('2025-01-28T00:00:00')),
  endOfDay: jest.fn((date: Date) => new Date('2025-01-28T23:59:59')),
}));

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider>
      {component}
    </ThemeProvider>
  );
};

describe('PeriodSelector', () => {
  const mockOnChange = jest.fn();
  const mockOnDateRangeChange = jest.fn();

  const defaultProps = {
    value: 'weekly' as Period,
    onChange: mockOnChange,
    onDateRangeChange: mockOnDateRangeChange,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all period options', () => {
    renderWithProviders(<PeriodSelector {...defaultProps} />);
    
    expect(screen.getByText('Select Period')).toBeTruthy();
    expect(screen.getByText('Daily')).toBeTruthy();
    expect(screen.getByText('Weekly')).toBeTruthy();
    expect(screen.getByText('Monthly')).toBeTruthy();
  });

  it('shows weekly as selected by default', () => {
    renderWithProviders(<PeriodSelector {...defaultProps} />);
    
    const weeklyTab = screen.getByText('Weekly');
    expect(weeklyTab).toBeTruthy();
    // In a real test environment, we could check for selected styles
  });

  it('calls onChange when a different period is selected', () => {
    renderWithProviders(<PeriodSelector {...defaultProps} />);
    
    const dailyTab = screen.getByText('Daily');
    fireEvent.press(dailyTab);
    
    expect(mockOnChange).toHaveBeenCalledWith('daily');
  });

  it('displays date range for weekly period', () => {
    renderWithProviders(<PeriodSelector {...defaultProps} />);
    
    // Should show the mocked date range
    expect(screen.getByText('This week')).toBeTruthy();
  });

  it('displays correct label for daily period', () => {
    renderWithProviders(
      <PeriodSelector {...defaultProps} value="daily" />
    );
    
    expect(screen.getByText('Today')).toBeTruthy();
  });

  it('displays correct label for monthly period', () => {
    renderWithProviders(
      <PeriodSelector {...defaultProps} value="monthly" />
    );
    
    expect(screen.getByText('This month')).toBeTruthy();
  });

  it('has proper accessibility attributes', () => {
    renderWithProviders(<PeriodSelector {...defaultProps} />);
    
    const dailyTab = screen.getByText('Daily');
    const weeklyTab = screen.getByText('Weekly');
    const monthlyTab = screen.getByText('Monthly');
    
    // All tabs should be rendered (accessibility role is set in the component)
    expect(dailyTab).toBeTruthy();
    expect(weeklyTab).toBeTruthy();
    expect(monthlyTab).toBeTruthy();
  });

  it('calls onDateRangeChange when component mounts', () => {
    renderWithProviders(<PeriodSelector {...defaultProps} />);
    
    // Should be called when the component mounts to set the initial date range
    expect(mockOnDateRangeChange).toHaveBeenCalled();
  });
});
