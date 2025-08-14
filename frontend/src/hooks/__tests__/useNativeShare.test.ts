import { renderHook, act } from '@testing-library/react-native';
import { Alert, Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import { useNativeShare } from '../useNativeShare';

// Mock dependencies
jest.mock('expo-sharing');
jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
  Platform: {
    OS: 'ios',
    select: jest.fn((options) => options.ios || options.default),
  },
}));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const mockSharing = Sharing as jest.Mocked<typeof Sharing>;
const mockAlert = Alert as jest.Mocked<typeof Alert>;

describe('useNativeShare', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSharing.isAvailableAsync.mockResolvedValue(true);
    mockSharing.shareAsync.mockResolvedValue();
  });

  it('initializes with correct default values', () => {
    const { result } = renderHook(() => useNativeShare());

    expect(result.current.isSharing).toBe(false);
    expect(result.current.isAvailable).toBe(true);
    expect(typeof result.current.shareContent).toBe('function');
  });

  it('shares file successfully', async () => {
    const { result } = renderHook(() => useNativeShare());

    let shareResult;
    await act(async () => {
      shareResult = await result.current.shareContent({
        title: 'Test Title',
        fileUri: 'file:///test.pdf',
      });
    });

    expect(shareResult).toEqual({ success: true });
    expect(mockSharing.shareAsync).toHaveBeenCalledWith(
      'file:///test.pdf',
      {
        mimeType: 'application/pdf',
        dialogTitle: 'Test Title',
        UTI: 'com.adobe.pdf',
      }
    );
  });

  it('handles sharing unavailable', async () => {
    mockSharing.isAvailableAsync.mockResolvedValue(false);
    const { result } = renderHook(() => useNativeShare());

    let shareResult;
    await act(async () => {
      shareResult = await result.current.shareContent({
        title: 'Test Title',
        fileUri: 'file:///test.pdf',
      });
    });

    expect(shareResult).toEqual({ 
      success: false, 
      error: 'Sharing is not available on this platform' 
    });
  });

  it('handles web platform with Web Share API', async () => {
    const mockNavigator = {
      share: jest.fn().mockResolvedValue(undefined),
    };
    Object.defineProperty(global, 'navigator', {
      value: mockNavigator,
      writable: true,
    });

    Platform.OS = 'web' as any;
    const { result } = renderHook(() => useNativeShare());

    let shareResult;
    await act(async () => {
      shareResult = await result.current.shareContent({
        title: 'Test Title',
        message: 'Test Message',
        url: 'https://example.com',
      });
    });

    expect(shareResult).toEqual({ success: true });
    expect(mockNavigator.share).toHaveBeenCalledWith({
      title: 'Test Title',
      text: 'Test Message',
      url: 'https://example.com',
    });
  });

  it('handles web platform with clipboard fallback', async () => {
    const mockNavigator = {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    };
    Object.defineProperty(global, 'navigator', {
      value: mockNavigator,
      writable: true,
    });

    Platform.OS = 'web' as any;
    const { result } = renderHook(() => useNativeShare());

    let shareResult;
    await act(async () => {
      shareResult = await result.current.shareContent({
        title: 'Test Title',
        message: 'Test Message',
      });
    });

    expect(shareResult).toEqual({ success: true });
    expect(mockNavigator.clipboard.writeText).toHaveBeenCalledWith('Test Title\n\nTest Message');
    expect(mockAlert.alert).toHaveBeenCalledWith(
      'Copied to Clipboard',
      'Content has been copied to your clipboard.'
    );
  });

  it('handles mobile platform text sharing with alert', async () => {
    Platform.OS = 'ios' as any;
    const { result } = renderHook(() => useNativeShare());

    let shareResult;
    await act(async () => {
      shareResult = await result.current.shareContent({
        title: 'Test Title',
        message: 'Test Message',
      });
    });

    expect(shareResult).toEqual({ success: false });
    expect(mockAlert.alert).toHaveBeenCalledWith(
      'Share Content',
      'Test Title\n\nTest Message',
      expect.any(Array)
    );
  });

  it('handles sharing errors', async () => {
    mockSharing.shareAsync.mockRejectedValue(new Error('Share failed'));
    const { result } = renderHook(() => useNativeShare());

    let shareResult;
    await act(async () => {
      shareResult = await result.current.shareContent({
        fileUri: 'file:///test.pdf',
      });
    });

    expect(shareResult).toEqual({ 
      success: false, 
      error: 'Share failed' 
    });
  });

  it('handles user cancellation gracefully', async () => {
    mockSharing.shareAsync.mockRejectedValue(new Error('User cancelled'));
    const { result } = renderHook(() => useNativeShare());

    let shareResult;
    await act(async () => {
      shareResult = await result.current.shareContent({
        fileUri: 'file:///test.pdf',
      });
    });

    expect(shareResult).toEqual({ success: false });
  });

  it('sets isSharing state correctly during operation', async () => {
    let resolveShare: () => void;
    const sharePromise = new Promise<void>((resolve) => {
      resolveShare = resolve;
    });
    mockSharing.shareAsync.mockReturnValue(sharePromise);

    const { result } = renderHook(() => useNativeShare());

    expect(result.current.isSharing).toBe(false);

    act(() => {
      result.current.shareContent({ fileUri: 'file:///test.pdf' });
    });

    expect(result.current.isSharing).toBe(true);

    await act(async () => {
      resolveShare!();
      await sharePromise;
    });

    expect(result.current.isSharing).toBe(false);
  });
});
