import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { api } from '@/utils/api';
import { queryKeys } from '@/lib/queryKeys';
import {
  SavingsGoalWithProgressListSchema,
  SavingsGoalWithProgressSchema,
} from '@/lib/schemas';
import type { SavingsGoalWithProgress } from '@/lib/schemas';

export function useSavings() {
  const queryClient = useQueryClient();

  const goalsQuery = useQuery({
    queryKey: queryKeys.savings.list(),
    queryFn: () => api.getWithSchema('/api/v1/savings', SavingsGoalWithProgressListSchema),
  });

  const goals = goalsQuery.data ?? [];
  const loading = goalsQuery.isLoading;

  const addGoalMutation = useMutation({
    mutationFn: (input: {
      name: string;
      targetAmount: number;
      currentAmount?: number;
      targetDate?: string;
      accountId?: string;
      note?: string;
    }) => api.postWithSchema('/api/v1/savings', SavingsGoalWithProgressSchema, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savings.all });
    },
  });

  const updateGoalMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, unknown> }) =>
      api.putWithSchema(`/api/v1/savings/${id}`, SavingsGoalWithProgressSchema, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savings.all });
    },
  });

  const deleteGoalMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/savings/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savings.all });
    },
  });

  const addGoal = useCallback(async (input: {
    name: string;
    targetAmount: number;
    currentAmount?: number;
    targetDate?: string;
    accountId?: string;
    note?: string;
  }) => {
    return addGoalMutation.mutateAsync(input);
  }, [addGoalMutation]);

  const updateGoal = useCallback(async (id: string, updates: Record<string, unknown>) => {
    return updateGoalMutation.mutateAsync({ id, updates });
  }, [updateGoalMutation]);

  const deleteGoal = useCallback(async (id: string) => {
    await deleteGoalMutation.mutateAsync(id);
  }, [deleteGoalMutation]);

  return { goals, loading, addGoal, updateGoal, deleteGoal };
}
