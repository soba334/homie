import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/utils/api';
import { queryKeys } from '@/lib/queryKeys';
import { NotificationPreferencesSchema } from '@/lib/schemas';
import {
  registerServiceWorker,
  subscribePush,
  unsubscribePush,
  isPushSupported,
  getCurrentSubscription,
} from '@/utils/pushNotification';

export function useNotificationSettings() {
  const queryClient = useQueryClient();
  const [supported] = useState(isPushSupported);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    const init = async () => {
      if (!isPushSupported()) return;
      setPermission(Notification.permission);
      const reg = await registerServiceWorker();
      setRegistration(reg);
      if (reg) {
        const sub = await getCurrentSubscription(reg);
        setSubscribed(!!sub);
      }
    };
    init();
  }, []);

  const preferencesQuery = useQuery({
    queryKey: queryKeys.notifications.preferences(),
    queryFn: () => api.getWithSchema('/api/v1/push/preferences', NotificationPreferencesSchema),
    enabled: isPushSupported(),
  });

  const preferences = preferencesQuery.data ?? null;
  const loading = preferencesQuery.isLoading;

  const enableMutation = useMutation({
    mutationFn: async () => {
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
    },
  });

  const disableMutation = useMutation({
    mutationFn: async () => {
      if (!registration) return;
      const subscription = await getCurrentSubscription(registration);
      if (subscription) {
        await api.post('/api/v1/push/unsubscribe', { endpoint: subscription.endpoint });
        await unsubscribePush(registration);
      }
      setSubscribed(false);
    },
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: (updates: Partial<{
      userId: string;
      garbageEnabled: boolean;
      garbageTiming: 'eve' | 'day' | 'both';
      subscriptionEnabled: boolean;
      subscriptionDaysBefore: number;
      updatedAt: string;
    }>) => api.putWithSchema('/api/v1/push/preferences', NotificationPreferencesSchema, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.preferences() });
    },
  });

  const enableNotifications = useCallback(async () => {
    return enableMutation.mutateAsync();
  }, [enableMutation]);

  const disableNotifications = useCallback(async () => {
    await disableMutation.mutateAsync();
  }, [disableMutation]);

  const updatePreferences = useCallback(async (updates: Partial<{
    userId: string;
    garbageEnabled: boolean;
    garbageTiming: 'eve' | 'day' | 'both';
    subscriptionEnabled: boolean;
    subscriptionDaysBefore: number;
    updatedAt: string;
  }>) => {
    return updatePreferencesMutation.mutateAsync(updates);
  }, [updatePreferencesMutation]);

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
