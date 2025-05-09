                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LanguageOption } from '../config/languageConfig';

interface LanguageSelectorModalProps {
  visible: boolean;
  languageOptions: LanguageOption[];
  onToggleLanguage: (code: string) => void;
  onClose: () => void;
  onDone: () => void;
  maxSelection: number;
}

const LanguageSelectorModal: React.FC<LanguageSelectorModalProps> = ({
  visible,
  languageOptions,
  onToggleLanguage,
  onClose,
  onDone,
  maxSelection,
}) => {
  const selectedCount = languageOptions.filter(lang => lang.selected === true).length;
  
  const canSelect = (selected: boolean | undefined): boolean => {
    return selected === true || selectedCount < maxSelection;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Languages</Text>
            <TouchableOpacity onPress={onDone}>
              <Ionicons name="checkmark" size={24} color="#7D4CDB" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.modalDescription}>
            Select up to {maxSelection} languages for voice recognition
          </Text>
          <Text style={styles.selectedCountText}>
            {selectedCount} of {maxSelection} selected
          </Text>
          
          <FlatList
            data={languageOptions}
            keyExtractor={(item) => item.code}
            style={styles.languageList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.languageItem}
                onPress={() => canSelect(item.selected) && onToggleLanguage(item.code)}
                disabled={!canSelect(item.selected)}
              >
                <Text 
                  style={[
                    styles.languageName, 
                    !canSelect(item.selected) && styles.disabledText
                  ]}
                >
                  {item.name}
                </Text>
                <View 
                  style={[
                    styles.checkbox, 
                    item.selected === true && styles.checkboxSelected,
                    !canSelect(item.selected) && styles.checkboxDisabled
                  ]}
                >
                  {item.selected === true && (
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  )}
                </View>
              </TouchableOpacity>
            )}
          />
          
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)', // Semi-transparent background
  },
  modalView: {
    width: Platform.OS === 'web' ? '50%' : '90%',
    maxWidth: 400,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  selectedCountText: {
    fontSize: 12,
    color: '#7D4CDB',
    fontWeight: '500',
    marginBottom: 16,
  },
  languageList: {
    marginBottom: 16,
    maxHeight: '70%',
  },
  languageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  languageName: {
    fontSize: 16,
    color: '#333',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#aaa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#7D4CDB',
    borderColor: '#7D4CDB',
  },
  checkboxDisabled: {
    borderColor: '#ddd',
  },
  disabledText: {
    color: '#ccc',
  },
  closeButton: {
    marginTop: 8,
    backgroundColor: '#f2f2f2',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#666',
  },
});

export default LanguageSelectorModal; 