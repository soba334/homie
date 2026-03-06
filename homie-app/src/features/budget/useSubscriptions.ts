import { useState, useEffect, useCallback } from 'react';
import { api } from '@/utils/api';
import type { Subscription } from '@/types';

export function useSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSubscriptions = useCallback(async () => {
    const data = await api.get<Subscription[]>('/api/v1/subscriptions');
    setSubscriptions(data);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchSubscriptions().catch(() => {}).finally(() => setLoading(false));
  }, [fetchSubscriptions]);

  const addSubscription = useCallback(async (input: {
    name: string;
    amount: number;
    category: string;
    paidBy: string;
    accountId?: string;
    billingCycle: string;
    billingDay: number;
    nextBillingDate: string;
    note?: string;
  }) => {
    const created = await api.post<Subscription>('/api/v1/subscriptions', input);
    setSubscriptions((prev) => [...prev, created]);
    return created;
  }, []);

  const updateSubscription = useCallback(async (id: string, updates: Partial<Subscription>) => {
    const updated = await api.put<Subscription>(`/api/v1/subscriptions/${id}`, updates);
    setSubscriptions((prev) => prev.map((s) => (s.id === id ? updated : s)));
    return updated;
  }, []);

  const deleteSubscription = useCallback(async (id: string) => {
    await api.delete(`/api/v1/subscriptions/${id}`);
    setSubscriptions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const monthlyTotal = subscriptions
    .filter((s) => s.isActive)
    .reduce((sum, s) => {
      if (s.billingCycle === 'yearly') return sum + s.amount / 12;
      if (s.billingCycle === 'weekly') return sum + s.amount * 4.33;
      return sum + s.amount;
    }, 0);

  return {
    subscriptions,
    loading,
    monthlyTotal,
    addSubscription,
    updateSubscription,
    deleteSubscription,
    refetch: fetchSubscriptions,
  };
}
