import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { useToast } from '@/contexts/ToastContext';

export default function GlobalAlert() {
  const { alertConfig, hideAlert } = useToast();

  if (!alertConfig) return null;

  const buttons = alertConfig.buttons;
  const isVertical = buttons.length > 2;

  // Use fixed positioning on web to ensure it covers the viewport regardless of scroll
  const overlayStyle = Platform.select({
    web: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 10000,
      justifyContent: 'center',
      alignItems: 'center',
    } as any,
    default: styles.overlay,
  });

  return (
    <View style={overlayStyle} pointerEvents="auto">
      <View style={styles.backdrop} />
      <View style={styles.alertContainer}>
        <Text style={styles.title}>{alertConfig.title}</Text>
        <Text style={styles.message}>{alertConfig.message}</Text>
        
        <View style={[styles.buttonContainer, isVertical && styles.verticalButtonContainer]}>
          {buttons.map((button, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.button,
                isVertical ? styles.verticalButton : styles.horizontalButton,
                button.style === 'cancel' && styles.cancelButton,
                button.style === 'destructive' && styles.destructiveButton,
                // Add separator logic if needed, but simple margin/border is easier
                !isVertical && index > 0 && styles.borderLeft,
                isVertical && index > 0 && styles.borderTop,
              ]}
              onPress={() => {
                hideAlert();
                if (button.onPress) {
                  // Execute in next tick to allow UI update
                  setTimeout(() => button.onPress?.(), 0);
                }
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.buttonText,
                  button.style === 'cancel' && styles.cancelButtonText,
                  button.style === 'destructive' && styles.destructiveButtonText,
                ]}
              >
                {button.text}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  alertContainer: {
    width: Math.min(Dimensions.get('window').width - 64, 320),
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
    marginTop: 20,
    marginHorizontal: 16,
  },
  message: {
    fontSize: 13,
    color: '#000',
    textAlign: 'center',
    marginHorizontal: 16,
    marginBottom: 20,
    marginTop: 8,
    lineHeight: 18,
  },
  buttonContainer: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#3F3F46', // heavy gray separator like iOS
    backgroundColor: 'rgba(240,240,240,0.5)',
  },
  verticalButtonContainer: {
    flexDirection: 'column',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    minHeight: 44,
  },
  horizontalButton: {
    // flex: 1 already set
  },
  verticalButton: {
    width: '100%',
  },
  borderLeft: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: '#3F3F46',
  },
  borderTop: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#3F3F46',
  },
  buttonText: {
    fontSize: 17,
    color: '#007AFF', // iOS blue
    fontWeight: '400',
  },
  cancelButtonText: {
    fontWeight: '600',
  },
  destructiveButtonText: {
    color: '#FF3B30',
  },
  cancelButton: {
    // Background color change? usually just text weight.
  },
  destructiveButton: {
    
  },
});
