import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  Modal,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppTheme } from '../../config/theme';
import SettingsRow from './SettingsRow';

export interface SettingsOption {
  value: string;
  label: string;
  subtitle?: string;
  disabled?: boolean;
}

interface SettingsSelectorProps {
  title: string;
  subtitle?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  options: SettingsOption[];
  selectedValue: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
  placeholder?: string;
}

const SettingsSelector: React.FC<SettingsSelectorProps> = ({
  title,
  subtitle,
  leftIcon,
  options,
  selectedValue,
  onValueChange,
  disabled = false,
  style,
  testID,
  placeholder = 'Select an option',
}) => {
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const selectedOption = options.find(option => option.value === selectedValue);
  const displayText = selectedOption?.label || placeholder;

  const handleOptionSelect = (value: string) => {
    onValueChange(value);
    setIsModalVisible(false);
  };

  const handlePress = () => {
    if (!disabled) {
      setIsModalVisible(true);
    }
  };

  const rightElement = (
    <View style={styles.rightContainer}>
      <Text 
        style={[
          styles.selectedText,
          disabled && styles.selectedTextDisabled,
          !selectedOption && styles.placeholderText,
        ]}
      >
        {displayText}
      </Text>
    </View>
  );

  const renderOption = ({ item }: { item: SettingsOption }) => (
    <TouchableOpacity
      style={[
        styles.optionItem,
        item.value === selectedValue && styles.selectedOptionItem,
        item.disabled && styles.optionItemDisabled,
      ]}
      onPress={() => handleOptionSelect(item.value)}
      disabled={item.disabled}
      accessibilityRole="button"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: item.value === selectedValue }}
    >
      <View style={styles.optionContent}>
        <Text 
          style={[
            styles.optionLabel,
            item.value === selectedValue && styles.selectedOptionLabel,
            item.disabled && styles.optionLabelDisabled,
          ]}
        >
          {item.label}
        </Text>
        
        {item.subtitle && (
          <Text 
            style={[
              styles.optionSubtitle,
              item.disabled && styles.optionSubtitleDisabled,
            ]}
          >
            {item.subtitle}
          </Text>
        )}
      </View>
      
      {item.value === selectedValue && (
        <Ionicons 
          name="checkmark-circle" 
          size={24} 
          color={theme.colors.primary} 
        />
      )}
    </TouchableOpacity>
  );

  return (
    <>
      <SettingsRow
        title={title}
        subtitle={subtitle}
        leftIcon={leftIcon}
        rightElement={rightElement}
        onPress={handlePress}
        disabled={disabled}
        style={style}
        showChevron={true}
        testID={testID}
      />

      <Modal
        visible={isModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft} />
            
            <Text style={styles.modalTitle}>{title}</Text>
            
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setIsModalVisible(false)}
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Options List */}
          <FlatList
            data={options}
            keyExtractor={(item) => item.value}
            renderItem={renderOption}
            style={styles.optionsList}
            showsVerticalScrollIndicator={true}
            bounces={true}
          />
        </View>
      </Modal>
    </>
  );
};

const getStyles = (theme: AppTheme) => StyleSheet.create({
  rightContainer: {
    alignItems: 'flex-end',
  },
  selectedText: {
    fontSize: theme.typography.fontSizes.md,
    fontFamily: theme.typography.fontFamilies.regular,
    color: theme.colors.textSecondary,
    textAlign: 'right',
  },
  selectedTextDisabled: {
    color: theme.colors.disabled,
  },
  placeholderText: {
    fontStyle: 'italic',
    color: theme.colors.textDisabled,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  headerLeft: {
    width: 60, // Balance the header
  },
  modalTitle: {
    fontSize: theme.typography.fontSizes.lg,
    fontFamily: theme.typography.fontFamilies.bold,
    color: theme.colors.text,
    textAlign: 'center',
  },
  headerButton: {
    width: 60,
    alignItems: 'flex-end',
  },
  doneButtonText: {
    fontSize: theme.typography.fontSizes.md,
    fontFamily: theme.typography.fontFamilies.semiBold,
    color: theme.colors.primary,
  },
  optionsList: {
    flex: 1,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    minHeight: 64,
  },
  selectedOptionItem: {
    backgroundColor: theme.colors.primaryLight + '20',
  },
  optionItemDisabled: {
    opacity: 0.5,
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: theme.typography.fontSizes.md,
    fontFamily: theme.typography.fontFamilies.semiBold,
    color: theme.colors.text,
  },
  selectedOptionLabel: {
    color: theme.colors.primary,
  },
  optionLabelDisabled: {
    color: theme.colors.disabled,
  },
  optionSubtitle: {
    fontSize: theme.typography.fontSizes.sm,
    fontFamily: theme.typography.fontFamilies.regular,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  optionSubtitleDisabled: {
    color: theme.colors.disabled,
  },
});

export default SettingsSelector; 