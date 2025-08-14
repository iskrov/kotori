import { useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import logger from '../utils/logger';

export interface ShareContent {
  title?: string;
  message?: string;
  url?: string;
  fileUri?: string;
}

export interface ShareResult {
  success: boolean;
  error?: string;
}

export interface UseNativeShareReturn {
  isSharing: boolean;
  shareContent: (content: ShareContent) => Promise<ShareResult>;
  isAvailable: boolean;
}

export const useNativeShare = (): UseNativeShareReturn => {
  const [isSharing, setIsSharing] = useState(false);

  const isAvailable = Sharing.isAvailableAsync !== undefined;

  const shareContent = async (content: ShareContent): Promise<ShareResult> => {
    try {
      setIsSharing(true);
      logger.info('[useNativeShare] Starting share', content);

      // Check if sharing is available on this platform
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        throw new Error('Sharing is not available on this platform');
      }

      // If we have a file URI, share the file
      if (content.fileUri) {
        await Sharing.shareAsync(content.fileUri, {
          mimeType: 'application/pdf',
          dialogTitle: content.title || 'Share PDF',
          UTI: 'com.adobe.pdf', // iOS UTI for PDF files
        });
      } else {
        // For text/URL sharing, we need to use a different approach
        // Since expo-sharing is primarily for files, we'll show an alert
        // In a real implementation, you might want to use react-native-share
        const shareText = [
          content.title,
          content.message,
          content.url
        ].filter(Boolean).join('\n\n');

        if (Platform.OS === 'web') {
          // Web sharing using Web Share API if available
          if (navigator.share) {
            await navigator.share({
              title: content.title,
              text: content.message,
              url: content.url,
            });
          } else {
            // Fallback for web - copy to clipboard
            if (navigator.clipboard) {
              await navigator.clipboard.writeText(shareText);
              Alert.alert('Copied to Clipboard', 'Content has been copied to your clipboard.');
            } else {
              throw new Error('Sharing not supported in this browser');
            }
          }
        } else {
          // For mobile platforms without a file, we'll show the content in an alert
          // This is a fallback - ideally you'd use react-native-share for better UX
          Alert.alert(
            'Share Content',
            shareText,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Copy to Clipboard',
                onPress: () => {
                  // In a real app, you'd use @react-native-clipboard/clipboard
                  Alert.alert('Feature Coming Soon', 'Copy to clipboard will be implemented.');
                }
              }
            ]
          );
        }
      }

      logger.info('[useNativeShare] Share completed successfully');
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('[useNativeShare] Share failed', error);
      
      // Don't show error if user cancelled
      if (errorMessage.includes('cancelled') || errorMessage.includes('canceled')) {
        return { success: false };
      }

      return { 
        success: false, 
        error: errorMessage 
      };
    } finally {
      setIsSharing(false);
    }
  };

  return {
    isSharing,
    shareContent,
    isAvailable,
  };
};

export default useNativeShare;
