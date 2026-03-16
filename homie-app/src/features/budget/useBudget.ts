import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/utils/api';
import { queryKeys } from '@/lib/queryKeys';
import {
  BudgetEntryListSchema,
  BudgetSummarySchema,
  BudgetEntrySchema,
} from '@/lib/schemas';
import type { BudgetEntry } from '@/lib/schemas';

export function useBudget(yearMonth?: string) {
  const queryClient = useQueryClient();

  const params = yearMonth ? `?year_month=${yearMonth}` : '';

  const entriesQuery = useQuery({
    queryKey: queryKeys.budget.entries(yearMonth),
    queryFn: () => api.getWithSchema(`/api/v1/budget/entries${params}`, BudgetEntryListSchema),
  });

  const summaryQuery = useQuery({
    queryKey: queryKeys.budget.summary(yearMonth),
    queryFn: () => api.getWithSchema(`/api/v1/budget/summary${params}`, BudgetSummarySchema),
  });

  const addEntryMutation = useMutation({
    mutationFn: (entry: {
      date: string;
      amount: number;
      category: string;
      description: string;
      paidBy: string;
      receiptImageUrl?: string;
      accountId?: string;
    }) => api.postWithSchema('/api/v1/budget/entries', BudgetEntrySchema, entry),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budget.all });
    },
  });

  const updateEntryMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<BudgetEntry> }) =>
      api.putWithSchema(`/api/v1/budget/entries/${id}`, BudgetEntrySchema, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budget.all });
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/budget/entries/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budget.all });
    },
  });

  const entries = entriesQuery.data ?? [];
  const summary = summaryQuery.data ?? null;
  const loading = entriesQuery.isLoading || summaryQuery.isLoading;

  return {
    entries,
    loading,
    addEntry: (entry: Parameters<typeof addEntryMutation.mutateAsync>[0]) =>
      addEntryMutation.mutateAsync(entry),
    updateEntry: (id: string, updates: Partial<BudgetEntry>) =>
      updateEntryMutation.mutateAsync({ id, updates }),
    deleteEntry: (id: string) => deleteEntryMutation.mutateAsync(id),
    monthlyTotal: summary?.monthlyTotal ?? 0,
    monthlyByPerson: summary?.byPerson ?? {},
    categorySummary: summary?.byCategory ?? {},
  };
}
