/**
 * Tests for SessionControlPanel Component
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import SessionControlPanel from '../SessionControlPanel';
import { SessionData } from '../../types/sessionTypes';
import { useSessionTimer } from '../../hooks/useSessionTimer';

// Mock dependencies
jest.mock('../../hooks/useSessionTimer');
jest.mock('../../contexts/ThemeContext', () => ({
  useAppTheme: () => ({
    theme: {
      colors: {
        surface: '#FFFFFF',
        text: '#000000',
        textSecondary: '#666666',
        border: '#E0E0E0',
        background: '#F5F5F5',
      }
    }
  })
}));

const mockUseSessionTimer = useSessionTimer as jest.MockedFunction<typeof useSessionTimer>;

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('SessionControlPanel', () => {
  const mockSession: SessionData = {
    tagId: 'test-tag-1',
    tagName: 'Test Tag',
    sessionKey: new Uint8Array([1, 2, 3, 4]),
    vaultKey: new Uint8Array([5, 6, 7, 8]),
    createdAt: new Date('2025-01-20T10:00:00Z'),
    expiresAt: new Date('2025-01-20T10:15:00Z'),
    isLocked: false,
  };

  const mockTimerState = {
    timeRemaining: 900000, // 15 minutes
    isExpired: false,
    isWarning: false,
    isCritical: false,
    formattedTime: '15:00',
    percentage: 100,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUseSessionTimer.mockReturnValue({
      getTimerState: jest.fn().mockReturnValue(mockTimerState),
      formatDuration: jest.fn().mockImplementation((ms) => {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
      }),
      getExpirationColor: jest.fn().mockReturnValue('#34C759'),
      refreshTimer: jest.fn(),
    });
  });

  it('should render session information correctly', () => {
    const { getByText } = render(
      <SessionControlPanel session={mockSession} />
    );

    expect(getByText('Test Tag')).toBeTruthy();
    expect(getByText('15:00')).toBeTruthy();
    expect(getByText('Extend')).toBeTruthy();
    expect(getByText('End')).toBeTruthy();
  });

  it('should show extension options when extend button is pressed', async () => {
    const mockOnExtend = jest.fn().mockResolvedValue(true);
    
    const { getByText } = render(
      <SessionControlPanel 
        session={mockSession} 
        onExtend={mockOnExtend}
      />
    );

    fireEvent.press(getByText('Extend'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Extend Session',
      'Extend the session for "Test Tag"',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancel' }),
        expect.objectContaining({ text: '15 minutes' }),
        expect.objectContaining({ text: '30 minutes' }),
        expect.objectContaining({ text: '1 hour' }),
      ])
    );
  });

  it('should call onDeactivate when end button is pressed', () => {
    const mockOnDeactivate = jest.fn().mockResolvedValue(true);
    
    const { getByText } = render(
      <SessionControlPanel 
        session={mockSession} 
        onDeactivate={mockOnDeactivate}
      />
    );

    fireEvent.press(getByText('End'));

    expect(mockOnDeactivate).toHaveBeenCalledWith('test-tag-1');
  });

  it('should show expired status for expired sessions', () => {
    const expiredTimerState = {
      ...mockTimerState,
      timeRemaining: 0,
      isExpired: true,
      formattedTime: '00:00',
      percentage: 0,
    };

    mockUseSessionTimer.mockReturnValue({
      getTimerState: jest.fn().mockReturnValue(expiredTimerState),
      formatDuration: jest.fn(),
      getExpirationColor: jest.fn().mockReturnValue('#FF3B30'),
      refreshTimer: jest.fn(),
    });

    const { getByText } = render(
      <SessionControlPanel session={mockSession} />
    );

    expect(getByText('Expired')).toBeTruthy();
    expect(getByText('00:00')).toBeTruthy();
  });

  it('should show locked status for locked sessions', () => {
    const lockedSession = { ...mockSession, isLocked: true };

    const { getByText } = render(
      <SessionControlPanel session={lockedSession} />
    );

    expect(getByText('Locked')).toBeTruthy();
  });

  it('should disable buttons when disabled prop is true', () => {
    const { getByText } = render(
      <SessionControlPanel session={mockSession} disabled={true} />
    );

    const extendButton = getByText('Extend').parent;
    const endButton = getByText('End').parent;

    expect(extendButton?.props.accessibilityState?.disabled).toBe(true);
    expect(endButton?.props.accessibilityState?.disabled).toBe(true);
  });

  it('should show warning status for expiring sessions', () => {
    const warningTimerState = {
      ...mockTimerState,
      timeRemaining: 240000, // 4 minutes
      isWarning: true,
      formattedTime: '04:00',
      percentage: 26.7,
    };

    mockUseSessionTimer.mockReturnValue({
      getTimerState: jest.fn().mockReturnValue(warningTimerState),
      formatDuration: jest.fn(),
      getExpirationColor: jest.fn().mockReturnValue('#FFCC00'),
      refreshTimer: jest.fn(),
    });

    const { getByText } = render(
      <SessionControlPanel session={mockSession} />
    );

    expect(getByText('Expiring')).toBeTruthy();
  });

  it('should show critical status for critically expiring sessions', () => {
    const criticalTimerState = {
      ...mockTimerState,
      timeRemaining: 30000, // 30 seconds
      isCritical: true,
      formattedTime: '00:30',
      percentage: 3.3,
    };

    mockUseSessionTimer.mockReturnValue({
      getTimerState: jest.fn().mockReturnValue(criticalTimerState),
      formatDuration: jest.fn(),
      getExpirationColor: jest.fn().mockReturnValue('#FF9500'),
      refreshTimer: jest.fn(),
    });

    const { getByText } = render(
      <SessionControlPanel session={mockSession} />
    );

    expect(getByText('Expiring Soon')).toBeTruthy();
  });
}); 