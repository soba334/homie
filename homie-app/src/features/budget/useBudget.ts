import { useState, useEffect, useCallback } from 'react';
import { api } from '@/utils/api';
import type { BudgetEntry, BudgetSummary } from '@/types';

export function useBudget(yearMonth?: string) {
  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    const params = yearMonth ? `?year_month=${yearMonth}` : '';
    const data = await api.get<BudgetEntry[]>(`/api/v1/budget/entries${params}`);
    setEntries(data);
  }, [yearMonth]);

  const fetchSummary = useCallback(async () => {
    const params = yearMonth ? `?year_month=${yearMonth}` : '';
    const data = await api.get<BudgetSummary>(`/api/v1/budget/summary${params}`);
    setSummary(data);
  }, [yearMonth]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        await Promise.all([fetchEntries(), fetchSummary()]);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [fetchEntries, fetchSummary]);

  const addEntry = useCallback(async (entry: {
    date: string;
    amount: number;
    category: string;
    description: string;
    paidBy: string;
    receiptImageUrl?: string;
    accountId?: string;
  }) => {
    const created = await api.post<BudgetEntry>('/api/v1/budget/entries', entry);
    setEntries((prev) => [created, ...prev]);
    fetchSummary();
  }, [fetchSummary]);

  const updateEntry = useCallback(async (id: string, updates: Partial<BudgetEntry>) => {
    const updated = await api.put<BudgetEntry>(`/api/v1/budget/entries/${id}`, updates);
    setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)));
    fetchSummary();
  }, [fetchSummary]);

  const deleteEntry = useCallback(async (id: string) => {
    await api.delete(`/api/v1/budget/entries/${id}`);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    fetchSummary();
  }, [fetchSummary]);

  return {
    entries,
    loading,
    addEntry,
    updateEntry,
    deleteEntry,
    monthlyTotal: summary?.monthlyTotal ?? 0,
    monthlyByPerson: summary?.byPerson ?? {},
    categorySummary: summary?.byCategory ?? {},
  };
}
