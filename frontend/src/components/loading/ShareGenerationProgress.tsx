import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppTheme } from '../../config/theme';

interface ShareGenerationStep {
  id: string;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface ShareGenerationProgressProps {
  currentStep: number;
  steps: ShareGenerationStep[];
  progress?: number; // 0-1 for current step progress
  estimatedTimeRemaining?: number; // seconds
}

const defaultSteps: ShareGenerationStep[] = [
  {
    id: 'analyzing',
    label: 'Analyzing Entries',
    description: 'Reading your journal entries for the selected period',
    icon: 'document-text-outline',
  },
  {
    id: 'processing',
    label: 'AI Processing',
    description: 'Using AI to understand and structure your content',
    icon: 'bulb-outline',
  },
  {
    id: 'mapping',
    label: 'Mapping Answers',
    description: 'Matching your entries to template questions',
    icon: 'link-outline',
  },
  {
    id: 'finalizing',
    label: 'Finalizing Summary',
    description: 'Preparing your shareable summary',
    icon: 'checkmark-circle-outline',
  },
];

export const ShareGenerationProgress: React.FC<ShareGenerationProgressProps> = ({
  currentStep,
  steps = defaultSteps,
  progress = 0,
  estimatedTimeRemaining,
}) => {
  const { theme } = useAppTheme();
  const styles = getShareGenerationProgressStyles(theme);
  
  const animatedProgress = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: (currentStep + progress) / steps.length,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [currentStep, progress, steps.length, animatedProgress]);

  const formatTimeRemaining = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s remaining`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s remaining`;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }] }>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Generating Your Summary
        </Text>
        {estimatedTimeRemaining && (
          <Text style={[styles.timeRemaining, { color: theme.colors.textMuted }]}>
            {formatTimeRemaining(estimatedTimeRemaining)}
          </Text>
        )}
      </View>

      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBarBackground, { backgroundColor: theme.colors.border }]}>
          <Animated.View
            style={[
              styles.progressBarFill,
              {
                backgroundColor: theme.colors.primary,
                width: animatedProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
        <Text style={[styles.progressText, { color: theme.colors.textMuted }]}>
          Step {currentStep + 1} of {steps.length}
        </Text>
      </View>

      <View style={styles.stepsContainer}>
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isUpcoming = index > currentStep;

          return (
            <View key={step.id} style={styles.stepItem}>
              <View style={styles.stepIndicator}>
                <View
                  style={[
                    styles.stepIcon,
                    {
                      backgroundColor: isCompleted
                        ? theme.colors.success
                        : isCurrent
                        ? theme.colors.primary
                        : theme.colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name={isCompleted ? 'checkmark' : step.icon}
                    size={20}
                    color={
                      isCompleted || isCurrent
                        ? theme.colors.onPrimary
                        : theme.colors.textMuted
                    }
                  />
                </View>
                {index < steps.length - 1 && (
                  <View
                    style={[
                      styles.stepConnector,
                      {
                        backgroundColor: isCompleted
                          ? theme.colors.success
                          : theme.colors.border,
                      },
                    ]}
                  />
                )}
              </View>

              <View style={styles.stepContent}>
                <Text
                  style={[
                    styles.stepLabel,
                    {
                      color: isCurrent
                        ? theme.colors.text
                        : isCompleted
                        ? theme.colors.success
                        : theme.colors.textMuted,
                      fontFamily: isCurrent
                        ? theme.typography.fontFamilies.semiBold
                        : theme.typography.fontFamilies.regular,
                    },
                  ]}
                >
                  {step.label}
                </Text>
                <Text
                  style={[
                    styles.stepDescription,
                    {
                      color: isCurrent
                        ? theme.colors.textMuted
                        : theme.colors.disabled,
                    },
                  ]}
                >
                  {step.description}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const getShareGenerationProgressStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    padding: theme.spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  title: {
    fontSize: theme.typography.fontSizes.xl,
    fontFamily: theme.typography.fontFamilies.bold,
    marginBottom: theme.spacing.sm,
  },
  timeRemaining: {
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  progressBarContainer: {
    marginBottom: theme.spacing.xl,
  },
  progressBarBackground: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: theme.spacing.sm,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.regular,
    textAlign: 'center',
  },
  stepsContainer: {
    paddingHorizontal: theme.spacing.md,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.lg,
  },
  stepIndicator: {
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  stepIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepConnector: {
    width: 2,
    height: theme.spacing.lg,
    marginTop: theme.spacing.sm,
  },
  stepContent: {
    flex: 1,
    paddingTop: theme.spacing.sm,
  },
  stepLabel: {
    fontSize: theme.typography.fontSizes.md,
    marginBottom: theme.spacing.xs,
  },
  stepDescription: {
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.regular,
    lineHeight: 20,
  },
});

export default ShareGenerationProgress;
