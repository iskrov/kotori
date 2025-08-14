import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../../contexts/ThemeContext';
import { AppTheme } from '../../../config/theme';
import shareService from '../../../services/shareService';
import useNativeShare from '../../../hooks/useNativeShare';
import useEmailShare from '../../../hooks/useEmailShare';
import logger from '../../../utils/logger';

interface ShareOptionsProps {
  visible: boolean;
  onClose: () => void;
  shareId: string;
  shareToken: string;
}

export const ShareOptions: React.FC<ShareOptionsProps> = ({
  visible,
  onClose,
  shareId,
  shareToken
}) => {
  const { theme } = useAppTheme();
  const styles = getShareOptionsStyles(theme);
  
  const [loadingOperation, setLoadingOperation] = useState<string | null>(null);
  const { shareContent, isSharing, isAvailable: nativeShareAvailable } = useNativeShare();
  const { sendEmail, isSending, isAvailable: emailAvailable } = useEmailShare();

  const handleDownloadPDF = async () => {
    try {
      setLoadingOperation('pdf');
      logger.info('[ShareOptions] Downloading PDF', { shareId });
      
      const pdfResult = await shareService.downloadPDF(shareId);
      
      Alert.alert(
        'PDF Downloaded',
        `Your summary has been saved as ${pdfResult.filename}`,
        [
          { text: 'OK', onPress: onClose },
          {
            text: 'Share PDF',
            onPress: () => handleSharePDF(pdfResult.uri, pdfResult.filename)
          }
        ]
      );
    } catch (error) {
      logger.error('[ShareOptions] Failed to download PDF', error);
      Alert.alert(
        'Download Failed', 
        error instanceof Error ? error.message : 'Failed to download PDF. Please try again.'
      );
    } finally {
      setLoadingOperation(null);
    }
  };

  const handleSharePDF = async (pdfUri: string, filename: string) => {
    try {
      const result = await shareContent({
        title: 'Journal Summary',
        fileUri: pdfUri,
      });

      if (result.success) {
        onClose();
      } else if (result.error) {
        Alert.alert('Share Failed', result.error);
      }
    } catch (error) {
      logger.error('[ShareOptions] Failed to share PDF', error);
      Alert.alert('Share Failed', 'Unable to share PDF. Please try again.');
    }
  };

  const handleNativeShare = async () => {
    try {
      setLoadingOperation('share');
      logger.info('[ShareOptions] Opening native share', { shareId });
      
      if (!nativeShareAvailable) {
        Alert.alert(
          'Sharing Not Available',
          'Native sharing is not supported on this platform. Please try downloading the PDF instead.'
        );
        return;
      }

      // First download the PDF, then share it
      const pdfResult = await shareService.downloadPDF(shareId);
      
      const result = await shareContent({
        title: 'Journal Summary',
        message: 'Please find my journal summary attached.',
        fileUri: pdfResult.uri,
      });

      if (result.success) {
        onClose();
        // Clean up the temporary file after sharing
        setTimeout(() => {
          shareService.cleanupFile(pdfResult.uri);
        }, 5000);
      } else if (result.error) {
        Alert.alert('Share Failed', result.error);
      }
    } catch (error) {
      logger.error('[ShareOptions] Failed to open native share', error);
      Alert.alert(
        'Share Failed', 
        error instanceof Error ? error.message : 'Failed to open share options. Please try again.'
      );
    } finally {
      setLoadingOperation(null);
    }
  };

  const handleEmailShare = async () => {
    try {
      setLoadingOperation('email');
      logger.info('[ShareOptions] Opening email share', { shareId });
      
      if (!emailAvailable) {
        Alert.alert(
          'Email Not Available',
          'No email client is available on this device. Please install an email app or try another sharing method.'
        );
        return;
      }

      // Download PDF for attachment
      const pdfResult = await shareService.downloadPDF(shareId);
      
      const result = await sendEmail({
        subject: 'Journal Summary',
        body: `Please find my journal summary attached.\n\nThis summary was generated from my journal entries and is valid until the expiration date.\n\nBest regards`,
        attachments: [pdfResult.uri],
        isHtml: false,
      });

      if (result.success) {
        if (result.status === 'sent') {
          Alert.alert('Email Sent', 'Your journal summary has been sent successfully.');
        } else if (result.status === 'saved') {
          Alert.alert('Email Saved', 'Your email has been saved to drafts.');
        }
        onClose();
        
        // Clean up the temporary file
        setTimeout(() => {
          shareService.cleanupFile(pdfResult.uri);
        }, 5000);
      } else if (result.error) {
        Alert.alert('Email Failed', result.error);
      }
    } catch (error) {
      logger.error('[ShareOptions] Failed to open email share', error);
      Alert.alert(
        'Email Failed', 
        error instanceof Error ? error.message : 'Failed to compose email. Please try again.'
      );
    } finally {
      setLoadingOperation(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              Share Options
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.options}>
            <TouchableOpacity
              style={[
                styles.option, 
                { borderBottomColor: theme.colors.border },
                loadingOperation === 'pdf' && styles.optionDisabled
              ]}
              onPress={handleDownloadPDF}
              disabled={!!loadingOperation}
            >
              <View style={[styles.optionIcon, { backgroundColor: theme.colors.error }]}>
                {loadingOperation === 'pdf' ? (
                  <ActivityIndicator size="small" color={theme.colors.surface} />
                ) : (
                  <Ionicons name="document-text" size={24} color={theme.colors.surface} />
                )}
              </View>
              <View style={styles.optionContent}>
                <Text style={[styles.optionTitle, { color: theme.colors.text }]}>
                  Download PDF
                </Text>
                <Text style={[styles.optionDescription, { color: theme.colors.textMuted }]}>
                  {loadingOperation === 'pdf' ? 'Generating PDF...' : 'Save summary as PDF file to your device'}
                </Text>
              </View>
              {loadingOperation !== 'pdf' && (
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.option, 
                { borderBottomColor: theme.colors.border },
                (!nativeShareAvailable || loadingOperation === 'share') && styles.optionDisabled
              ]}
              onPress={handleNativeShare}
              disabled={!nativeShareAvailable || !!loadingOperation}
            >
              <View style={[
                styles.optionIcon, 
                { backgroundColor: nativeShareAvailable ? theme.colors.primary : theme.colors.textMuted }
              ]}>
                {loadingOperation === 'share' ? (
                  <ActivityIndicator size="small" color={theme.colors.surface} />
                ) : (
                  <Ionicons name="share" size={24} color={theme.colors.surface} />
                )}
              </View>
              <View style={styles.optionContent}>
                <Text style={[
                  styles.optionTitle, 
                  { color: nativeShareAvailable ? theme.colors.text : theme.colors.textMuted }
                ]}>
                  Share via Apps
                </Text>
                <Text style={[styles.optionDescription, { color: theme.colors.textMuted }]}>
                  {loadingOperation === 'share' 
                    ? 'Preparing to share...' 
                    : nativeShareAvailable 
                      ? 'Share through messaging, email, or other apps'
                      : 'Not available on this platform'
                  }
                </Text>
              </View>
              {loadingOperation !== 'share' && nativeShareAvailable && (
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.option,
                (!emailAvailable || loadingOperation === 'email') && styles.optionDisabled
              ]}
              onPress={handleEmailShare}
              disabled={!emailAvailable || !!loadingOperation}
            >
              <View style={[
                styles.optionIcon, 
                { backgroundColor: emailAvailable ? theme.colors.success : theme.colors.textMuted }
              ]}>
                {loadingOperation === 'email' ? (
                  <ActivityIndicator size="small" color={theme.colors.surface} />
                ) : (
                  <Ionicons name="mail" size={24} color={theme.colors.surface} />
                )}
              </View>
              <View style={styles.optionContent}>
                <Text style={[
                  styles.optionTitle, 
                  { color: emailAvailable ? theme.colors.text : theme.colors.textMuted }
                ]}>
                  Send via Email
                </Text>
                <Text style={[styles.optionDescription, { color: theme.colors.textMuted }]}>
                  {loadingOperation === 'email' 
                    ? 'Composing email...' 
                    : emailAvailable 
                      ? 'Send summary directly to your healthcare provider'
                      : 'No email client available'
                  }
                </Text>
              </View>
              {loadingOperation !== 'email' && emailAvailable && (
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={[styles.footerNote, { color: theme.colors.textMuted }]}>
              Your summary will expire in 7 days for privacy and security
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const getShareOptionsStyles = (theme: AppTheme) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    paddingBottom: theme.spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: theme.typography.fontSizes.lg,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  options: {
    paddingHorizontal: theme.spacing.lg,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    borderBottomWidth: 1,
  },
  optionDisabled: {
    opacity: 0.6,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: theme.typography.fontSizes.md,
    fontFamily: theme.typography.fontFamilies.semiBold,
    marginBottom: theme.spacing.xs,
  },
  optionDescription: {
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.regular,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  footerNote: {
    fontSize: theme.typography.fontSizes.xs,
    fontFamily: theme.typography.fontFamilies.regular,
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default ShareOptions;

