import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react-native';
import { useToast } from '@/contexts/ToastContext';

export default function ToastContainer() {
  const { toasts, hideToast } = useToast();
  const insets = useSafeAreaInsets();

  const containerStyle = useMemo(() => {
    if (Platform.OS === 'web') {
      // @ts-ignore - react-native-web supports fixed position
      return { position: 'fixed', top: 16, left: 16, right: 16, zIndex: 9999, alignItems: 'center', gap: 8 };
    }
    return {
      position: 'absolute',
      top: insets.top + 16,
      left: 16,
      right: 16,
      zIndex: 9999,
      alignItems: 'center',
      gap: 8,
    };
  }, [insets]);

  if (toasts.length === 0) return null;

  const getToastColor = (type: string) => {
    switch (type) {
      case 'success': return '#00A651';
      case 'error': return '#E31B23';
      case 'warning': return '#FFA500';
      case 'info': return '#1E3A8A';
      default: return '#1E3A8A';
    }
  };

  const getToastIcon = (type: string) => {
    const color = '#fff';
    const size = 20;
    switch (type) {
      case 'success': return <CheckCircle size={size} color={color} />;
      case 'error': return <AlertCircle size={size} color={color} />;
      case 'warning': return <AlertTriangle size={size} color={color} />;
      case 'info': return <Info size={size} color={color} />;
      default: return <Info size={size} color={color} />;
    }
  };

  return (
    <View style={containerStyle as any} pointerEvents="box-none">
      {toasts.map((toast) => (
        <Animated.View
          key={toast.id}
          style={[
            styles.toast,
            { backgroundColor: getToastColor(toast.type) }
          ]}
        >
          <View style={styles.iconContainer}>
            {getToastIcon(toast.type)}
          </View>
          <Text style={styles.message}>{toast.message}</Text>
          <TouchableOpacity
            onPress={() => hideToast(toast.id)}
            style={styles.closeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={18} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    width: '100%',
    maxWidth: 500,
    gap: 12,
  },
  iconContainer: {
    flexShrink: 0,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 20,
  },
  closeButton: {
    flexShrink: 0,
    padding: 4,
  },
});
