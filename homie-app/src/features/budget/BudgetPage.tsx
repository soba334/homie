import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet, Plus, Trash2, ChevronLeft, ChevronRight, Pencil,
  AlertTriangle, Landmark, PiggyBank, Target, RefreshCw, Pause, Play,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Card, Button, Modal, FileUpload, Spinner, Tabs, TabContent } from '@/components/ui';
import { useBudget } from './useBudget';
import { useMonthlyBudgets } from '@/features/monthly-budgets/useMonthlyBudgets';
import { useAccounts } from '@/features/accounts/useAccounts';
import { useSavings } from '@/features/savings/useSavings';
import { useSubscriptions } from './useSubscriptions';
import { useAuth } from '@/features/auth/useAuth';
import { BudgetEntryForm } from './BudgetEntryForm';
import { SubscriptionForm } from './SubscriptionForm';
import type { Subscription, BudgetEntry } from '@/types';
import { format } from 'date-fns';

const CATEGORY_ICONS: Record<string, string> = {
  '食費': '🍚', '日用品': '🧴', '光熱費': '💡', '家賃': '🏠',
  '交通費': '🚃', '医療費': '🏥', '娯楽': '🎮', 'その他': '📦',
};

const BUDGET_CATEGORIES = ['食費', '日用品', '光熱費', '家賃', '交通費', '医療費', '娯楽', 'その他'];

type Tab = 'overview' | 'expenses' | 'subscriptions' | 'accounts' | 'savings';

