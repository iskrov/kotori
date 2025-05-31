import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';
import { AppTheme } from '../config/theme';
import { LanguageOption, SUPPORTED_LANGUAGES, getLanguageName } from '../config/languageConfig';

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
  const [modalVisible, setModalVisible] = React.useState(false);

  const selectedLanguageName = getLanguageName(selectedLanguage) || 'Auto-detect';

  const handleLanguageSelect = (languageCode: string) => {
    onLanguageChange(languageCode);
    setModalVisible(false);
  };

  const renderLanguageItem = ({ item }: { item: LanguageOption }) => (
    <TouchableOpacity
      style={[
        styles.languageItem,
        item.code === selectedLanguage && styles.selectedLanguageItem
      ]}
      onPress={() => handleLanguageSelect(item.code)}
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
        <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.selector, disabled && styles.selectorDisabled]}
        onPress={() => !disabled && setModalVisible(true)}
        disabled={disabled}
      >
        <View style={styles.selectorContent}>
          <Ionicons 
            name="language" 
            size={20} 
            color={disabled ? theme.colors.disabled : theme.colors.primary} 
          />
          <Text style={[
            styles.selectorText,
            disabled && styles.selectorTextDisabled
          ]}>
            {selectedLanguageName}
          </Text>
        </View>
        <Ionicons 
          name="chevron-down" 
          size={16} 
          color={disabled ? theme.colors.disabled : theme.colors.textSecondary} 
        />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Language</Text>
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color={theme.colors.text} />
                </TouchableOpacity>
              </View>
              
              <FlatList
                data={SUPPORTED_LANGUAGES}
                keyExtractor={(item) => item.code}
                renderItem={renderLanguageItem}
                style={styles.languageList}
                showsVerticalScrollIndicator={true}
              />
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
};

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    marginVertical: theme.spacing.sm,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
  selectorText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.regular,
    marginLeft: theme.spacing.sm,
  },
  selectorTextDisabled: {
    color: theme.colors.disabled,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
  },
  modalContent: {
    padding: theme.spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: 'bold',
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.bold,
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
  languageList: {
    maxHeight: 400,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  selectedLanguageItem: {
    backgroundColor: theme.colors.primary + '10',
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamilies.regular,
  },
  selectedLanguageName: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  languageCode: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamilies.regular,
    marginTop: 2,
  },
  selectedLanguageCode: {
    color: theme.colors.primary,
  },
});

export default LanguageSelector; 