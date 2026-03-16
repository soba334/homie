import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api } from '@/utils/api';
import { queryKeys } from '@/lib/queryKeys';
import {
  SubscriptionListSchema,
  SubscriptionSchema,
} from '@/lib/schemas';
import type { Subscription } from '@/lib/schemas';

export function useSubscriptions() {
  const queryClient = useQueryClient();

  const subscriptionsQuery = useQuery({
    queryKey: queryKeys.subscriptions.list(),
    queryFn: () => api.getWithSchema('/api/v1/subscriptions', SubscriptionListSchema),
  });

  const addSubscriptionMutation = useMutation({
    mutationFn: (input: {
      name: string;
      amount: number;
      category: string;
      paidBy: string;
      accountId?: string;
      billingCycle: string;
      billingDay: number;
      nextBillingDate: string;
      note?: string;
      syncToCalendar?: boolean;
    }) => api.postWithSchema('/api/v1/subscriptions', SubscriptionSchema, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all });
    },
  });

  const updateSubscriptionMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Subscription> }) =>
      api.putWithSchema(`/api/v1/subscriptions/${id}`, SubscriptionSchema, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all });
    },
  });

  const deleteSubscriptionMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/subscriptions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all });
    },
  });

  const subscriptions = useMemo(() => subscriptionsQuery.data ?? [], [subscriptionsQuery.data]);
  const loading = subscriptionsQuery.isLoading;

  const monthlyTotal = useMemo(
    () =>
      subscriptions
        .filter((s) => s.isActive)
        .reduce((sum, s) => {
          if (s.billingCycle === 'yearly') return sum + s.amount / 12;
          if (s.billingCycle === 'weekly') return sum + s.amount * 4.33;
          return sum + s.amount;
        }, 0),
    [subscriptions],
  );

  return {
    subscriptions,
    loading,
    monthlyTotal,
    addSubscription: (input: Parameters<typeof addSubscriptionMutation.mutateAsync>[0]) =>
      addSubscriptionMutation.mutateAsync(input),
    updateSubscription: (id: string, updates: Partial<Subscription>) =>
      updateSubscriptionMutation.mutateAsync({ id, updates }),
    deleteSubscription: (id: string) => deleteSubscriptionMutation.mutateAsync(id),
    refetch: () => subscriptionsQuery.refetch(),
  };
}
