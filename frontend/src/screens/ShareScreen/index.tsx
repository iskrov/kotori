import React, { useState, useEffect } from 'react';
import { View, ScrollView, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppTheme } from '../../config/theme';
import { MainStackParamList } from '../../navigation/types';
import logger from '../../utils/logger';
import { Period, DateRange, Template, TemplateListProps, ButtonProps } from './types';
import { PeriodSelector, TemplateSelector } from './components';
import { AnimatedButton, FadeInView, SlideInView } from '../../components/animated';
import { ANIMATION_DURATIONS } from '../../styles/animations';

// Template component is now implemented as TemplateSelector

const Button: React.FC<ButtonProps> = ({ title, onPress, disabled = false, variant = 'primary', style }) => {
  const { theme } = useAppTheme();
  
  const buttonStyle = [
    {
      backgroundColor: disabled 
        ? theme.colors.border 
        : variant === 'primary' 
        ? theme.colors.primary 
        : 'transparent',
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      marginHorizontal: theme.spacing.lg,
      marginVertical: theme.spacing.sm,
    },
    style
  ];

  const textStyle = {
    color: disabled
      ? theme.colors.textMuted
      : variant === 'primary' 
      ? theme.colors.primaryContrast 
      : theme.colors.primary,
    textAlign: 'center' as const,
    fontSize: theme.typography.fontSizes.md,
    fontFamily: theme.typography.fontFamilies.semiBold,
  };

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityState={{ disabled }}
      accessibilityRole="button"
    >
      <Text style={textStyle}>
        {title}
      </Text>
    </TouchableOpacity>
  );
};

type ShareScreenNavigationProp = StackNavigationProp<MainStackParamList>;

const ShareScreen: React.FC = () => {
  const navigation = useNavigation<ShareScreenNavigationProp>();
  const { theme } = useAppTheme();
  const styles = getShareScreenStyles(theme);
  
  const [period, setPeriod] = useState<Period>('weekly');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>();

  useEffect(() => {
    logger.info('[ShareScreen] ShareScreen mounted');
  }, []);

  const handleGenerateShare = () => {
    if (!selectedTemplate || !dateRange) {
      logger.warn('[ShareScreen] Generate share pressed but missing requirements', {
        selectedTemplate: !!selectedTemplate,
        dateRange: !!dateRange
      });
      return;
    }

    logger.info('[ShareScreen] Generate share pressed', {
      period,
      selectedTemplate,
      dateRange
    });

    navigation.navigate('SharePreview', {
      templateId: selectedTemplate,
      dateRange: {
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
      },
      period,
    });
  };

  const handleViewHistory = () => {
    logger.info('[ShareScreen] View history pressed');
    navigation.navigate('ShareHistory');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <FadeInView duration={ANIMATION_DURATIONS.STANDARD}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              Share Summary
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
              Create a summary to share with your care team
            </Text>
          </View>
        </FadeInView>

        <SlideInView 
          direction="up" 
          delay={ANIMATION_DURATIONS.STAGGER_DELAY}
          duration={ANIMATION_DURATIONS.STANDARD}
        >
          <PeriodSelector
            value={period}
            onChange={setPeriod}
            onDateRangeChange={setDateRange}
          />
        </SlideInView>

        {dateRange && (
          <FadeInView 
            duration={ANIMATION_DURATIONS.FAST}
            delay={ANIMATION_DURATIONS.STAGGER_DELAY}
          >
            <View style={styles.dateDisplay}>
              <Text style={[styles.dateText, { color: theme.colors.textMuted }]}>
                Selected range: {dateRange.start.toLocaleDateString()} - {dateRange.end.toLocaleDateString()}
              </Text>
            </View>
          </FadeInView>
        )}

        <SlideInView 
          direction="up" 
          delay={ANIMATION_DURATIONS.STAGGER_DELAY * 2}
          duration={ANIMATION_DURATIONS.STANDARD}
        >
          <TemplateSelector
            selectedId={selectedTemplate}
            onSelect={setSelectedTemplate}
            onError={(error) => {
              logger.error('[ShareScreen] Template selector error', error);
              // Could show a toast or alert here
            }}
          />
        </SlideInView>

        <SlideInView 
          direction="up" 
          delay={ANIMATION_DURATIONS.STAGGER_DELAY * 3}
          duration={ANIMATION_DURATIONS.STANDARD}
        >
          <View style={styles.actions}>
            <AnimatedButton
              title="Generate Share"
              onPress={handleGenerateShare}
              disabled={!selectedTemplate || !dateRange}
              variant="primary"
              size="large"
              fullWidth
              style={styles.generateButton}
              accessibilityLabel="Generate share summary"
              accessibilityHint="Creates a summary of your journal entries for sharing"
            />
            
            <AnimatedButton
              title="View History"
              onPress={handleViewHistory}
              variant="secondary"
              size="medium"
              fullWidth
              style={styles.historyButton}
              accessibilityLabel="View share history"
              accessibilityHint="View previously created shares"
            />
          </View>
        </SlideInView>
      </ScrollView>
    </SafeAreaView>
  );
};

const getShareScreenStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  title: {
    fontSize: theme.typography.fontSizes.xl,
    fontFamily: theme.typography.fontFamilies.semiBold,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.regular,
    opacity: 0.7,
  },
  dateDisplay: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
  },
  dateText: {
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.regular,
    textAlign: 'center',
  },
  actions: {
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  generateButton: {
    marginBottom: theme.spacing.sm,
  },
  historyButton: {
    // Secondary button styling handled by AnimatedButton
  },
});

export default ShareScreen;

