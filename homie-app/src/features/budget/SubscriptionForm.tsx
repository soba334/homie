import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarSync } from 'lucide-react';
import { Button } from '@/components/ui';
import { useAuth } from '@/features/auth/useAuth';
import { useAccounts } from '@/features/accounts/useAccounts';
import { useGoogleCalendar } from '@/features/calendar/google';
import type { Subscription } from '@/types';

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  bank: '銀行',
  credit_card: 'クレカ',
  cash: '現金',
  e_money: '電子マネー',
};

const DEFAULT_CATEGORIES = ['食費', '日用品', '光熱費', '家賃', '交通費', '医療費', '娯楽', 'サブスク', 'その他'];

const BILLING_CYCLES = [
  { value: 'monthly', label: '毎月' },
  { value: 'yearly', label: '毎年' },
  { value: 'weekly', label: '毎週' },
];

interface Props {
  addSubscription: (input: {
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
  }) => Promise<unknown>;
  updateSubscription: (id: string, updates: Partial<Subscription>) => Promise<unknown>;
  onSubmit: () => void;
  initial?: Subscription;
}

export function SubscriptionForm({ addSubscription, updateSubscription, onSubmit, initial }: Props) {
  const { user } = useAuth();
  const { accounts } = useAccounts();
  const { isConnected: googleConnected } = useGoogleCalendar();
  const members = user?.home?.members ?? [];

  const isEdit = !!initial;

  const [name, setName] = useState(initial?.name || '');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [category, setCategory] = useState(initial?.category || 'サブスク');
  const [paidBy, setPaidBy] = useState(initial?.paidBy || user?.id || '');
  const [accountId, setAccountId] = useState<string>(initial?.accountId || '');
  const [billingCycle, setBillingCycle] = useState<string>(initial?.billingCycle || 'monthly');
  const [billingDay, setBillingDay] = useState(initial ? String(initial.billingDay) : '1');
  const [nextBillingDate, setNextBillingDate] = useState(
    initial?.nextBillingDate || format(new Date(), 'yyyy-MM-dd')
  );
  const [note, setNote] = useState(initial?.note || '');
  const [syncToCalendar, setSyncToCalendar] = useState(initial?.syncToCalendar ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseInt(amount, 10);
    if (!num || num <= 0 || !name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      if (isEdit) {
        await updateSubscription(initial.id, {
          name: name.trim(),
          amount: num,
          category,
          paidBy,
          accountId: accountId || undefined,
          billingCycle: billingCycle as 'monthly' | 'yearly' | 'weekly',
          billingDay: parseInt(billingDay, 10),
          nextBillingDate,
          note: note.trim() || undefined,
          syncToCalendar,
        });
      } else {
        await addSubscription({
          name: name.trim(),
          amount: num,
          category,
          paidBy,
          accountId: accountId || undefined,
          billingCycle,
          billingDay: parseInt(billingDay, 10),
          nextBillingDate,
          note: note.trim() || undefined,
          syncToCalendar,
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
        <label className="block text-sm font-medium mb-1">サービス名 *</label>
        <input
          className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: Netflix, Spotify"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">金額 *</label>
        <div className="relative">
          <input
            type="number"
            className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary pr-8"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="980"
            required
            min={1}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant">円</span>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">請求サイクル</label>
        <div className="flex gap-2">
          {BILLING_CYCLES.map((c) => (
            <button
              key={c.value}
              type="button"
              className={`flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors
                ${billingCycle === c.value ? 'bg-primary text-white' : 'bg-surface-container hover:bg-outline'}`}
              onClick={() => setBillingCycle(c.value)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">
          {billingCycle === 'weekly' ? '曜日（0=日〜6=土）' : '請求日'}
        </label>
        <input
          type="number"
          className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          value={billingDay}
          onChange={(e) => setBillingDay(e.target.value)}
          min={billingCycle === 'weekly' ? 0 : 1}
          max={billingCycle === 'weekly' ? 6 : 31}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">次回請求日</label>
        <input
          type="date"
          className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          value={nextBillingDate}
          onChange={(e) => setNextBillingDate(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">カテゴリ</label>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`px-3 py-1.5 rounded-full text-sm cursor-pointer transition-colors
                ${category === cat ? 'bg-primary text-white' : 'bg-surface-container hover:bg-outline'}`}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">支払う人</label>
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
        <label className="block text-sm font-medium mb-1">メモ</label>
        <input
          className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="例: ファミリープラン"
        />
      </div>
      {googleConnected && (
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium flex items-center gap-2">
            <CalendarSync size={16} />
            Googleカレンダーに同期
          </label>
          <button
            type="button"
            className={`relative w-11 h-6 rounded-full cursor-pointer transition-colors ${
              syncToCalendar ? 'bg-primary' : 'bg-outline'
            }`}
            onClick={() => setSyncToCalendar(!syncToCalendar)}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                syncToCalendar ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? `${isEdit ? '更新' : '登録'}中...` : `${isEdit ? '更新する' : '登録する'}`}
      </Button>
    </form>
  );
}
