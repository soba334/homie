import { useState } from 'react';
import { Landmark, Plus, Trash2 } from 'lucide-react';
import { Card, Button, Modal, Spinner, useToast } from '@/components/ui';
import { useAccounts, useAccountTransactions } from './useAccounts';
import { useAuth } from '@/features/auth/useAuth';
import { format } from 'date-fns';

const ACCOUNT_TYPES = [
  { value: 'bank', label: '銀行' },
  { value: 'credit_card', label: 'クレカ' },
  { value: 'cash', label: '現金' },
  { value: 'e_money', label: '電子マネー' },
] as const;

const TYPE_LABEL: Record<string, string> = {
  bank: '銀行',
  credit_card: 'クレカ',
  cash: '現金',
  e_money: '電子マネー',
};

const TRANSACTION_TYPES = [
  { value: 'income', label: '収入' },
  { value: 'expense', label: '支出' },
  { value: 'transfer', label: '振替' },
] as const;

const CATEGORIES = ['食費', '日用品', '光熱費', '家賃', '交通費', '医療費', '娯楽', 'その他'];

const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#6B7280'];

export function AccountsPage() {
  const { accounts, loading, totalBalance, addAccount, deleteAccount } = useAccounts();
  const { toast } = useToast();
  const { user } = useAuth();
  const members = user?.home?.members ?? [];
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [showAddTransaction, setShowAddTransaction] = useState(false);

  // Add account form
  const [name, setName] = useState('');
  const [type, setType] = useState<string>('bank');
  const [initialBalance, setInitialBalance] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [billingDate, setBillingDate] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [userId, setUserId] = useState(user?.id ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const memberName = (id: string) => {
    const m = members.find((m) => m.id === id);
    return m ? (m.displayName || m.name) : '';
  };

  function resetAccountForm() {
    setName('');
    setType('bank');
    setInitialBalance('');
    setColor(COLORS[0]);
    setBillingDate('');
    setPaymentDate('');
    setUserId(user?.id ?? '');
    setError(null);
  }

  async function handleAddAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await addAccount({
        name: name.trim(),
        type,
        initialBalance: parseInt(initialBalance, 10) || 0,
        color,
        userId,
        ...(type === 'credit_card'
          ? {
              billingDate: parseInt(billingDate, 10) || undefined,
              paymentDate: parseInt(paymentDate, 10) || undefined,
            }
          : {}),
      });
      resetAccountForm();
      setShowAddAccount(false);
      toast('登録しました');
    } catch (err) {
      setError(err instanceof Error ? err.message : '追加に失敗しました');
      toast('登録に失敗しました', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Landmark size={24} />
          口座管理
        </h1>
        <Button size="sm" onClick={() => setShowAddAccount(true)}>
          <Plus size={16} className="inline mr-1" />
          追加
        </Button>
      </div>

      <Card>
        <p className="text-sm text-on-surface-variant">総残高</p>
        <p className="text-2xl font-bold">{totalBalance.toLocaleString()}円</p>
      </Card>

      <div className="space-y-2">
        <h2 className="font-bold">口座一覧</h2>
        {accounts.length === 0 ? (
          <Card>
            <p className="text-center text-on-surface-variant py-4">口座が登録されていません</p>
          </Card>
        ) : (
          accounts.map((account) => (
            <Card key={account.id} onClick={() => setSelectedAccountId(account.id)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: account.color || '#6B7280' }}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{account.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-surface-container">
                        {TYPE_LABEL[account.type] || account.type}
                      </span>
                      {members.length > 1 && memberName(account.userId) && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {memberName(account.userId)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold">{account.balance.toLocaleString()}円</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        await deleteAccount(account.id);
                        toast('削除しました');
                      } catch {
                        toast('削除に失敗しました', 'error');
                      }
                    }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Add Account Modal */}
      <Modal
        open={showAddAccount}
        onClose={() => {
          setShowAddAccount(false);
          resetAccountForm();
        }}
        title="口座を追加"
      >
        <form onSubmit={handleAddAccount} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">口座名 *</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: みずほ銀行"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">種類</label>
            <select
              className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {ACCOUNT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">初期残高</label>
            <div className="relative">
              <input
                type="number"
                className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary pr-8"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                placeholder="0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant">円</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">カラー</label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`w-8 h-8 rounded-full cursor-pointer transition-all ${
                    color === c ? 'ring-2 ring-offset-2 ring-primary' : ''
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
          {members.length > 1 && (
            <div>
              <label className="block text-sm font-medium mb-1">メンバー</label>
              <div className="flex gap-2">
                {members.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors
                      ${userId === m.id ? 'bg-primary text-white' : 'bg-surface-container hover:bg-outline'}`}
                    onClick={() => setUserId(m.id)}
                  >
                    {m.displayName || m.name}{m.id === user?.id ? ' (自分)' : ''}
                  </button>
                ))}
              </div>
            </div>
          )}
          {type === 'credit_card' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">締め日</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  value={billingDate}
                  onChange={(e) => setBillingDate(e.target.value)}
                  placeholder="15"
                  min={1}
                  max={31}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">引落日</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  placeholder="10"
                  min={1}
                  max={31}
                />
              </div>
            </div>
          )}
          {error && <p className="text-xs text-danger">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? '追加中...' : '追加する'}
          </Button>
        </form>
      </Modal>

      {/* Account Transactions Modal */}
      {selectedAccountId && (
        <AccountTransactionsModal
          accountId={selectedAccountId}
          accountName={accounts.find((a) => a.id === selectedAccountId)?.name || ''}
          onClose={() => setSelectedAccountId(null)}
          onAddTransaction={() => setShowAddTransaction(true)}
        />
      )}

      {/* Add Transaction Modal */}
      {selectedAccountId && (
        <AddTransactionModal
          open={showAddTransaction}
          accountId={selectedAccountId}
          onClose={() => setShowAddTransaction(false)}
        />
      )}
    </div>
  );
}

