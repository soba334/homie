import { useState, useEffect, useCallback } from 'react';
import { api } from '@/utils/api';
import type { SavingsGoalWithProgress } from '@/types';

export function useSavings() {
  const [goals, setGoals] = useState<SavingsGoalWithProgress[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<SavingsGoalWithProgress[]>('/api/v1/savings');
      setGoals(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const addGoal = useCallback(async (input: {
    name: string;
    targetAmount: number;
    currentAmount?: number;
    targetDate?: string;
    accountId?: string;
    note?: string;
  }) => {
    const created = await api.post<SavingsGoalWithProgress>('/api/v1/savings', input);
    setGoals((prev) => [...prev, created]);
    return created;
  }, []);

  const updateGoal = useCallback(async (id: string, updates: Record<string, unknown>) => {
    const updated = await api.put<SavingsGoalWithProgress>(`/api/v1/savings/${id}`, updates);
    setGoals((prev) => prev.map((g) => (g.id === id ? updated : g)));
    return updated;
  }, []);

  const deleteGoal = useCallback(async (id: string) => {
    await api.delete(`/api/v1/savings/${id}`);
    setGoals((prev) => prev.filter((g) => g.id !== id));
  }, []);

  return { goals, loading, addGoal, updateGoal, deleteGoal };
}
