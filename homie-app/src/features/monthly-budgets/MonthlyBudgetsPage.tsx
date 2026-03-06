import { useState } from 'react';
import { Target, Plus, Trash2, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import { Card, Button, Modal, Spinner } from '@/components/ui';
import { useMonthlyBudgets } from './useMonthlyBudgets';

const CATEGORIES = ['食費', '日用品', '光熱費', '家賃', '交通費', '医療費', '娯楽', 'その他'];

export function MonthlyBudgetsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
  const { budgets, loading, upsertBudget, deleteBudget } = useMonthlyBudgets(yearMonth);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);

  // Form state
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setCategory(CATEGORIES[0]);
    setAmount('');
    setEditingCategory(null);
    setError(null);
  }

  function openEdit(item: { category: string; budgetAmount: number }) {
    setEditingCategory(item.category);
    setCategory(item.category);
    setAmount(String(item.budgetAmount));
    setShowForm(true);
  }

  function prevMonth() {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
  }

  function nextMonth() {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseInt(amount, 10);
    if (!num || num <= 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await upsertBudget({ category, amount: num, yearMonth });
      resetForm();
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
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
          <Target size={24} />
          月別予算
        </h1>
        <Button
          size="sm"
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
        >
          <Plus size={16} className="inline mr-1" />
          追加
        </Button>
      </div>

      {/* Year-Month Selector */}
      <div className="flex items-center justify-center gap-4">
        <Button size="sm" variant="ghost" onClick={prevMonth}>
          <ChevronLeft size={20} />
        </Button>
        <span className="text-lg font-bold">
          {year}年{month}月
        </span>
        <Button size="sm" variant="ghost" onClick={nextMonth}>
          <ChevronRight size={20} />
        </Button>
      </div>

      {/* Budget List */}
      <div className="space-y-3">
        {budgets.length === 0 ? (
          <Card>
            <p className="text-center text-on-surface-variant py-4">予算が設定されていません</p>
          </Card>
        ) : (
          budgets.map((item) => {
            const rate = Math.min(item.usageRate, 100);

            return (
              <Card key={item.category} onClick={() => openEdit(item)}>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.category}</span>
                      {item.overBudget && (
                        <span className="flex items-center gap-1 text-xs text-red-600">
                          <AlertTriangle size={12} />
                          超過
                        </span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteBudget(item.category);
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                  <div className="w-full bg-surface-container rounded-full h-2.5">
                    <motion.div
                      className={`h-2.5 rounded-full ${item.overBudget ? 'bg-red-500' : 'bg-primary'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${rate}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                  <div className="flex justify-between text-sm text-on-surface-variant">
                    <span>実績: {item.actualAmount.toLocaleString()}円</span>
                    <span>予算: {item.budgetAmount.toLocaleString()}円</span>
                  </div>
                  <p
                    className={`text-sm font-medium ${item.overBudget ? 'text-red-600' : 'text-green-600'}`}
                  >
                    {item.overBudget
                      ? `${Math.abs(item.remaining).toLocaleString()}円 超過`
                      : `残り ${item.remaining.toLocaleString()}円`}
                  </p>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={showForm}
        onClose={() => {
          setShowForm(false);
          resetForm();
        }}
        title={editingCategory ? '予算を編集' : '予算を追加'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <label className="block text-sm font-medium mb-1">予算額 *</label>
            <div className="relative">
              <input
                type="number"
                className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary pr-8"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="30000"
                required
                min={1}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant">円</span>
            </div>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? '保存中...' : editingCategory ? '更新する' : '追加する'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
