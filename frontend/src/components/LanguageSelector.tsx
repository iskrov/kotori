import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SectionList,
  TextInput,
  Modal,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';
import { AppTheme } from '../config/theme';
import { LanguageOption, SUPPORTED_LANGUAGES, POPULAR_LANGUAGES, getLanguageName } from '../config/languageConfig';

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

  const selectedLanguageName = getLanguageName(selectedLanguage) || 'Auto-detect';

  // Filter languages based on search query and organize by sections
  const getFilteredSections = () => {
    const query = searchQuery.trim().toLowerCase();
    
    if (!query) {
      // No search - show sections: Popular and All Languages
      const popularLanguages = POPULAR_LANGUAGES;
      const otherLanguages = SUPPORTED_LANGUAGES.filter(lang => !lang.popular);
      
      return [
        {
          title: 'Popular Languages',
          data: popularLanguages,
        },
        {
          title: 'All Languages',
          data: otherLanguages.sort((a, b) => a.name.localeCompare(b.name)),
        }
      ];
    }
    
    // With search - filter all languages and show in single section
    const filtered = SUPPORTED_LANGUAGES.filter(language => {
      return (
        language.name.toLowerCase().includes(query) ||
        language.code.toLowerCase().includes(query) ||
        (language.region && language.region.toLowerCase().includes(query))
      );
    });
    
    // Sort filtered results: popular first, then alphabetical
    const sortedFiltered = filtered.sort((a, b) => {
      if (a.popular && !b.popular) return -1;
      if (!a.popular && b.popular) return 1;
      return a.name.localeCompare(b.name);
    });
    
    if (filtered.length === 0) {
      return [];
    }
    
    return [{
      title: `${filtered.length} ${filtered.length === 1 ? 'language' : 'languages'} found`,
      data: sortedFiltered,
    }];
  };

  const languageSections = getFilteredSections();
  
  // Debug logging for development
  if (__DEV__ && searchQuery.trim()) {
    console.log('[LanguageSelector] Search query:', searchQuery);
    console.log('[LanguageSelector] Sections:', languageSections.map(s => ({ title: s.title, count: s.data.length })));
  }

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
        </Text>
        <Text style={[
          styles.languageCode,
          item.code === selectedLanguage && styles.selectedLanguageCode
        ]}>
          {item.code}
        </Text>
      </View>
      {item.code === selectedLanguage && (
        <View style={styles.checkmarkContainer}>
          <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary} />
        </View>
      )}
    </TouchableOpacity>
  );

  const renderSectionHeader = ({ section: { title } }: { section: { title: string } }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="search-outline" size={48} color={theme.colors.textDisabled} />
      <Text style={styles.emptyStateText}>No languages found</Text>
      <Text style={styles.emptyStateSubtext}>Try a different search term</Text>
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
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.selectorLabel}>Language</Text>
            <Text style={[
              styles.selectorText,
              disabled && styles.selectorTextDisabled
            ]}>
              {selectedLanguageName}
            </Text>
          </View>
          <Ionicons 
            name="chevron-down" 
            size={20} 
            color={disabled ? theme.colors.disabled : theme.colors.textSecondary} 
          />
        </View>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleCloseSelector}
      >
        <SafeAreaView style={styles.modalContainer}>
          <StatusBar barStyle={theme.colors.text === '#FFFFFF' ? 'light-content' : 'dark-content'} />
          
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleCloseSelector}
              accessibilityLabel="Close language selector"
              accessibilityRole="button"
            >
              <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            
            <View style={styles.headerContent}>
              <Text style={styles.modalTitle}>Select Language</Text>
              <Text style={styles.modalSubtitle}>Choose your preferred language for voice transcription</Text>
            </View>
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <View style={styles.searchInputWrapper}>
              <Ionicons 
                name="search" 
                size={20} 
                color={theme.colors.textSecondary} 
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search languages..."
                placeholderTextColor={theme.colors.textSecondary}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  style={styles.clearButton}
                  accessibilityLabel="Clear search"
                >
                  <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Language List */}
          {searchQuery.trim() ? (
            // Use FlatList for search results (single section)
            <FlatList
              data={languageSections[0]?.data || []}
              keyExtractor={(item) => item.code}
              renderItem={renderLanguageItem}
              style={styles.languageList}
              showsVerticalScrollIndicator={true}
              ListEmptyComponent={renderEmptyState}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={20}
              maxToRenderPerBatch={20}
              windowSize={21}
              ListHeaderComponent={() => (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionHeaderText}>
                    {languageSections[0]?.title || 'No results'}
                  </Text>
                </View>
              )}
            />
          ) : (
            // Use SectionList for no search (multiple sections)
            <SectionList
              sections={languageSections}
              keyExtractor={(item) => item.code}
              renderItem={renderLanguageItem}
              renderSectionHeader={renderSectionHeader}
              style={styles.languageList}
              showsVerticalScrollIndicator={true}
              ListEmptyComponent={renderEmptyState}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={20}
              maxToRenderPerBatch={20}
              windowSize={21}
              stickySectionHeadersEnabled={true}
            />
          )}
        </SafeAreaView>
      </Modal>
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
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  backButton: {
    padding: theme.spacing.sm,
    marginRight: theme.spacing.md,
  },
  headerContent: {
    flex: 1,
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
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface,
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
    backgroundColor: theme.colors.background,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    minHeight: 64,
  },
  selectedLanguageItem: {
    backgroundColor: theme.colors.primaryLight + '20',
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
  sectionHeader: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sectionHeaderText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default LanguageSelector; 