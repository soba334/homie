import { useState, useEffect, useCallback } from 'react';
import { api } from '@/utils/api';
import {
  registerServiceWorker,
  subscribePush,
  unsubscribePush,
  isPushSupported,
  getCurrentSubscription,
} from '@/utils/pushNotification';

interface NotificationPreferences {
  userId: string;
  garbageEnabled: boolean;
  garbageTiming: 'eve' | 'day' | 'both';
  subscriptionEnabled: boolean;
  subscriptionDaysBefore: number;
  updatedAt: string;
}

export function useNotificationSettings() {
  const [supported] = useState(isPushSupported);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    const init = async () => {
      if (!isPushSupported()) {
        setLoading(false);
        return;
      }
      setPermission(Notification.permission);
      const reg = await registerServiceWorker();
      setRegistration(reg);
      if (reg) {
        const sub = await getCurrentSubscription(reg);
        setSubscribed(!!sub);
      }
      try {
        const prefs = await api.get<NotificationPreferences>('/api/v1/push/preferences');
        setPreferences(prefs);
      } catch {
        // use defaults
      }
      setLoading(false);
    };
    init();
  }, []);

  const enableNotifications = useCallback(async () => {
    if (!registration) return false;
    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== 'granted') return false;

    const subscription = await subscribePush(registration);
    if (!subscription) return false;

    const json = subscription.toJSON();
    await api.post('/api/v1/push/subscribe', {
      endpoint: json.endpoint,
      keys: json.keys,
    });
    setSubscribed(true);
    return true;
  }, [registration]);

  const disableNotifications = useCallback(async () => {
    if (!registration) return;
    const subscription = await getCurrentSubscription(registration);
    if (subscription) {
      await api.post('/api/v1/push/unsubscribe', { endpoint: subscription.endpoint });
      await unsubscribePush(registration);
    }
    setSubscribed(false);
  }, [registration]);

  const updatePreferences = useCallback(async (updates: Partial<NotificationPreferences>) => {
    const updated = await api.put<NotificationPreferences>('/api/v1/push/preferences', updates);
    setPreferences(updated);
    return updated;
  }, []);

  return {
    supported,
    permission,
    subscribed,
    preferences,
    loading,
    enableNotifications,
    disableNotifications,
    updatePreferences,
  };
}
