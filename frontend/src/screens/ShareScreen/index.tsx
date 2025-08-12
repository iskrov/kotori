import React, { useState, useEffect } from 'react';
import { View, ScrollView, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppTheme } from '../../config/theme';
import logger from '../../utils/logger';

// Placeholder components - will be implemented in subsequent tasks
const PeriodSelector = ({ value, onChange, onDateRangeChange }: any) => (
  <View style={{ padding: 20, backgroundColor: '#f0f0f0', margin: 20, borderRadius: 12 }}>
    <Text style={{ textAlign: 'center', fontSize: 16, fontWeight: '500' }}>
      Period Selector - Coming Soon
    </Text>
    <Text style={{ textAlign: 'center', fontSize: 14, marginTop: 8, opacity: 0.7 }}>
      Daily | Weekly | Monthly
    </Text>
  </View>
);

const TemplateList = ({ selectedId, onSelect }: any) => (
  <View style={{ padding: 20, backgroundColor: '#f0f0f0', margin: 20, borderRadius: 12 }}>
    <Text style={{ textAlign: 'center', fontSize: 16, fontWeight: '500' }}>
      Template List - Coming Soon
    </Text>
    <Text style={{ textAlign: 'center', fontSize: 14, marginTop: 8, opacity: 0.7 }}>
      Wellness Check | Medical Visit | Mood Tracker
    </Text>
  </View>
);

const Button = ({ title, onPress, disabled, variant }: any) => (
  <View
    style={{
      backgroundColor: disabled ? '#ccc' : variant === 'primary' ? '#2D5A87' : 'transparent',
      padding: 16,
      borderRadius: 12,
      marginHorizontal: 20,
      marginVertical: 8,
    }}
  >
    <Text
      style={{
        color: variant === 'primary' ? 'white' : '#2D5A87',
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '600',
      }}
      onPress={disabled ? undefined : onPress}
    >
      {title}
    </Text>
  </View>
);

type Period = 'daily' | 'weekly' | 'monthly';

const ShareScreen: React.FC = () => {
  const { theme } = useAppTheme();
  const styles = getShareScreenStyles(theme);
  
  const [period, setPeriod] = useState<Period>('weekly');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>();

  useEffect(() => {
    logger.info('[ShareScreen] ShareScreen mounted');
  }, []);

  const handleGenerateShare = () => {
    logger.info('[ShareScreen] Generate share pressed', {
      period,
      selectedTemplate,
      dateRange
    });
    // TODO: Navigate to preview screen (Task 10-14)
  };

  const handleViewHistory = () => {
    logger.info('[ShareScreen] View history pressed');
    // TODO: Navigate to history screen (Task 10-16)
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Share Summary
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
            Create a summary to share with your care team
          </Text>
        </View>

        <PeriodSelector
          value={period}
          onChange={setPeriod}
          onDateRangeChange={setDateRange}
        />

        <TemplateList
          selectedId={selectedTemplate}
          onSelect={setSelectedTemplate}
        />

        <View style={styles.actions}>
          <Button
            title="Generate Share"
            onPress={handleGenerateShare}
            disabled={!selectedTemplate || !dateRange}
            variant="primary"
          />
          
          <Button
            title="View History"
            onPress={handleViewHistory}
            variant="text"
          />
        </View>
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
  actions: {
    paddingBottom: theme.spacing.xl,
  },
});

export default ShareScreen;

