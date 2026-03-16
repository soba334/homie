import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/utils/api';
import { queryKeys } from '@/lib/queryKeys';
import { BudgetVsActualListSchema } from '@/lib/schemas';
import type { MonthlyBudget } from '@/lib/schemas';

export function useMonthlyBudgets(yearMonth: string) {
  const queryClient = useQueryClient();

  const budgetsQuery = useQuery({
    queryKey: queryKeys.monthlyBudgets.list(yearMonth),
    queryFn: () =>
      api.getWithSchema(
        `/api/v1/budgets/monthly?year_month=${yearMonth}`,
        BudgetVsActualListSchema,
      ),
  });

  const upsertBudgetMutation = useMutation({
    mutationFn: (input: { category: string; amount: number; yearMonth: string }) =>
      api.post<MonthlyBudget>('/api/v1/budgets/monthly', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.monthlyBudgets.all });
    },
  });

  const deleteBudgetMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/budgets/monthly/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.monthlyBudgets.all });
    },
  });

  const budgets = budgetsQuery.data ?? [];
  const loading = budgetsQuery.isLoading;

  return {
    budgets,
    loading,
    upsertBudget: (input: { category: string; amount: number; yearMonth: string }) =>
      upsertBudgetMutation.mutateAsync(input),
    deleteBudget: (id: string) => deleteBudgetMutation.mutateAsync(id),
    refetch: () => budgetsQuery.refetch(),
  };
}
