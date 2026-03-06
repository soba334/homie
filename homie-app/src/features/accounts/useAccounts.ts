import { useState, useEffect, useCallback } from 'react';
import { api } from '@/utils/api';
import type { AccountWithBalance, AccountTransaction } from '@/types';

export function useAccounts() {
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAccounts = useCallback(async () => {
    const data = await api.get<AccountWithBalance[]>('/api/v1/accounts');
    setAccounts(data);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchAccounts().catch(() => {}).finally(() => setLoading(false));
  }, [fetchAccounts]);

  const addAccount = useCallback(async (input: {
    name: string;
    type: string;
    initialBalance?: number;
    color?: string;
    billingDate?: number;
    paymentDate?: number;
    paymentAccountId?: string;
    note?: string;
    userId?: string;
  }) => {
    const created = await api.post<AccountWithBalance>('/api/v1/accounts', input);
    setAccounts((prev) => [...prev, created]);
    return created;
  }, []);

  const updateAccount = useCallback(async (id: string, updates: Record<string, unknown>) => {
    const updated = await api.put<AccountWithBalance>(`/api/v1/accounts/${id}`, updates);
    setAccounts((prev) => prev.map((a) => (a.id === id ? updated : a)));
    return updated;
  }, []);

  const deleteAccount = useCallback(async (id: string) => {
    await api.delete(`/api/v1/accounts/${id}`);
    setAccounts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  return { accounts, loading, totalBalance, addAccount, updateAccount, deleteAccount, refetch: fetchAccounts };
}

export function useAccountTransactions(accountId: string, yearMonth?: string) {
  const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = useCallback(async () => {
    const params = yearMonth ? `?year_month=${yearMonth}` : '';
    const data = await api.get<AccountTransaction[]>(`/api/v1/accounts/${accountId}/transactions${params}`);
    setTransactions(data);
  }, [accountId, yearMonth]);

  useEffect(() => {
    setLoading(true);
    fetchTransactions().catch(() => {}).finally(() => setLoading(false));
  }, [fetchTransactions]);

  const addTransaction = useCallback(async (input: {
    amount: number;
    type: string;
    category?: string;
    description?: string;
    date: string;
    transferToAccountId?: string;
    budgetEntryId?: string;
  }) => {
    const created = await api.post<AccountTransaction>(`/api/v1/accounts/${accountId}/transactions`, input);
    setTransactions((prev) => [created, ...prev]);
    return created;
  }, [accountId]);

  const deleteTransaction = useCallback(async (id: string) => {
    await api.delete(`/api/v1/accounts/transactions/${id}`);
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { transactions, loading, addTransaction, deleteTransaction, refetch: fetchTransactions };
}