export function BudgetPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const yearMonth = `${year}-${String(month).padStart(2, '0')}`;

  const { user } = useAuth();
  const budget = useBudget(yearMonth);
  const monthlyBudgets = useMonthlyBudgets(yearMonth);
  const accounts = useAccounts();
  const savings = useSavings();
  const subs = useSubscriptions();

  const members = user?.home?.members ?? [];
  const memberName = (id: string) => {
    const m = members.find((m) => m.id === id);
    return m ? (m.displayName || m.name) : id;
  };

  const [tab, setTab] = useState<Tab>('overview');
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BudgetEntry | null>(null);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [showSubForm, setShowSubForm] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  // Budget form state
  const [budgetCategory, setBudgetCategory] = useState(BUDGET_CATEGORIES[0]);
  const [budgetAmount, setBudgetAmount] = useState('');
  const [budgetSubmitting, setBudgetSubmitting] = useState(false);
  const [budgetError, setBudgetError] = useState<string | null>(null);

  const totalBudget = monthlyBudgets.budgets.reduce((s, b) => s + b.budgetAmount, 0);
  const totalBudgetRemaining = totalBudget - budget.monthlyTotal;

  function prevMonth() {
    if (month === 1) { setYear(year - 1); setMonth(12); }
    else setMonth(month - 1);
  }

  function nextMonth() {
    if (month === 12) { setYear(year + 1); setMonth(1); }
    else setMonth(month + 1);
  }

  async function handleBudgetSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseInt(budgetAmount, 10);
    if (!num || num <= 0) return;
    setBudgetSubmitting(true);
    setBudgetError(null);
    try {
      await monthlyBudgets.upsertBudget({ category: budgetCategory, amount: num, yearMonth });
      setShowBudgetForm(false);
      setBudgetAmount('');
    } catch (err) {
      setBudgetError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setBudgetSubmitting(false);
    }
  }

  const loading = budget.loading || monthlyBudgets.loading || accounts.loading || savings.loading || subs.loading;
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  const sortedEntries = [...budget.entries].sort((a, b) => b.date.localeCompare(a.date));

  const TAB_ITEMS = [
    { key: 'overview', label: '概要' },
    { key: 'expenses', label: '支出' },
    { key: 'subscriptions', label: '定期' },
    { key: 'accounts', label: '口座' },
    { key: 'savings', label: '貯蓄' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wallet size={24} />
          家計簿
        </h1>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setShowUpload(true)}>
            レシート
          </Button>
          <Button size="sm" onClick={() => setShowEntryForm(true)}>
            <Plus size={16} className="inline mr-1" />
            支出追加
          </Button>
        </div>
      </div>

      {/* Month Selector */}
      <div className="flex items-center justify-center gap-4">
        <button className="p-1 hover:bg-surface-container rounded cursor-pointer" onClick={prevMonth}>
          <ChevronLeft size={20} />
        </button>
        <span className="text-lg font-bold">{year}年{month}月</span>
        <button className="p-1 hover:bg-surface-container rounded cursor-pointer" onClick={nextMonth}>
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="text-center">
          <p className="text-xs text-on-surface-variant">支出</p>
          <p className="text-lg font-bold">{budget.monthlyTotal.toLocaleString()}<span className="text-xs">円</span></p>
        </Card>
        <Card className={`text-center ${totalBudgetRemaining < 0 ? 'border-red-200 bg-red-50/50' : ''}`}>
          <p className="text-xs text-on-surface-variant">予算残</p>
          <p className={`text-lg font-bold ${totalBudgetRemaining < 0 ? 'text-red-600' : ''}`}>
            {totalBudget > 0 ? `${totalBudgetRemaining.toLocaleString()}` : '-'}
            {totalBudget > 0 && <span className="text-xs">円</span>}
          </p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-on-surface-variant">総残高</p>
          <p className="text-lg font-bold">{accounts.totalBalance.toLocaleString()}<span className="text-xs">円</span></p>
        </Card>
      </div>

      <Tabs tabs={TAB_ITEMS} activeKey={tab} onChange={(key) => setTab(key as Tab)} layoutId="budget-tab" />

      <TabContent activeKey={tab}>
      {tab === 'overview' && (
        <div className="space-y-4">
          {/* Budget Progress */}
          <div className="flex items-center justify-between">
            <h2 className="font-bold flex items-center gap-1"><Target size={16} /> 予算</h2>
            <Button size="sm" variant="ghost" onClick={() => setShowBudgetForm(true)}>
              <Plus size={14} className="mr-1" />設定
            </Button>
          </div>
          {monthlyBudgets.budgets.length === 0 ? (
            <Card>
              <p className="text-center text-on-surface-variant text-sm py-2">
                予算を設定すると、カテゴリ別の進捗が表示されます
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {monthlyBudgets.budgets.map((item) => {
                const rate = Math.min(item.usageRate * 100, 100);
                return (
                  <Card key={item.category} className="py-2 px-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{CATEGORY_ICONS[item.category] || '📦'}</span>
                        <span className="text-sm font-medium">{item.category}</span>
                        {item.overBudget && <AlertTriangle size={12} className="text-red-500" />}
                      </div>
                      <span className={`text-xs font-medium ${item.overBudget ? 'text-red-600' : 'text-on-surface-variant'}`}>
                        {item.actualAmount.toLocaleString()} / {item.budgetAmount.toLocaleString()}円
                      </span>
                    </div>
                    <div className="w-full bg-surface-container rounded-full h-1.5">
                      <motion.div
                        className={`h-1.5 rounded-full ${item.overBudget ? 'bg-red-500' : 'bg-primary'}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${rate}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                      />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Person Split */}
          {Object.keys(budget.monthlyByPerson).length > 0 && (
            <>
              <h2 className="font-bold">支払い割合</h2>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(budget.monthlyByPerson).map(([personId, amount]) => (
                  <Card key={personId} className="text-center py-2">
                    <p className="text-xs text-on-surface-variant">{memberName(personId)}</p>
                    <p className="text-lg font-bold">{amount.toLocaleString()}<span className="text-xs">円</span></p>
                  </Card>
                ))}
              </div>
            </>
          )}

          {/* Recent Expenses */}
          <div className="flex items-center justify-between">
            <h2 className="font-bold">最近の支出</h2>
            <button className="text-sm text-primary cursor-pointer" onClick={() => setTab('expenses')}>
              すべて見る
            </button>
          </div>
          {sortedEntries.slice(0, 5).map((entry) => (
            <div key={entry.id} className="flex items-center justify-between py-1.5 border-b border-outline/30 last:border-0">
              <div className="flex items-center gap-2">
                <span className="text-sm">{CATEGORY_ICONS[entry.category] || '📦'}</span>
                <div>
                  <span className="text-sm">{entry.description || entry.category}</span>
                  <span className="text-xs text-on-surface-variant ml-2">{format(new Date(entry.date), 'M/d')}</span>
                </div>
              </div>
              <span className="text-sm font-medium">{entry.amount.toLocaleString()}円</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'expenses' && (
        <div className="space-y-2">
          {/* Category Summary */}
          {Object.keys(budget.categorySummary).length > 0 && (
            <Card>
              <h3 className="font-bold mb-2 text-sm">カテゴリ別</h3>
              <div className="space-y-1">
                {Object.entries(budget.categorySummary)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, amount]) => (
                    <div key={cat} className="flex items-center justify-between">
                      <span className="text-sm">{CATEGORY_ICONS[cat] || '📦'} {cat}</span>
                      <span className="text-sm font-medium">{amount.toLocaleString()}円</span>
                    </div>
                  ))}
              </div>
            </Card>
          )}

          {/* All Entries */}
          {sortedEntries.length === 0 ? (
            <Card>
              <p className="text-center text-on-surface-variant py-4">まだ支出がありません</p>
            </Card>
          ) : (
            sortedEntries.map((entry) => (
              <Card key={entry.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span>{CATEGORY_ICONS[entry.category] || '📦'}</span>
                      <span className="font-medium">{entry.description || entry.category}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-surface-container">{memberName(entry.paidBy)}</span>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-1">{format(new Date(entry.date), 'M/d')}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold">{entry.amount.toLocaleString()}円</span>
                    <Button size="sm" variant="ghost" onClick={() => setEditingEntry(entry)}>
                      <Pencil size={14} />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => budget.deleteEntry(entry.id)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {tab === 'subscriptions' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold flex items-center gap-1"><RefreshCw size={16} /> サブスク・定期支出</h2>
              {subs.monthlyTotal > 0 && (
                <p className="text-xs text-on-surface-variant mt-0.5">
                  月額換算 約{Math.round(subs.monthlyTotal).toLocaleString()}円
                </p>
              )}
            </div>
            <Button size="sm" onClick={() => setShowSubForm(true)}>
              <Plus size={14} className="mr-1" />追加
            </Button>
          </div>
          {subs.subscriptions.length === 0 ? (
            <Card>
              <p className="text-center text-on-surface-variant py-4 text-sm">
                サブスクや定期支出を登録すると、自動で家計簿に記録されます
              </p>
            </Card>
          ) : (
            subs.subscriptions.map((sub) => (
              <Card key={sub.id} className={!sub.isActive ? 'opacity-50' : ''}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{sub.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-surface-container">
                        {sub.billingCycle === 'monthly' ? '毎月' : sub.billingCycle === 'yearly' ? '毎年' : '毎週'}
                      </span>
                      {!sub.isActive && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">停止中</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-on-surface-variant">{sub.category}</span>
                      <span className="text-xs text-on-surface-variant">
                        次回: {sub.nextBillingDate}
                      </span>
                      <span className="text-xs text-on-surface-variant">
                        {memberName(sub.paidBy)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{sub.amount.toLocaleString()}円</span>
                    <Button size="sm" variant="ghost" onClick={() => setEditingSub(sub)}>
                      <Pencil size={14} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => subs.updateSubscription(sub.id, { isActive: !sub.isActive })}
                    >
                      {sub.isActive ? <Pause size={14} /> : <Play size={14} />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => subs.deleteSubscription(sub.id)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {tab === 'accounts' && (
        <div className="space-y-3">
          <Card>
            <div className="flex items-center gap-2 mb-1">
              <Landmark size={16} />
              <span className="font-bold">総残高</span>
            </div>
            <p className="text-2xl font-bold">{accounts.totalBalance.toLocaleString()}円</p>
          </Card>
          {accounts.accounts.length === 0 ? (
            <Card>
              <p className="text-center text-on-surface-variant py-4 text-sm">
                口座が未登録です。<Link to="/accounts" className="text-primary underline">口座管理</Link>から追加してください
              </p>
            </Card>
          ) : (
            accounts.accounts.map((account) => (
              <Card key={account.id}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: account.color || '#6B7280' }} />
                    <div>
                      <span className="font-medium text-sm">{account.name}</span>
                      <span className="text-xs text-on-surface-variant ml-1.5">
                        {({ bank: '銀行', credit_card: 'クレカ', cash: '現金', e_money: '電子マネー' })[account.type]}
                      </span>
                    </div>
                  </div>
                  <span className="font-bold">{account.balance.toLocaleString()}円</span>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {tab === 'savings' && (
        <div className="space-y-3">
          {savings.goals.length === 0 ? (
            <Card>
              <p className="text-center text-on-surface-variant py-4 text-sm">
                貯蓄目標が未設定です。<Link to="/savings" className="text-primary underline">貯蓄目標</Link>から追加してください
              </p>
            </Card>
          ) : (
            savings.goals.map((goal) => {
              const rate = Math.min(goal.progressRate, 100);
              return (
                <Card key={goal.id}>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <PiggyBank size={16} />
                        <span className="font-medium text-sm">{goal.name}</span>
                      </div>
                      <span className="text-sm font-medium">{Math.round(goal.progressRate)}%</span>
                    </div>
                    <div className="w-full bg-surface-container rounded-full h-2">
                      <motion.div
                        className="h-2 rounded-full bg-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${rate}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-on-surface-variant">
                      <span>{goal.currentAmount.toLocaleString()}円 / {goal.targetAmount.toLocaleString()}円</span>
                      {goal.monthlyRequired != null && goal.monthlyRequired > 0 && (
                        <span>月{goal.monthlyRequired.toLocaleString()}円</span>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}
      </TabContent>

      {/* Add Entry Modal */}
      <Modal open={showEntryForm} onClose={() => setShowEntryForm(false)} title="支出を追加">
        <BudgetEntryForm
          addEntry={budget.addEntry}
          updateEntry={budget.updateEntry}
          budgetItems={monthlyBudgets.budgets}
          onSubmit={() => {
            setShowEntryForm(false);
            monthlyBudgets.refetch();
          }}
        />
      </Modal>

      {/* Edit Entry Modal */}
      <Modal open={!!editingEntry} onClose={() => setEditingEntry(null)} title="支出を編集">
        {editingEntry && (
          <BudgetEntryForm
            addEntry={budget.addEntry}
            updateEntry={budget.updateEntry}
            budgetItems={monthlyBudgets.budgets}
            initial={editingEntry}
            onSubmit={() => {
              setEditingEntry(null);
              monthlyBudgets.refetch();
            }}
          />
        )}
      </Modal>

      {/* Add/Edit Budget Modal */}
      <Modal open={showBudgetForm} onClose={() => { setShowBudgetForm(false); setBudgetError(null); }} title="月予算を設定">
        <form onSubmit={handleBudgetSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">カテゴリ</label>
            <div className="flex flex-wrap gap-2">
              {BUDGET_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`px-3 py-1.5 rounded-full text-sm cursor-pointer transition-colors
                    ${budgetCategory === cat ? 'bg-primary text-white' : 'bg-surface-container hover:bg-outline'}`}
                  onClick={() => setBudgetCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">予算額 *</label>
            <div className="relative">
              <input
                type="number"
                className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary pr-8"
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(e.target.value)}
                placeholder="30000"
                required
                min={1}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant">円</span>
            </div>
          </div>
          {budgetError && <p className="text-xs text-danger">{budgetError}</p>}
          <Button type="submit" className="w-full" disabled={budgetSubmitting}>
            {budgetSubmitting ? '保存中...' : '設定する'}
          </Button>
        </form>
      </Modal>

      {/* Add Subscription Modal */}
      <Modal open={showSubForm} onClose={() => setShowSubForm(false)} title="サブスク・定期支出を登録">
        <SubscriptionForm
          addSubscription={subs.addSubscription}
          updateSubscription={subs.updateSubscription}
          onSubmit={() => { setShowSubForm(false); subs.refetch(); }}
        />
      </Modal>

      {/* Edit Subscription Modal */}
      <Modal open={!!editingSub} onClose={() => setEditingSub(null)} title="サブスク・定期支出を編集">
        {editingSub && (
          <SubscriptionForm
            addSubscription={subs.addSubscription}
            updateSubscription={subs.updateSubscription}
            initial={editingSub}
            onSubmit={() => { setEditingSub(null); subs.refetch(); }}
          />
        )}
      </Modal>

      {/* Receipt Upload Modal */}
      <Modal open={showUpload} onClose={() => setShowUpload(false)} title="レシートから読み取り">
        <FileUpload accept="image/*,video/*" onFileSelect={(files) => {
          console.log('Receipt files for OCR:', files);
          setShowUpload(false);
        }} multiple>
          <div className="flex flex-col items-center gap-2 text-on-surface-variant">
            <p className="font-medium">レシートの画像や動画をアップロード</p>
            <p className="text-sm">複数選択可能</p>
          </div>
        </FileUpload>
        <p className="text-xs text-on-surface-variant mt-3">
          ※ OCR処理は今後のアップデートで対応予定です
        </p>
      </Modal>
    </div>
  );
}