function AccountTransactionsModal({
  accountId,
  accountName,
  onClose,
  onAddTransaction,
}: {
  accountId: string;
  accountName: string;
  onClose: () => void;
  onAddTransaction: () => void;
}) {
  const { transactions, loading } = useAccountTransactions(accountId);

  return (
    <Modal open onClose={onClose} title={`${accountName} - 取引履歴`}>
      <div className="space-y-3">
        <div className="flex justify-end">
          <Button size="sm" onClick={onAddTransaction}>
            <Plus size={16} className="inline mr-1" />
            取引追加
          </Button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size={20} />
          </div>
        ) : transactions.length === 0 ? (
          <p className="text-center text-on-surface-variant py-4">取引履歴がありません</p>
        ) : (
          transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between py-2 border-b border-outline last:border-0"
            >
              <div>
                <p className="text-sm font-medium">{tx.description || tx.category || '取引'}</p>
                <p className="text-xs text-on-surface-variant">
                  {format(new Date(tx.date), 'M/d')}
                  {tx.category && ` - ${tx.category}`}
                </p>
              </div>
              <span
                className={`font-bold ${
                  tx.type === 'income'
                    ? 'text-green-600'
                    : tx.type === 'expense'
                      ? 'text-red-600'
                      : ''
                }`}
              >
                {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                {tx.amount.toLocaleString()}円
              </span>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}

function AddTransactionModal({
  open,
  accountId,
  onClose,
}: {
  open: boolean;
  accountId: string;
  onClose: () => void;
}) {
  const { addTransaction } = useAccountTransactions(accountId);
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [txType, setTxType] = useState<string>('expense');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseInt(amount, 10);
    if (!num || num <= 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await addTransaction({
        amount: num,
        type: txType,
        category,
        description: description.trim(),
        date,
      });
      onClose();
      toast('登録しました');
    } catch (err) {
      setError(err instanceof Error ? err.message : '追加に失敗しました');
      toast('登録に失敗しました', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="取引を追加">
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
          <label className="block text-sm font-medium mb-1">種類</label>
          <div className="flex gap-2">
            {TRANSACTION_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors
                  ${txType === t.value ? 'bg-primary text-white' : 'bg-surface-container'}`}
                onClick={() => setTxType(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">カテゴリ</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
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
            placeholder="例: コンビニ"
          />
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? '追加中...' : '追加する'}
        </Button>
      </form>
    </Modal>
  );
}
