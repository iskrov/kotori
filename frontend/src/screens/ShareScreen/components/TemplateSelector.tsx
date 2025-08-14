import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../../contexts/ThemeContext';
import { AppTheme } from '../../../config/theme';
import { shareTemplateService, ShareTemplate } from '../../../services/shareTemplateService';
import { TemplateSelectorProps } from '../types';
import { AnimatedCard, FadeInView } from '../../../components/animated';
import { ANIMATION_DURATIONS, getStaggeredDelay } from '../../../styles/animations';
import logger from '../../../utils/logger';

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  selectedId,
  onSelect,
  onError
}) => {
  const { theme } = useAppTheme();
  const styles = getTemplateSelectorStyles(theme);
  const [templates, setTemplates] = useState<ShareTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setIsLoading(true);
      setError(null);
      logger.info('[TemplateSelector] Loading templates');
      const data = await shareTemplateService.getActiveTemplates();
      setTemplates(data);
      logger.info('[TemplateSelector] Templates loaded successfully', { count: data.length });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load templates';
      logger.error('[TemplateSelector] Failed to load templates', err);
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const getTemplateIcon = (templateName: string): keyof typeof Ionicons.glyphMap => {
    const name = templateName.toLowerCase();
    if (name.includes('wellness') || name.includes('health')) return 'fitness-outline';
    if (name.includes('medical') || name.includes('doctor')) return 'medical-outline';
    if (name.includes('mood') || name.includes('emotion')) return 'happy-outline';
    if (name.includes('daily') || name.includes('journal')) return 'calendar-outline';
    return 'document-text-outline';
  };

  const renderTemplate = ({ item, index }: { item: ShareTemplate; index: number }) => (
    <FadeInView 
      duration={ANIMATION_DURATIONS.STANDARD}
      delay={getStaggeredDelay(index, 50)}
    >
      <AnimatedCard
        onPress={() => onSelect(item.template_id)}
        selected={selectedId === item.template_id}
        style={styles.templateCard}
        accessibilityLabel={`Template: ${item.name}. ${item.description}`}
        accessibilityHint={selectedId === item.template_id ? 'Selected template' : 'Tap to select this template'}
      >
        <View style={[
          styles.templateIcon,
          selectedId === item.template_id && styles.templateIconSelected
        ]}>
          <Ionicons
            name={getTemplateIcon(item.name)}
            size={24}
            color={selectedId === item.template_id ? theme.colors.primary : theme.colors.textMuted}
          />
        </View>
        <View style={styles.templateContent}>
          <Text style={[
            styles.templateName,
            { color: theme.colors.text },
            selectedId === item.template_id && [styles.templateNameSelected, { color: theme.colors.primary }]
          ]}>
            {item.name}
          </Text>
          <Text style={[styles.templateDescription, { color: theme.colors.textMuted }]}>
            {item.description}
          </Text>
          {item.category && (
            <View style={[styles.presetBadge, { backgroundColor: theme.colors.success }]}>
              <Text style={[styles.presetText, { color: theme.colors.surface }]}>
                {item.category}
              </Text>
            </View>
          )}
        </View>
      </AnimatedCard>
    </FadeInView>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Choose Template
        </Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textMuted }]}>
            Loading templates...
          </Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Choose Template
        </Text>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={theme.colors.error} />
          <Text style={[styles.errorText, { color: theme.colors.error }]}>
            {error}
          </Text>
          <TouchableOpacity 
            style={[styles.retryButton, { backgroundColor: theme.colors.primary }]} 
            onPress={loadTemplates}
          >
            <Text style={[styles.retryText, { color: theme.colors.primaryContrast }]}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (templates.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Choose Template
        </Text>
        <View style={styles.errorContainer}>
          <Ionicons name="document-outline" size={48} color={theme.colors.textMuted} />
          <Text style={[styles.errorText, { color: theme.colors.textMuted }]}>
            No templates available
          </Text>
          <TouchableOpacity 
            style={[styles.retryButton, { backgroundColor: theme.colors.primary }]} 
            onPress={loadTemplates}
          >
            <Text style={[styles.retryText, { color: theme.colors.primaryContrast }]}>
              Refresh
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.colors.text }]}>
        Choose Template
      </Text>
      <FlatList
        data={templates}
        renderItem={renderTemplate}
        keyExtractor={(item) => item.template_id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        scrollEnabled={false} // Disable scrolling since we're inside a ScrollView
      />
    </View>
  );
};

const getTemplateSelectorStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    margin: theme.spacing.lg,
    marginTop: 0,
  },
  title: {
    fontSize: theme.typography.fontSizes.md,
    fontFamily: theme.typography.fontFamilies.semiBold,
    marginBottom: theme.spacing.md,
    marginLeft: theme.spacing.sm,
  },
  listContainer: {
    paddingBottom: theme.spacing.lg,
  },
  templateCard: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
    alignItems: 'center',
  },
  templateCardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surface,
  },
  templateIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  templateIconSelected: {
    backgroundColor: theme.colors.primaryLight,
  },
  templateContent: {
    flex: 1,
  },
  templateName: {
    fontSize: theme.typography.fontSizes.md,
    fontFamily: theme.typography.fontFamilies.semiBold,
    marginBottom: theme.spacing.xs,
  },
  templateNameSelected: {
    fontFamily: theme.typography.fontFamilies.bold,
  },
  templateDescription: {
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.regular,
    marginBottom: theme.spacing.xs,
  },
  presetBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  presetText: {
    fontSize: theme.typography.fontSizes.xs,
    fontFamily: theme.typography.fontFamilies.medium,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  loadingText: {
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.regular,
    marginTop: theme.spacing.sm,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  errorText: {
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.regular,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.md,
  },
  retryText: {
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
});

export default TemplateSelector;

