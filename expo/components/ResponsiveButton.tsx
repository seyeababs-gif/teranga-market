import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import { getButtonHeight, getButtonFontSize } from '@/constants/responsive';

interface ResponsiveButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export default function ResponsiveButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon,
}: ResponsiveButtonProps) {
  const buttonHeight = getButtonHeight();
  const fontSize = getButtonFontSize();

  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return { backgroundColor: '#1E3A8A', borderColor: '#1E3A8A' };
      case 'secondary':
        return { backgroundColor: '#EFF6FF', borderColor: '#1E3A8A' };
      case 'outline':
        return { backgroundColor: 'transparent', borderColor: '#1E3A8A' };
      case 'danger':
        return { backgroundColor: '#E31B23', borderColor: '#E31B23' };
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case 'primary':
      case 'danger':
        return '#fff';
      case 'secondary':
      case 'outline':
        return '#1E3A8A';
    }
  };

  const variantStyles = getVariantStyles();
  const textColor = getTextColor();

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { height: buttonHeight, ...variantStyles },
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, { fontSize, color: textColor }, textStyle]}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  text: {
    fontWeight: '700' as const,
    letterSpacing: 0.2,
  },
  disabled: {
    opacity: 0.5,
  },
});
