import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/utils/api';
import { queryKeys } from '@/lib/queryKeys';
import {
  AccountWithBalanceListSchema,
  AccountWithBalanceSchema,
  AccountTransactionListSchema,
  AccountTransactionSchema,
} from '@/lib/schemas';
import type { AccountWithBalance, AccountTransaction } from '@/lib/schemas';

export function useAccounts() {
  const queryClient = useQueryClient();

  const accountsQuery = useQuery({
    queryKey: queryKeys.accounts.list(),
    queryFn: () => api.getWithSchema('/api/v1/accounts', AccountWithBalanceListSchema),
  });

  const addAccountMutation = useMutation({
    mutationFn: (input: {
      name: string;
      type: string;
      initialBalance?: number;
      color?: string;
      billingDate?: number;
      paymentDate?: number;
      paymentAccountId?: string;
      note?: string;
      userId?: string;
    }) => api.postWithSchema('/api/v1/accounts', AccountWithBalanceSchema, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
    },
  });

  const updateAccountMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, unknown> }) =>
      api.putWithSchema(`/api/v1/accounts/${id}`, AccountWithBalanceSchema, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/accounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
    },
  });

  const accounts = accountsQuery.data ?? [];
  const loading = accountsQuery.isLoading;
  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  return {
    accounts,
    loading,
    totalBalance,
    addAccount: (input: Parameters<typeof addAccountMutation.mutateAsync>[0]) =>
      addAccountMutation.mutateAsync(input),
    updateAccount: (id: string, updates: Record<string, unknown>) =>
      updateAccountMutation.mutateAsync({ id, updates }),
    deleteAccount: (id: string) => deleteAccountMutation.mutateAsync(id),
    refetch: () => accountsQuery.refetch(),
  };
}

export function useAccountTransactions(accountId: string, yearMonth?: string) {
  const queryClient = useQueryClient();

  const params = yearMonth ? `?year_month=${yearMonth}` : '';

  const transactionsQuery = useQuery({
    queryKey: queryKeys.accounts.transactions(accountId, yearMonth),
    queryFn: () =>
      api.getWithSchema(
        `/api/v1/accounts/${accountId}/transactions${params}`,
        AccountTransactionListSchema,
      ),
  });

  const addTransactionMutation = useMutation({
    mutationFn: (input: {
      amount: number;
      type: string;
      category?: string;
      description?: string;
      date: string;
      transferToAccountId?: string;
      budgetEntryId?: string;
    }) =>
      api.postWithSchema(
        `/api/v1/accounts/${accountId}/transactions`,
        AccountTransactionSchema,
        input,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
    },
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/accounts/transactions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
    },
  });

  const transactions = transactionsQuery.data ?? [];
  const loading = transactionsQuery.isLoading;

  return {
    transactions,
    loading,
    addTransaction: (input: Parameters<typeof addTransactionMutation.mutateAsync>[0]) =>
      addTransactionMutation.mutateAsync(input),
    deleteTransaction: (id: string) => deleteTransactionMutation.mutateAsync(id),
    refetch: () => transactionsQuery.refetch(),
  };
}
