import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Notification } from '@/types/marketplace';
import { supabase } from '@/lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const [NotificationProvider, useNotifications] = createContextHook(() => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  const registerForPushNotifications = useCallback(async (userId: string) => {
    if (Platform.OS === 'web') {
      console.log('Push notifications are not supported on web');
      return;
    }

    try {
      const permissionResult = await Notifications.getPermissionsAsync();
      let finalStatus = permissionResult.status;
      
      if (permissionResult.status !== 'granted') {
        const requestResult = await Notifications.requestPermissionsAsync();
        finalStatus = requestResult.status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return;
      }
      
      const tokenData = await Notifications.getExpoPushTokenAsync();
      const token = tokenData.data;
      
      setExpoPushToken(token);

      const { data: existingTable } = await supabase
        .from('expo_push_tokens')
        .select('id')
        .limit(1);

      if (existingTable === null) {
        console.log('Table expo_push_tokens does not exist, skipping token save');
        return;
      }

      const { error } = await supabase
        .from('expo_push_tokens')
        .upsert({
          id: `token-${userId}-${Date.now()}`,
          user_id: userId,
          token: token,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'token',
        });
      
      if (error) {
        console.error('Error saving push token:', error.message);
      }
    } catch (error: any) {
      console.error('Error registering for push notifications:', error?.message || String(error));
    }
  }, []);

  const loadNotifications = useCallback(async (userId: string) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) {
        console.error('Error loading notifications:', error);
        return;
      }
      
      if (data) {
        const mappedNotifications: Notification[] = data.map((n: any) => ({
          id: n.id,
          userId: n.user_id,
          type: n.type,
          title: n.title,
          message: n.message,
          data: n.data,
          isRead: n.is_read,
          createdAt: new Date(n.created_at),
        }));
        setNotifications(mappedNotifications);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
      
      if (error) {
        console.error('Error marking notification as read:', error);
        return;
      }
      
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, []);

  const markAllAsRead = useCallback(async (userId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);
      
      if (error) {
        console.error('Error marking all notifications as read:', error);
        return;
      }
      
      setNotifications(prev =>
        prev.map(n => ({ ...n, isRead: true }))
      );
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }, []);

  const sendNotification = useCallback(async (
    userId: string,
    notification: {
      type: Notification['type'];
      title: string;
      message: string;
      data?: any;
    }
  ) => {
    try {
      const newNotification = {
        id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        user_id: userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        is_read: false,
      };

      const { error } = await supabase
        .from('notifications')
        .insert([newNotification]);
      
      if (error) {
        console.error('Error sending notification:', error);
        return;
      }

      const { data: tokenData } = await supabase
        .from('expo_push_tokens')
        .select('token')
        .eq('user_id', userId);
      
      if (tokenData && tokenData.length > 0 && Platform.OS !== 'web') {
        for (const { token } of tokenData) {
          try {
            await fetch('https://exp.host/--/api/v2/push/send', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                to: token,
                sound: 'default',
                title: notification.title,
                body: notification.message,
                data: notification.data,
              }),
            });
          } catch (pushError) {
            console.error('Error sending push notification:', pushError);
          }
        }
      }
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }, []);

  const sendNotificationToAdmins = useCallback(async (notification: {
    type: Notification['type'];
    title: string;
    message: string;
    data?: any;
  }) => {
    try {
      const { data: admins, error } = await supabase
        .from('users')
        .select('id')
        .eq('is_admin', true);
      
      if (error) {
        console.error('Error fetching admins:', error);
        return;
      }
      
      if (admins && admins.length > 0) {
        for (const admin of admins) {
          await sendNotification(admin.id, notification);
        }
      }
    } catch (error) {
      console.error('Error sending notification to admins:', error);
    }
  }, [sendNotification]);

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.isRead).length;
  }, [notifications]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  return useMemo(() => ({
    notifications,
    isLoading,
    unreadCount,
    expoPushToken,
    registerForPushNotifications,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    sendNotification,
    sendNotificationToAdmins,
  }), [
    notifications,
    isLoading,
    unreadCount,
    expoPushToken,
    registerForPushNotifications,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    sendNotification,
    sendNotificationToAdmins,
  ]);
});
