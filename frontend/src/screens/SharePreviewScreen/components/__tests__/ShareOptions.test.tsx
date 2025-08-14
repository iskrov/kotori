import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { ThemeProvider } from '../../../../contexts/ThemeContext';
import ShareOptions from '../ShareOptions';
import shareService from '../../../../services/shareService';
import * as useNativeShare from '../../../../hooks/useNativeShare';
import * as useEmailShare from '../../../../hooks/useEmailShare';

// Mock dependencies
jest.mock('../../../../services/shareService');
jest.mock('../../../../hooks/useNativeShare');
jest.mock('../../../../hooks/useEmailShare');
jest.mock('../../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const mockShareService = shareService as jest.Mocked<typeof shareService>;
const mockUseNativeShare = useNativeShare as jest.Mocked<typeof useNativeShare>;
const mockUseEmailShare = useEmailShare as jest.Mocked<typeof useEmailShare>;

// Mock Alert
jest.spyOn(Alert, 'alert');

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider>
      {component}
    </ThemeProvider>
  );
};

describe('ShareOptions', () => {
  const mockProps = {
    visible: true,
    onClose: jest.fn(),
    shareId: 'test-share-id',
    shareToken: 'test-token',
  };

  const mockNativeShareHook = {
    isSharing: false,
    shareContent: jest.fn(),
    isAvailable: true,
  };

  const mockEmailShareHook = {
    isSending: false,
    sendEmail: jest.fn(),
    isAvailable: true,
    checkAvailability: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseNativeShare.default.mockReturnValue(mockNativeShareHook);
    mockUseEmailShare.default.mockReturnValue(mockEmailShareHook);
  });

  it('renders all share options', () => {
    renderWithProviders(<ShareOptions {...mockProps} />);

    expect(screen.getByText('Share Options')).toBeTruthy();
    expect(screen.getByText('Download PDF')).toBeTruthy();
    expect(screen.getByText('Share via Apps')).toBeTruthy();
    expect(screen.getByText('Send via Email')).toBeTruthy();
  });

  it('handles PDF download successfully', async () => {
    const mockPdfResult = {
      uri: 'file:///test.pdf',
      filename: 'test.pdf',
      size: 1024,
    };
    mockShareService.downloadPDF.mockResolvedValue(mockPdfResult);

    renderWithProviders(<ShareOptions {...mockProps} />);

    const downloadButton = screen.getByText('Download PDF');
    fireEvent.press(downloadButton);

    await waitFor(() => {
      expect(mockShareService.downloadPDF).toHaveBeenCalledWith('test-share-id');
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'PDF Downloaded',
      'Your summary has been saved as test.pdf',
      expect.any(Array)
    );
  });

  it('handles PDF download failure', async () => {
    mockShareService.downloadPDF.mockRejectedValue(new Error('Network error'));

    renderWithProviders(<ShareOptions {...mockProps} />);

    const downloadButton = screen.getByText('Download PDF');
    fireEvent.press(downloadButton);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Download Failed',
        'Network error'
      );
    });
  });

  it('handles native share successfully', async () => {
    const mockPdfResult = {
      uri: 'file:///test.pdf',
      filename: 'test.pdf',
      size: 1024,
    };
    mockShareService.downloadPDF.mockResolvedValue(mockPdfResult);
    mockNativeShareHook.shareContent.mockResolvedValue({ success: true });

    renderWithProviders(<ShareOptions {...mockProps} />);

    const shareButton = screen.getByText('Share via Apps');
    fireEvent.press(shareButton);

    await waitFor(() => {
      expect(mockShareService.downloadPDF).toHaveBeenCalledWith('test-share-id');
    });

    await waitFor(() => {
      expect(mockNativeShareHook.shareContent).toHaveBeenCalledWith({
        title: 'Journal Summary',
        message: 'Please find my journal summary attached.',
        fileUri: 'file:///test.pdf',
      });
    });

    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('shows error when native share is not available', async () => {
    const unavailableNativeShareHook = {
      ...mockNativeShareHook,
      isAvailable: false,
    };
    mockUseNativeShare.default.mockReturnValue(unavailableNativeShareHook);

    renderWithProviders(<ShareOptions {...mockProps} />);

    const shareButton = screen.getByText('Share via Apps');
    fireEvent.press(shareButton);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Sharing Not Available',
        'Native sharing is not supported on this platform. Please try downloading the PDF instead.'
      );
    });
  });

  it('handles email share successfully', async () => {
    const mockPdfResult = {
      uri: 'file:///test.pdf',
      filename: 'test.pdf',
      size: 1024,
    };
    mockShareService.downloadPDF.mockResolvedValue(mockPdfResult);
    mockEmailShareHook.sendEmail.mockResolvedValue({ 
      success: true, 
      status: 'sent' as any 
    });

    renderWithProviders(<ShareOptions {...mockProps} />);

    const emailButton = screen.getByText('Send via Email');
    fireEvent.press(emailButton);

    await waitFor(() => {
      expect(mockShareService.downloadPDF).toHaveBeenCalledWith('test-share-id');
    });

    await waitFor(() => {
      expect(mockEmailShareHook.sendEmail).toHaveBeenCalledWith({
        subject: 'Journal Summary',
        body: expect.stringContaining('Please find my journal summary attached'),
        attachments: ['file:///test.pdf'],
        isHtml: false,
      });
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Email Sent',
      'Your journal summary has been sent successfully.'
    );
  });

  it('shows error when email is not available', async () => {
    const unavailableEmailShareHook = {
      ...mockEmailShareHook,
      isAvailable: false,
    };
    mockUseEmailShare.default.mockReturnValue(unavailableEmailShareHook);

    renderWithProviders(<ShareOptions {...mockProps} />);

    const emailButton = screen.getByText('Send via Email');
    fireEvent.press(emailButton);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Email Not Available',
        'No email client is available on this device. Please install an email app or try another sharing method.'
      );
    });
  });

  it('shows loading states during operations', async () => {
    const mockPdfResult = {
      uri: 'file:///test.pdf',
      filename: 'test.pdf',
      size: 1024,
    };
    
    // Mock a delayed PDF download
    mockShareService.downloadPDF.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve(mockPdfResult), 100))
    );

    renderWithProviders(<ShareOptions {...mockProps} />);

    const downloadButton = screen.getByText('Download PDF');
    fireEvent.press(downloadButton);

    // Should show loading text
    await waitFor(() => {
      expect(screen.getByText('Generating PDF...')).toBeTruthy();
    });
  });

  it('disables options during loading', async () => {
    const mockPdfResult = {
      uri: 'file:///test.pdf',
      filename: 'test.pdf',
      size: 1024,
    };
    
    mockShareService.downloadPDF.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve(mockPdfResult), 100))
    );

    renderWithProviders(<ShareOptions {...mockProps} />);

    const downloadButton = screen.getByText('Download PDF');
    const shareButton = screen.getByText('Share via Apps');
    const emailButton = screen.getByText('Send via Email');

    fireEvent.press(downloadButton);

    // Other buttons should be disabled
    fireEvent.press(shareButton);
    fireEvent.press(emailButton);

    // Only the PDF download should be called
    await waitFor(() => {
      expect(mockShareService.downloadPDF).toHaveBeenCalledTimes(1);
    });
    expect(mockNativeShareHook.shareContent).not.toHaveBeenCalled();
    expect(mockEmailShareHook.sendEmail).not.toHaveBeenCalled();
  });

  it('closes modal when close button is pressed', () => {
    renderWithProviders(<ShareOptions {...mockProps} />);

    const closeButton = screen.getByText('Share Options').parent?.parent?.children[1];
    if (closeButton) {
      fireEvent.press(closeButton);
    }

    expect(mockProps.onClose).toHaveBeenCalled();
  });
});
