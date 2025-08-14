import React, { useState, useEffect } from 'react';
import { View, ScrollView, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppTheme } from '../../config/theme';
import { accessibilityTokens } from '../../styles/theme';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { MainStackParamList } from '../../navigation/types';
import logger from '../../utils/logger';
import { Period, DateRange, Template, TemplateListProps, ButtonProps } from './types';
import { PeriodSelector, TemplateSelector } from './components';
import { AnimatedButton, FadeInView, SlideInView } from '../../components/animated';
import LanguageSelector from '../../components/LanguageSelector';
import ScreenHeader from '../../components/ScreenHeader';
import SettingsSection from '../../components/settings/SettingsSection';
import SafeScrollView from '../../components/SafeScrollView';
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
  
  // Set document title for web browsers
  useDocumentTitle('Share');
  
  const [period, setPeriod] = useState<Period>('weekly');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>();
  const [targetLanguage, setTargetLanguage] = useState<string>('en');
  
  // Scroll to top functionality
  const scrollViewRef = React.useRef<any>(null);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const scrollToTopOpacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    logger.info('[ShareScreen] ShareScreen mounted');
  }, []);

  const handleScroll = (event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    const shouldShow = scrollY > 200;
    
    if (shouldShow !== showScrollToTop) {
      setShowScrollToTop(shouldShow);
      Animated.timing(scrollToTopOpacity, {
        toValue: shouldShow ? 1 : 0,
        duration: 200,
        useNativeDriver: false, // Changed to false for web compatibility
      }).start();
    }
  };
  
  const scrollToTop = () => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

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
      target_language: targetLanguage,
    });
  };

  const handleViewHistory = () => {
    logger.info('[ShareScreen] View history pressed');
    navigation.navigate('ShareHistory');
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Share" />
      <SafeScrollView 
        ref={scrollViewRef}
        style={styles.container} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Time Range Section */}
        <SettingsSection
          title="Time Range"
          subtitle="Select the period for your summary"
          icon="calendar"
        >
          <PeriodSelector
            value={period}
            onChange={setPeriod}
            onDateRangeChange={setDateRange}
          />
          {dateRange && (
            <View style={styles.dateDisplay}>
              <Text style={[styles.dateText, { color: theme.colors.textMuted }]}>
                {dateRange.start.toLocaleDateString()} - {dateRange.end.toLocaleDateString()}
              </Text>
            </View>
          )}
        </SettingsSection>

        {/* Template Section */}
        <SettingsSection
          title="Summary Template"
          subtitle="Choose the type of summary to generate"
          icon="document-text"
        >
          <TemplateSelector
            selectedId={selectedTemplate}
            onSelect={setSelectedTemplate}
            onError={(error) => {
              logger.error('[ShareScreen] Template selector error', error);
            }}
          />
        </SettingsSection>

        {/* Language Section */}
        <SettingsSection
          title="Output Language"
          subtitle="Language for the generated summary"
          icon="language"
        >
          <LanguageSelector
            selectedLanguage={targetLanguage}
            onLanguageChange={setTargetLanguage}
          />
        </SettingsSection>

        {/* Actions Section */}
        <SettingsSection
          title="Actions"
          icon="play"
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
        </SettingsSection>
      </SafeScrollView>
      
      {/* Scroll to top button */}
      <Animated.View 
        style={[
          styles.scrollToTopButton,
          {
            opacity: scrollToTopOpacity,
            transform: [{
              scale: scrollToTopOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 1],
              })
            }]
          }
        ]}
        pointerEvents={showScrollToTop ? 'auto' : 'none'}
      >
        <TouchableOpacity
          style={styles.scrollToTopButtonInner}
          onPress={scrollToTop}
          activeOpacity={0.7}
          accessibilityLabel="Scroll to top of share screen"
          accessibilityRole="button"
          accessibilityHint="Scroll to the top of the share screen"
        >
          <Ionicons name="chevron-up" size={24} color={theme.colors.white} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const getShareScreenStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingBottom: 120, // Increase padding for better navigation space and visual consistency
  },
  dateDisplay: {
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.chipBackground,
    borderRadius: theme.borderRadius.sm,
    marginHorizontal: theme.spacing.sm,
  },
  dateText: {
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.medium,
    textAlign: 'center',
  },
  actions: {
    gap: theme.spacing.md,
  },
  generateButton: {
    marginBottom: theme.spacing.sm,
  },
  historyButton: {
    // Secondary button styling handled by AnimatedButton
  },
  scrollToTopButton: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    zIndex: 1000,
  },
  scrollToTopButtonInner: {
    width: accessibilityTokens.minTouchTarget,
    height: accessibilityTokens.minTouchTarget,
    borderRadius: accessibilityTokens.minTouchTarget / 2,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.md, // Using consistent soft shadows
  },
});

export default ShareScreen;

