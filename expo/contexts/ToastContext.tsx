import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useMemo } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'cancel' | 'destructive' | 'default';
}

export interface AlertConfig {
  title: string;
  message: string;
  buttons: AlertButton[];
}

interface ShowToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
}

export const [ToastProvider, useToast] = createContextHook(() => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [alertConfig, setAlertConfig] = useState<AlertConfig | null>(null);

  const showToast = useCallback(({ message, type = 'info', duration = 3000 }: ShowToastOptions) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newToast: Toast = { id, message, type, duration };
    setToasts(prev => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
  }, []);

  const showSuccess = useCallback((message: string, duration?: number) => {
    showToast({ message, type: 'success', duration });
  }, [showToast]);

  const showError = useCallback((message: string, duration?: number) => {
    showToast({ message, type: 'error', duration });
  }, [showToast]);

  const showInfo = useCallback((message: string, duration?: number) => {
    showToast({ message, type: 'info', duration });
  }, [showToast]);

  const showWarning = useCallback((message: string, duration?: number) => {
    showToast({ message, type: 'warning', duration });
  }, [showToast]);

  const showAlert = useCallback((title: string, message: string, buttons?: AlertButton[]) => {
    const alertButtons = buttons && buttons.length > 0 ? buttons : [{ text: 'OK', style: 'default' } as AlertButton];
    setAlertConfig({ title, message, buttons: alertButtons });
  }, []);

  const hideAlert = useCallback(() => {
    setAlertConfig(null);
  }, []);

  const hideToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const hideAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return useMemo(() => ({
    toasts,
    alertConfig,
    showToast,
    showSuccess,
    showError,
    showInfo,
    showWarning,
    showAlert,
    hideAlert,
    hideToast,
    hideAllToasts,
  }), [toasts, alertConfig, showToast, showSuccess, showError, showInfo, showWarning, showAlert, hideAlert, hideToast, hideAllToasts]);
});
