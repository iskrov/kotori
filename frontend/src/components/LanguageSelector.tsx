import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';
import { AppTheme } from '../config/theme';
import { LanguageOption, SUPPORTED_LANGUAGES, getLanguageName } from '../config/languageConfig';
import BottomSheet, { BottomSheetRef } from './BottomSheet';

interface LanguageSelectorProps {
  selectedLanguage: string;
  onLanguageChange: (languageCode: string) => void;
  disabled?: boolean;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  selectedLanguage,
  onLanguageChange,
  disabled = false,
}) => {
  const { theme } = useAppTheme();
  const styles = getStyles(theme);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const bottomSheetRef = useRef<BottomSheetRef>(null);

  const selectedLanguageName = getLanguageName(selectedLanguage) || 'Auto-detect';

  // Filter languages based on search query
  const filteredLanguages = SUPPORTED_LANGUAGES.filter(language => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      language.name.toLowerCase().includes(query) ||
      language.code.toLowerCase().includes(query) ||
      (language.region && language.region.toLowerCase().includes(query))
    );
  });

  const handleLanguageSelect = (languageCode: string) => {
    onLanguageChange(languageCode);
    setModalVisible(false);
    setSearchQuery(''); // Clear search when closing
  };

  const handleOpenSelector = () => {
    if (!disabled) {
      setModalVisible(true);
    }
  };

  const handleCloseSelector = () => {
    setModalVisible(false);
    setSearchQuery(''); // Clear search when closing
  };

  const renderLanguageItem = ({ item }: { item: LanguageOption }) => (
    <TouchableOpacity
      style={[
        styles.languageItem,
        item.code === selectedLanguage && styles.selectedLanguageItem
      ]}
      onPress={() => handleLanguageSelect(item.code)}
      accessibilityLabel={`Select ${item.name} language`}
      accessibilityRole="button"
    >
      <View style={styles.languageInfo}>
        <Text style={[
          styles.languageName,
          item.code === selectedLanguage && styles.selectedLanguageName
        ]}>
          {item.region ? `${item.name} (${item.region})` : item.name}
        </Text><Text style={[
          styles.languageCode,
          item.code === selectedLanguage && styles.selectedLanguageCode
        ]}>
          {item.code}
        </Text>
      </View>{item.code === selectedLanguage && (
        <View style={styles.checkmarkContainer}>
          <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary} />
        </View>
      )}
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="search-outline" size={48} color={theme.colors.textDisabled} /><Text style={styles.emptyStateText}>No languages found</Text><Text style={styles.emptyStateSubtext}>Try a different search term</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.selector, disabled && styles.selectorDisabled]}
        onPress={handleOpenSelector}
        disabled={disabled}
        accessibilityLabel={`Current language: ${selectedLanguageName}. Tap to change.`}
        accessibilityRole="button"
        accessibilityHint="Opens language selection menu"
      >
        <View style={styles.selectorContent}>
          <View style={styles.iconContainer}>
            <Ionicons 
              name="language" 
              size={22} 
              color={disabled ? theme.colors.disabled : theme.colors.primary} 
            />
          </View><View style={styles.textContainer}>
            <Text style={styles.selectorLabel}>Language</Text><Text style={[
              styles.selectorText,
              disabled && styles.selectorTextDisabled
            ]}>
              {selectedLanguageName}
            </Text>
          </View>
        </View><Ionicons 
          name="chevron-down" 
          size={20} 
          color={disabled ? theme.colors.disabled : theme.colors.textSecondary} 
        />
      </TouchableOpacity><BottomSheet
        visible={modalVisible}
        onClose={handleCloseSelector}
        snapPoints={[0.7, 0.9]}
        initialSnapPoint={0}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Language</Text><Text style={styles.modalSubtitle}>
              Choose your preferred language for voice transcription
            </Text>
          </View><View style={styles.searchContainer}>
            <View style={styles.searchInputWrapper}>
              <Ionicons 
                name="search" 
                size={20} 
                color={theme.colors.textSecondary} 
                style={styles.searchIcon}
              /><TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search languages..."
                placeholderTextColor={theme.colors.textSecondary}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
              />{searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  style={styles.clearButton}
                  accessibilityLabel="Clear search"
                >
                  <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          </View>{searchQuery.trim() && (
            <Text style={styles.resultsCount}>
              {filteredLanguages.length} language{filteredLanguages.length === 1 ? '' : 's'} found
            </Text>
          )}<FlatList
            data={filteredLanguages}
            keyExtractor={(item) => item.code}
            renderItem={renderLanguageItem}
            style={styles.languageList}
            showsVerticalScrollIndicator={true}
            ListEmptyComponent={renderEmptyState}
            keyboardShouldPersistTaps="handled"
            getItemLayout={(data, index) => ({
              length: 72,
              offset: 72 * index,
              index,
            })}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={10}
          />
        </View>
      </BottomSheet>
    </View>
  );
};

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    marginVertical: theme.spacing.md,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 64,
    ...theme.shadows.sm,
  },
  selectorDisabled: {
    opacity: 0.6,
    backgroundColor: theme.colors.disabled,
  },
  selectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.primaryLight + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  selectorLabel: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.medium,
    marginBottom: theme.spacing.xs,
  },
  selectorText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.semiBold,
  },
  selectorTextDisabled: {
    color: theme.colors.disabled,
  },
  modalContent: {
    flex: 1,
  },
  modalHeader: {
    marginBottom: theme.spacing.lg,
  },
  modalTitle: {
    fontSize: theme.typography.fontSizes.xl,
    fontWeight: 'bold',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.bold,
    marginBottom: theme.spacing.xs,
  },
  modalSubtitle: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  searchContainer: {
    marginBottom: theme.spacing.lg,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    minHeight: 48,
  },
  searchIcon: {
    marginRight: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.regular,
    paddingVertical: theme.spacing.md,
  },
  clearButton: {
    padding: theme.spacing.xs,
    marginLeft: theme.spacing.sm,
  },
  resultsCount: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  languageList: {
    flex: 1,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.xs,
    minHeight: 72,
  },
  selectedLanguageItem: {
    backgroundColor: theme.colors.primaryLight + '20',
    borderWidth: 1,
    borderColor: theme.colors.primaryLight + '40',
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.semiBold,
    marginBottom: theme.spacing.xs,
  },
  selectedLanguageName: {
    color: theme.colors.primary,
  },
  languageCode: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  selectedLanguageCode: {
    color: theme.colors.primary,
  },
  checkmarkContainer: {
    marginLeft: theme.spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxxl,
  },
  emptyStateText: {
    fontSize: theme.typography.fontSizes.lg,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.semiBold,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  emptyStateSubtext: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textDisabled,
    fontFamily: theme.typography.fontFamilies.regular,
  },
});

export default LanguageSelector; 