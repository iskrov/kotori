import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Text,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppTheme } from '../../config/theme';
import { MainStackParamList, SharePreviewParams } from '../../navigation/types';
import { QAItem } from './components/QAItem';
import { ShareOptions } from './components/ShareOptions';
import shareService, { ShareData, ShareRequest, SharePlaintextEntry } from '../../services/shareService';
import encryptedJournalService from '../../services/encryptedJournalService';
import { SharePreviewSkeleton, ShareGenerationProgress } from '../../components/loading';
import { ShareErrorBoundary } from '../../components/errors';
import useRetryableOperation from '../../hooks/useRetryableOperation';
import logger from '../../utils/logger';

type SharePreviewScreenNavigationProp = StackNavigationProp<MainStackParamList, 'SharePreview'>;
type SharePreviewScreenRouteProp = RouteProp<MainStackParamList, 'SharePreview'>;



const SharePreviewScreenContent: React.FC = () => {
  const navigation = useNavigation<SharePreviewScreenNavigationProp>();
  const route = useRoute<SharePreviewScreenRouteProp>();
  const { theme } = useAppTheme();
  const styles = getSharePreviewStyles(theme);
  const params = route.params;

  const [loading, setLoading] = useState(true);
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [editedAnswers, setEditedAnswers] = useState<Map<string, string>>(new Map());
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState<number | undefined>(undefined);

  useEffect(() => {
    generateShare();
  }, []);

  const generateShare = async () => {
    try {
      setLoading(true);
      setGenerationStep(0);
      logger.info('[SharePreviewScreen] Processing share request', params);
      
      let shareData: ShareData;

      if (params.shareId) {
        // Loading existing share from history - faster, no progress needed
        logger.info('[SharePreviewScreen] Loading existing share', { shareId: params.shareId });
        shareData = await shareService.getShare(params.shareId);
        
        // Validate share data structure
        if (!shareData || typeof shareData !== 'object') {
          throw new Error('Invalid share data received from server');
        }
        

      } else {
        // Generating new share - show progress
        if (!params.templateId || !params.dateRange || !params.period) {
          throw new Error('Missing required parameters for share generation');
        }

        logger.info('[SharePreviewScreen] Generating new share');
        
        // Simulate progress steps for better UX
        setEstimatedTime(20); // Estimated 20 seconds
        
        // Step 1: Analyzing entries
        setGenerationStep(0);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Step 2: AI Processing  
        setGenerationStep(1);
        setEstimatedTime(15);
        
        // Collect decrypted entries for the selected range
        const decryptedEntries = await encryptedJournalService.getEntries({
          start_date: params.dateRange.start,
          end_date: params.dateRange.end,
          limit: 1000,
        });

        const entriesForShare: SharePlaintextEntry[] = (decryptedEntries || [])
          .filter((e: any) => typeof e.content === 'string' && e.content.trim().length > 0)
          .map((e: any) => ({
            id: String(e.id || ''),
            content: e.content,
            entry_date: e.entry_date || e.created_at,
            title: e.title || undefined,
          }));

        // Check if consent was already given in ShareScreen
        if (!params.consentGiven) {
          // This should not happen with the new flow, but handle gracefully
          logger.error('[SharePreviewScreen] No consent given - this should not happen with new flow');
          setError('Consent required for share generation');
          return;
        }

        logger.info('[SharePreviewScreen] Consent already given, proceeding with generation', {
          entryCount: entriesForShare.length
        });

        const shareRequest: ShareRequest = {
          template_id: params.templateId,
          entries: entriesForShare,
          consent_acknowledged: true,
          period: params.period,
          target_language: params.target_language || 'en',
        };

        // Step 3: Mapping answers (actual API call happens here)
        setGenerationStep(2);
        setEstimatedTime(8);
        const createdShare = await shareService.generateShare(shareRequest);
        
        // Step 4: Fetch full share details (including content)
        setGenerationStep(3);
        setEstimatedTime(2);
        shareData = await shareService.getShare(createdShare.id);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Validate generated share data structure
        if (!shareData || typeof shareData !== 'object') {
          throw new Error('Invalid share data received from server');
        }
      }

      setShareData(shareData);
      logger.info('[SharePreviewScreen] Share processed successfully', { 
        shareId: shareData.id,
        isExisting: !!params.shareId 
      });
    } catch (error) {
      logger.error('[SharePreviewScreen] Failed to process share', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const isNetworkError = errorMessage.includes('network') || errorMessage.includes('fetch');
      
      Alert.alert(
        isNetworkError ? 'Network Error' : 'Processing Failed',
        isNetworkError 
          ? 'Unable to connect to the server. Please check your internet connection and try again.'
          : `Unable to ${params.shareId ? 'load' : 'create'} share summary. ${errorMessage}`,
        [
          { text: 'Retry', onPress: generateShare },
          { text: 'Cancel', onPress: () => navigation.goBack() },
        ]
      );
    } finally {
      setLoading(false);
      setEstimatedTime(undefined);
    }
  };

  const handleAnswerEdit = (questionId: string, newAnswer: string) => {
    const updated = new Map(editedAnswers);
    updated.set(questionId, newAnswer);
    setEditedAnswers(updated);
    logger.info('[SharePreviewScreen] Answer edited', { questionId, length: newAnswer.length });
  };

  const handleConfirmShare = async () => {
    try {
      logger.info('[SharePreviewScreen] Confirming share', { editCount: editedAnswers.size });
      
      // Apply edits if any
      if (editedAnswers.size > 0 && shareData) {
        logger.info('[SharePreviewScreen] Applying edits to share');
        
        // Update the share content with edited answers
        const updatedContent = {
          ...shareData.content,
          answers: shareData.content.answers.map(answer => {
            const editedAnswer = editedAnswers.get(answer.question_id);
            return editedAnswer ? { ...answer, answer: editedAnswer } : answer;
          })
        };

        const updatedShare = await shareService.updateShare(shareData.id, {
          content: updatedContent
        });

        setShareData(updatedShare);
        setEditedAnswers(new Map()); // Clear edits after successful update
        logger.info('[SharePreviewScreen] Share updated successfully');
      }

      setShowShareOptions(true);
    } catch (error) {
      logger.error('[SharePreviewScreen] Failed to confirm share', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert(
        'Update Failed', 
        `Failed to save your changes. ${errorMessage}`,
        [
          { text: 'Try Again', onPress: handleConfirmShare },
          { text: 'Continue Anyway', onPress: () => setShowShareOptions(true) },
        ]
      );
    }
  };

  const formatDateRange = (dateRange?: { start: string; end: string }) => {
    if (!dateRange) {
      // For existing shares, try to derive from share creation date or show generic text
      if (shareData?.created_at) {
        return new Date(shareData.created_at).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      }
      return 'Date range not available';
    }

    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    
    if (params.period === 'daily') {
      return startDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
    
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    const startStr = startDate.toLocaleDateString('en-US', options);
    const endStr = endDate.toLocaleDateString('en-US', {
      ...options,
      year: startDate.getFullYear() !== endDate.getFullYear() ? 'numeric' : undefined,
    });
    
    return `${startStr} - ${endStr}`;
  };

  if (loading) {
    // Show different loading UI for generation vs. loading existing share
    if (params.shareId) {
      // Simple loading for existing shares
      return (
        <SafeAreaView style={styles.loadingContainer}>
          <SharePreviewSkeleton 
            questionCount={3} 
            showHeader={true} 
            showActions={false} 
          />
        </SafeAreaView>
      );
    } else {
      // Detailed progress for new share generation
      return (
        <SafeAreaView style={styles.loadingContainer}>
          <ShareGenerationProgress
            currentStep={generationStep}
            estimatedTimeRemaining={estimatedTime}
          />
        </SafeAreaView>
      );
    }
  }

  if (!shareData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={theme.colors.error} />
          <Text style={[styles.errorText, { color: theme.colors.error }]}>
            Failed to generate summary
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
            onPress={generateShare}
          >
            <Text style={[styles.retryText, { color: theme.colors.primaryContrast }]}>
              Try Again
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Review Summary</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.metadata, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.metadataTitle, { color: theme.colors.text }]}>
            {shareData.title}
          </Text>
          <Text style={[styles.dateRange, { color: theme.colors.textMuted }]}>
            {formatDateRange(params.dateRange)}
          </Text>
        </View>

        {/* Show helpful message if all answers are fallbacks */}
        {shareData.content.answers.every(qa => qa.confidence === 0.0) && (
          <View style={[styles.fallbackBanner, { backgroundColor: theme.colors.warning + '20', borderColor: theme.colors.warning }]}>
            <Ionicons name="information-circle" size={20} color={theme.colors.warning} />
            <Text style={[styles.fallbackText, { color: theme.colors.text }]}>
              This summary couldn't be generated automatically. You can edit the answers manually before sharing.
            </Text>
          </View>
        )}

        {shareData.content.answers.map((qa, index) => (
          <QAItem
            key={qa.question_id}
            question={qa.question_text}
            answer={editedAnswers.get(qa.question_id) || qa.answer}
            confidence={qa.confidence}
            onEdit={(newAnswer) => handleAnswerEdit(qa.question_id, newAnswer)}
            isLast={index === shareData.content.answers.length - 1}
          />
        ))}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
        <TouchableOpacity
          style={[styles.shareButton, { backgroundColor: theme.colors.primary }]}
          onPress={handleConfirmShare}
        >
          <Ionicons name="share-outline" size={20} color={theme.colors.primaryContrast} />
          <Text style={[styles.shareButtonText, { color: theme.colors.primaryContrast }]}>
            Share Summary
          </Text>
        </TouchableOpacity>
        <Text style={[styles.footerNote, { color: theme.colors.textMuted }]}>
          You can edit any answer by tapping on it
        </Text>
      </View>

      <ShareOptions
        visible={showShareOptions}
        onClose={() => setShowShareOptions(false)}
        shareId={shareData.id}
        shareToken={shareData.share_token}
      />
    </SafeAreaView>
  );
};

const getSharePreviewStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingText: {
    fontSize: theme.typography.fontSizes.lg,
    fontFamily: theme.typography.fontFamilies.semiBold,
    marginTop: theme.spacing.lg,
  },
  loadingSubtext: {
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.regular,
    marginTop: theme.spacing.sm,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  errorText: {
    fontSize: theme.typography.fontSizes.lg,
    fontFamily: theme.typography.fontFamilies.semiBold,
    marginTop: theme.spacing.lg,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.lg,
  },
  retryText: {
    fontSize: theme.typography.fontSizes.md,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: theme.typography.fontSizes.lg,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  content: {
    flex: 1,
  },
  metadata: {
    margin: theme.spacing.lg,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
  },
  metadataTitle: {
    fontSize: theme.typography.fontSizes.lg,
    fontFamily: theme.typography.fontFamilies.semiBold,
    marginBottom: theme.spacing.xs,
  },
  dateRange: {
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    borderTopWidth: 1,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
  },
  shareButtonText: {
    fontSize: theme.typography.fontSizes.md,
    fontFamily: theme.typography.fontFamilies.semiBold,
    marginLeft: theme.spacing.sm,
  },
  footerNote: {
    fontSize: theme.typography.fontSizes.xs,
    fontFamily: theme.typography.fontFamilies.regular,
    textAlign: 'center',
  },
  fallbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    margin: theme.spacing.lg,
    marginTop: 0,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
  },
  fallbackText: {
    flex: 1,
    marginLeft: theme.spacing.sm,
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.regular,
    lineHeight: 20,
  },
});

const SharePreviewScreen: React.FC = () => {
  return (
    <ShareErrorBoundary>
      <SharePreviewScreenContent />
    </ShareErrorBoundary>
  );
};

export default SharePreviewScreen;

