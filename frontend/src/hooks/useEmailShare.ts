import React, { useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as MailComposer from 'expo-mail-composer';
import logger from '../utils/logger';

export interface EmailContent {
  subject?: string;
  body?: string;
  recipients?: string[];
  attachments?: string[];
  isHtml?: boolean;
}

export interface EmailResult {
  success: boolean;
  error?: string;
  status?: MailComposer.MailComposerStatus;
}

export interface UseEmailShareReturn {
  isSending: boolean;
  isAvailable: boolean;
  sendEmail: (content: EmailContent) => Promise<EmailResult>;
  checkAvailability: () => Promise<boolean>;
}

export const useEmailShare = (): UseEmailShareReturn => {
  const [isSending, setIsSending] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);

  const checkAvailability = async (): Promise<boolean> => {
    try {
      const available = await MailComposer.isAvailableAsync();
      setIsAvailable(available);
      return available;
    } catch (error) {
      logger.error('[useEmailShare] Failed to check email availability', error);
      setIsAvailable(false);
      return false;
    }
  };

  const sendEmail = async (content: EmailContent): Promise<EmailResult> => {
    try {
      setIsSending(true);
      logger.info('[useEmailShare] Starting email composition', {
        hasSubject: !!content.subject,
        hasBody: !!content.body,
        recipientCount: content.recipients?.length || 0,
        attachmentCount: content.attachments?.length || 0,
      });

      // Check if email is available
      const available = await checkAvailability();
      if (!available) {
        const errorMessage = Platform.select({
          ios: 'No email client is configured on this device. Please set up Mail app or install another email client.',
          android: 'No email client found. Please install an email app like Gmail.',
          default: 'Email is not available on this platform.',
        }) || 'Email is not available';

        throw new Error(errorMessage);
      }

      // Prepare email options
      const emailOptions: MailComposer.MailComposerOptions = {
        subject: content.subject || 'Journal Summary',
        body: content.body || '',
        isHtml: content.isHtml || false,
        recipients: content.recipients || [],
        attachments: content.attachments || [],
      };

      // Compose and send email
      const result = await MailComposer.composeAsync(emailOptions);

      logger.info('[useEmailShare] Email composition result', { status: result.status });

      // Handle different result statuses
      switch (result.status) {
        case MailComposer.MailComposerStatus.SENT:
          logger.info('[useEmailShare] Email sent successfully');
          return { success: true, status: result.status };

        case MailComposer.MailComposerStatus.SAVED:
          logger.info('[useEmailShare] Email saved to drafts');
          return { success: true, status: result.status };

        case MailComposer.MailComposerStatus.CANCELLED:
          logger.info('[useEmailShare] Email composition cancelled');
          return { success: false, status: result.status };

        case MailComposer.MailComposerStatus.UNDETERMINED:
        default:
          logger.warn('[useEmailShare] Email composition status undetermined');
          return { 
            success: false, 
            status: result.status,
            error: 'Email status could not be determined'
          };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to compose email';
      logger.error('[useEmailShare] Email composition failed', error);
      
      return { 
        success: false, 
        error: errorMessage 
      };
    } finally {
      setIsSending(false);
    }
  };

  // Check availability on hook initialization
  React.useEffect(() => {
    checkAvailability();
  }, []);

  return {
    isSending,
    isAvailable,
    sendEmail,
    checkAvailability,
  };
};

export default useEmailShare;
