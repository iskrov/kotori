import React from 'react';
import { Switch, ViewStyle } from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';
import SettingsRow from './SettingsRow';
import { Ionicons } from '@expo/vector-icons';

interface SettingsToggleProps {
  title: string;
  subtitle?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
}

const SettingsToggle: React.FC<SettingsToggleProps> = ({
  title,
  subtitle,
  leftIcon,
  value,
  onValueChange,
  disabled = false,
  style,
  testID,
}) => {
  const { theme } = useAppTheme();

  const handleToggle = () => {
    if (!disabled) {
      onValueChange(!value);
    }
  };

  const switchElement = (
    <Switch
      trackColor={{ 
        false: theme.colors.border, // Softer inactive track
        true: theme.colors.chipBackground // Light teal for active track
      }}
      thumbColor={value ? theme.colors.primary : theme.colors.white} // Teal thumb when active
      ios_backgroundColor={theme.colors.border}
      onValueChange={onValueChange}
      value={value}
      disabled={disabled}
      accessibilityLabel={`${title} toggle`}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    />
  );

  return (
    <SettingsRow
      title={title}
      subtitle={subtitle}
      leftIcon={leftIcon}
      rightElement={switchElement}
      onPress={handleToggle}
      disabled={disabled}
      style={style}
      testID={testID}
    />
  );
};

export default SettingsToggle; 