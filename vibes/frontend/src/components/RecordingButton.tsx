import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface RecordingButtonProps {
  isRecording: boolean;
  onPress: () => void;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  style?: ViewStyle;
}

const RecordingButton: React.FC<RecordingButtonProps> = ({
  isRecording,
  onPress,
  disabled = false,
  size = 'medium',
  style,
}) => {
  // Determine size values based on the size prop
  const getSize = (): { buttonSize: number; iconSize: number } => {
    switch (size) {
      case 'small':
        return { buttonSize: 50, iconSize: 24 };
      case 'large':
        return { buttonSize: 100, iconSize: 48 };
      case 'medium':
      default:
        return { buttonSize: 80, iconSize: 36 };
    }
  };

  const { buttonSize, iconSize } = getSize();

  return (
    <TouchableOpacity
      style={[
        styles.recordButton,
        { width: buttonSize, height: buttonSize, borderRadius: buttonSize / 2 },
        isRecording ? styles.recordingActive : null,
        disabled ? styles.recordButtonDisabled : null,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Ionicons
        name={isRecording ? 'stop' : 'mic'}
        size={iconSize}
        color="#fff"
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  recordButton: {
    backgroundColor: '#7D4CDB',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  recordingActive: {
    backgroundColor: '#dc3545', // Red when recording
  },
  recordButtonDisabled: {
    backgroundColor: '#cccccc',
  },
});

export default RecordingButton; 