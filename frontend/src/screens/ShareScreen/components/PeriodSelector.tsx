import React, { useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import { useAppTheme } from '../../../contexts/ThemeContext';
import { AppTheme } from '../../../config/theme';
import { Period, PeriodSelectorProps } from '../types';

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  value,
  onChange,
  onDateRangeChange
}) => {
  const { theme } = useAppTheme();
  const styles = getPeriodSelectorStyles(theme);

  const periods: { key: Period; label: string }[] = [
    { key: 'daily', label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
  ];

  const dateRange = useMemo(() => {
    const today = new Date();
    let start: Date;
    let end: Date;
    
    switch (value) {
      case 'daily':
        start = startOfDay(today);
        end = endOfDay(today);
        break;
      case 'weekly':
        // Start week on Monday (weekStartsOn: 1)
        start = startOfWeek(today, { weekStartsOn: 1 });
        end = endOfWeek(today, { weekStartsOn: 1 });
        break;
      case 'monthly':
        start = startOfMonth(today);
        end = endOfMonth(today);
        break;
      default:
        start = startOfWeek(today, { weekStartsOn: 1 });
        end = endOfWeek(today, { weekStartsOn: 1 });
    }
    
    return { start, end };
  }, [value]);
  
  useEffect(() => {
    onDateRangeChange(dateRange);
  }, [dateRange, onDateRangeChange]);
  
  const formatDateRange = () => {
    // Safety check for dateRange
    if (!dateRange || !dateRange.start || !dateRange.end) {
      return 'Loading...';
    }

    const options: Intl.DateTimeFormatOptions = { 
      month: 'short', 
      day: 'numeric' 
    };
    
    if (value === 'daily') {
      return dateRange.start.toLocaleDateString('en-US', {
        ...options,
        year: 'numeric'
      });
    }
    
    const startStr = dateRange.start.toLocaleDateString('en-US', options);
    const endStr = dateRange.end.toLocaleDateString('en-US', {
      ...options,
      year: dateRange.start.getFullYear() !== dateRange.end.getFullYear() 
        ? 'numeric' 
        : undefined
    });
    
    return `${startStr} - ${endStr}`;
  };

  const getPeriodLabel = () => {
    switch (value) {
      case 'daily':
        return 'Today';
      case 'weekly':
        return 'This week';
      case 'monthly':
        return 'This month';
      default:
        return '';
    }
  };
  
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.colors.text }]}>
        Select Period
      </Text>
      
      <View style={[styles.tabs, { backgroundColor: theme.colors.border }]}>
        {periods.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.tab,
              value === key && [styles.tabActive, { backgroundColor: theme.colors.primary }]
            ]}
            onPress={() => onChange(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: value === key }}
          >
            <Text style={[
              styles.tabText,
              { color: theme.colors.text },
              value === key && [styles.tabTextActive, { color: theme.colors.primaryContrast }]
            ]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      <View style={styles.dateDisplay}>
        <Text style={[styles.dateText, { color: theme.colors.text }]}>
          {formatDateRange()}
        </Text>
        <Text style={[styles.dateLabel, { color: theme.colors.textMuted }]}>
          {getPeriodLabel()}
        </Text>
      </View>
    </View>
  );
};

const getPeriodSelectorStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    margin: theme.spacing.lg,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  title: {
    fontSize: theme.typography.fontSizes.md,
    fontFamily: theme.typography.fontFamilies.semiBold,
    marginBottom: theme.spacing.md,
  },
  tabs: {
    flexDirection: 'row',
    borderRadius: theme.borderRadius.md,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  tabActive: {
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.medium,
  },
  tabTextActive: {
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  dateDisplay: {
    marginTop: theme.spacing.md,
    alignItems: 'center',
  },
  dateText: {
    fontSize: theme.typography.fontSizes.md,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  dateLabel: {
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.regular,
    marginTop: theme.spacing.xs,
  },
});

export default PeriodSelector;
