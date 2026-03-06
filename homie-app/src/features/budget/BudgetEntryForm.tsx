import { useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui';
import { useAuth } from '@/features/auth/useAuth';
import { useAccounts } from '@/features/accounts/useAccounts';
import type { BudgetEntry, BudgetVsActual } from '@/types';

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  bank: '銀行',
  credit_card: 'クレカ',
  cash: '現金',
  e_money: '電子マネー',
};

const DEFAULT_CATEGORIES = ['食費', '日用品', '光熱費', '家賃', '交通費', '医療費', '娯楽', 'その他'];

interface Props {
  addEntry: (entry: {
    date: string;
    amount: number;
    category: string;
    description: string;
    paidBy: string;
    accountId?: string;
  }) => Promise<unknown>;
  updateEntry: (id: string, updates: Partial<BudgetEntry>) => Promise<unknown>;
  onSubmit: () => void;
  budgetItems?: BudgetVsActual[];
  initial?: BudgetEntry;
}

export function BudgetEntryForm({ addEntry, updateEntry, onSubmit, budgetItems, initial }: Props) {
  const { user } = useAuth();
  const { accounts } = useAccounts();
  const members = user?.home?.members ?? [];

  const isEdit = !!initial;

  // Merge budget categories with defaults (budget categories first)
  const budgetCategories = budgetItems?.map((b) => b.category) || [];
  const allCategories = [
    ...budgetCategories,
    ...DEFAULT_CATEGORIES.filter((c) => !budgetCategories.includes(c)),
  ];

  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [category, setCategory] = useState(initial?.category || allCategories[0] || DEFAULT_CATEGORIES[0]);
  const [description, setDescription] = useState(initial?.description || '');
  const [paidBy, setPaidBy] = useState(initial?.paidBy || user?.id || '');
  const [accountId, setAccountId] = useState<string>(initial?.accountId || '');
  const [date, setDate] = useState(initial?.date || format(new Date(), 'yyyy-MM-dd'));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedBudget = budgetItems?.find((b) => b.category === category);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseInt(amount, 10);
    if (!num || num <= 0) return;
    setSubmitting(true);
    setError(null);
    try {
      if (isEdit) {
        await updateEntry(initial.id, {
          amount: num,
          category,
          description: description.trim(),
          paidBy,
          date,
          accountId: accountId || undefined,
        });
      } else {
        await addEntry({
          amount: num,
          category,
          description: description.trim(),
          paidBy,
          date,
          accountId: accountId || undefined,
        });
      }
      onSubmit();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${isEdit ? '更新' : '追加'}に失敗しました`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">金額 *</label>
        <div className="relative">
          <input
            type="number"
            className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary pr-8"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="1000"
            required
            min={1}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant">円</span>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">カテゴリ</label>
        <div className="flex flex-wrap gap-2">
          {allCategories.map((cat) => {
            const budget = budgetItems?.find((b) => b.category === cat);
            return (
              <button
                key={cat}
                type="button"
                className={`px-3 py-1.5 rounded-full text-sm cursor-pointer transition-colors
                  ${category === cat ? 'bg-primary text-white' : 'bg-surface-container hover:bg-outline'}`}
                onClick={() => setCategory(cat)}
              >
                {cat}
                {budget && (
                  <span className="ml-1 opacity-75 text-xs">
                    残{budget.remaining.toLocaleString()}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {selectedBudget && (
          <p className={`text-xs mt-1 ${selectedBudget.overBudget ? 'text-red-600' : 'text-on-surface-variant'}`}>
            予算 {selectedBudget.budgetAmount.toLocaleString()}円 / 使用済 {selectedBudget.actualAmount.toLocaleString()}円
            {selectedBudget.overBudget
              ? ` (${Math.abs(selectedBudget.remaining).toLocaleString()}円超過)`
              : ` (残り ${selectedBudget.remaining.toLocaleString()}円)`}
          </p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">支払った人</label>
        <div className="flex gap-2">
          {members.map((m, i) => {
            const colors = [
              { active: 'bg-blue-100 text-blue-700 ring-2 ring-blue-400', inactive: 'bg-surface-container' },
              { active: 'bg-pink-100 text-pink-700 ring-2 ring-pink-400', inactive: 'bg-surface-container' },
            ];
            const color = colors[i % colors.length];
            return (
              <button
                key={m.id}
                type="button"
                className={`flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors
                  ${paidBy === m.id ? color.active : color.inactive}`}
                onClick={() => setPaidBy(m.id)}
              >
                {m.displayName || m.name}{m.id === user?.id ? '（自分）' : ''}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">支払い方法</label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`px-3 py-1.5 rounded-full text-sm cursor-pointer transition-colors
              ${accountId === '' ? 'bg-primary text-white' : 'bg-surface-container hover:bg-outline'}`}
            onClick={() => setAccountId('')}
          >
            指定なし
          </button>
          {accounts.map((acc) => (
            <button
              key={acc.id}
              type="button"
              className={`px-3 py-1.5 rounded-full text-sm cursor-pointer transition-colors
                ${accountId === acc.id ? 'bg-primary text-white' : 'bg-surface-container hover:bg-outline'}`}
              onClick={() => setAccountId(acc.id)}
            >
              {acc.name}
              <span className="ml-1 opacity-60 text-xs">{ACCOUNT_TYPE_LABEL[acc.type] || acc.type}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">日付</label>
        <input
          type="date"
          className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">メモ</label>
        <input
          className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="例: スーパーで買い物"
        />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? `${isEdit ? '更新' : '追加'}中...` : `${isEdit ? '更新する' : '追加する'}`}
      </Button>
    </form>
  );
}
