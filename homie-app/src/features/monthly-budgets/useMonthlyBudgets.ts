import { useState, useEffect, useCallback } from 'react';
import { api } from '@/utils/api';
import type { BudgetVsActual, MonthlyBudget } from '@/types';

export function useMonthlyBudgets(yearMonth: string) {
  const [budgets, setBudgets] = useState<BudgetVsActual[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBudgets = useCallback(async () => {
    const data = await api.get<BudgetVsActual[]>(`/api/v1/budgets/monthly?year_month=${yearMonth}`);
    setBudgets(data);
  }, [yearMonth]);

  useEffect(() => {
    setLoading(true);
    fetchBudgets().catch(() => {}).finally(() => setLoading(false));
  }, [fetchBudgets]);

  const upsertBudget = useCallback(async (input: { category: string; amount: number; yearMonth: string }) => {
    await api.post<MonthlyBudget>('/api/v1/budgets/monthly', input);
    fetchBudgets();
  }, [fetchBudgets]);

  const deleteBudget = useCallback(async (id: string) => {
    await api.delete(`/api/v1/budgets/monthly/${id}`);
    setBudgets((prev) => prev.filter((b) => b.category !== id));
    fetchBudgets();
  }, [fetchBudgets]);

  return { budgets, loading, upsertBudget, deleteBudget, refetch: fetchBudgets };
}
