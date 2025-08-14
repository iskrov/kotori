import { renderHook, act } from '@testing-library/react-native';
import { Alert, Platform } from 'react-native';
import * as MailComposer from 'expo-mail-composer';
import { useEmailShare } from '../useEmailShare';

// Mock dependencies
jest.mock('expo-mail-composer');
jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
  Platform: {
    select: jest.fn((options) => options.ios || options.default),
  },
}));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const mockMailComposer = MailComposer as jest.Mocked<typeof MailComposer>;

describe('useEmailShare', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMailComposer.isAvailableAsync.mockResolvedValue(true);
    mockMailComposer.composeAsync.mockResolvedValue({ 
      status: MailComposer.MailComposerStatus.SENT 
    });
  });

  it('initializes with correct default values', () => {
    const { result } = renderHook(() => useEmailShare());

    expect(result.current.isSending).toBe(false);
    expect(typeof result.current.sendEmail).toBe('function');
    expect(typeof result.current.checkAvailability).toBe('function');
  });

  it('checks availability on initialization', async () => {
    renderHook(() => useEmailShare());

    await act(async () => {
      // Wait for the useEffect to complete
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(mockMailComposer.isAvailableAsync).toHaveBeenCalled();
  });

  it('sends email successfully', async () => {
    const { result } = renderHook(() => useEmailShare());

    let emailResult;
    await act(async () => {
      emailResult = await result.current.sendEmail({
        subject: 'Test Subject',
        body: 'Test Body',
        recipients: ['test@example.com'],
        attachments: ['file:///test.pdf'],
        isHtml: false,
      });
    });

    expect(emailResult).toEqual({ 
      success: true, 
      status: MailComposer.MailComposerStatus.SENT 
    });
    expect(mockMailComposer.composeAsync).toHaveBeenCalledWith({
      subject: 'Test Subject',
      body: 'Test Body',
      isHtml: false,
      recipients: ['test@example.com'],
      attachments: ['file:///test.pdf'],
    });
  });

  it('handles email saved to drafts', async () => {
    mockMailComposer.composeAsync.mockResolvedValue({ 
      status: MailComposer.MailComposerStatus.SAVED 
    });
    const { result } = renderHook(() => useEmailShare());

    let emailResult;
    await act(async () => {
      emailResult = await result.current.sendEmail({
        subject: 'Test Subject',
        body: 'Test Body',
      });
    });

    expect(emailResult).toEqual({ 
      success: true, 
      status: MailComposer.MailComposerStatus.SAVED 
    });
  });

  it('handles email cancellation', async () => {
    mockMailComposer.composeAsync.mockResolvedValue({ 
      status: MailComposer.MailComposerStatus.CANCELLED 
    });
    const { result } = renderHook(() => useEmailShare());

    let emailResult;
    await act(async () => {
      emailResult = await result.current.sendEmail({
        subject: 'Test Subject',
        body: 'Test Body',
      });
    });

    expect(emailResult).toEqual({ 
      success: false, 
      status: MailComposer.MailComposerStatus.CANCELLED 
    });
  });

  it('handles undetermined status', async () => {
    mockMailComposer.composeAsync.mockResolvedValue({ 
      status: MailComposer.MailComposerStatus.UNDETERMINED 
    });
    const { result } = renderHook(() => useEmailShare());

    let emailResult;
    await act(async () => {
      emailResult = await result.current.sendEmail({
        subject: 'Test Subject',
        body: 'Test Body',
      });
    });

    expect(emailResult).toEqual({ 
      success: false, 
      status: MailComposer.MailComposerStatus.UNDETERMINED,
      error: 'Email status could not be determined'
    });
  });

  it('handles email unavailable on iOS', async () => {
    mockMailComposer.isAvailableAsync.mockResolvedValue(false);
    Platform.select = jest.fn((options) => options.ios);
    
    const { result } = renderHook(() => useEmailShare());

    let emailResult;
    await act(async () => {
      emailResult = await result.current.sendEmail({
        subject: 'Test Subject',
        body: 'Test Body',
      });
    });

    expect(emailResult).toEqual({ 
      success: false, 
      error: 'No email client is configured on this device. Please set up Mail app or install another email client.'
    });
  });

  it('handles email unavailable on Android', async () => {
    mockMailComposer.isAvailableAsync.mockResolvedValue(false);
    Platform.select = jest.fn((options) => options.android);
    
    const { result } = renderHook(() => useEmailShare());

    let emailResult;
    await act(async () => {
      emailResult = await result.current.sendEmail({
        subject: 'Test Subject',
        body: 'Test Body',
      });
    });

    expect(emailResult).toEqual({ 
      success: false, 
      error: 'No email client found. Please install an email app like Gmail.'
    });
  });

  it('uses default values for missing email content', async () => {
    const { result } = renderHook(() => useEmailShare());

    await act(async () => {
      await result.current.sendEmail({});
    });

    expect(mockMailComposer.composeAsync).toHaveBeenCalledWith({
      subject: 'Journal Summary',
      body: '',
      isHtml: false,
      recipients: [],
      attachments: [],
    });
  });

  it('handles composition errors', async () => {
    mockMailComposer.composeAsync.mockRejectedValue(new Error('Composition failed'));
    const { result } = renderHook(() => useEmailShare());

    let emailResult;
    await act(async () => {
      emailResult = await result.current.sendEmail({
        subject: 'Test Subject',
        body: 'Test Body',
      });
    });

    expect(emailResult).toEqual({ 
      success: false, 
      error: 'Composition failed'
    });
  });

  it('sets isSending state correctly during operation', async () => {
    let resolveCompose: (value: any) => void;
    const composePromise = new Promise((resolve) => {
      resolveCompose = resolve;
    });
    mockMailComposer.composeAsync.mockReturnValue(composePromise);

    const { result } = renderHook(() => useEmailShare());

    expect(result.current.isSending).toBe(false);

    act(() => {
      result.current.sendEmail({ subject: 'Test' });
    });

    expect(result.current.isSending).toBe(true);

    await act(async () => {
      resolveCompose!({ status: MailComposer.MailComposerStatus.SENT });
      await composePromise;
    });

    expect(result.current.isSending).toBe(false);
  });

  it('updates availability when checkAvailability is called', async () => {
    mockMailComposer.isAvailableAsync.mockResolvedValue(false);
    const { result } = renderHook(() => useEmailShare());

    let isAvailable;
    await act(async () => {
      isAvailable = await result.current.checkAvailability();
    });

    expect(isAvailable).toBe(false);
    expect(result.current.isAvailable).toBe(false);
  });
});
