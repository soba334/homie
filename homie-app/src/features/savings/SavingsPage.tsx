import { useState } from 'react';
import { PiggyBank, Plus, Loader2 } from 'lucide-react';
import { Card, Button, Modal } from '@/components/ui';
import { useSavings } from './useSavings';
import { format } from 'date-fns';

export function SavingsPage() {
  const { goals, loading, addGoal, updateGoal } = useSavings();
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setName('');
    setTargetAmount('');
    setCurrentAmount('');
    setTargetDate('');
    setNote('');
    setEditingGoal(null);
    setError(null);
  }

  function openEdit(goal: {
    id: string;
    name: string;
    targetAmount: number;
    currentAmount: number;
    targetDate?: string;
    note?: string;
  }) {
    setEditingGoal(goal.id);
    setName(goal.name);
    setTargetAmount(String(goal.targetAmount));
    setCurrentAmount(String(goal.currentAmount));
    setTargetDate(goal.targetDate || '');
    setNote(goal.note || '');
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const target = parseInt(targetAmount, 10);
    const current = parseInt(currentAmount, 10) || 0;
    if (!target || target <= 0) return;
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      if (editingGoal) {
        await updateGoal(editingGoal, {
          name: name.trim(),
          targetAmount: target,
          currentAmount: current,
          targetDate: targetDate || undefined,
          note: note.trim() || undefined,
        });
      } else {
        await addGoal({
          name: name.trim(),
          targetAmount: target,
          currentAmount: current,
          targetDate: targetDate || undefined,
          note: note.trim() || undefined,
        });
      }
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
        <Loader2 size={24} className="animate-spin text-on-surface-variant" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <PiggyBank size={24} />
          貯蓄目標
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

      <div className="space-y-3">
        {goals.length === 0 ? (
          <Card>
            <p className="text-center text-on-surface-variant py-4">目標が設定されていません</p>
          </Card>
        ) : (
          goals.map((goal) => {
            const rate = Math.min(goal.progressRate, 100);
            return (
              <Card key={goal.id} onClick={() => openEdit(goal)}>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{goal.name}</span>
                    {goal.targetDate && (
                      <span className="text-xs text-on-surface-variant">
                        目標: {format(new Date(goal.targetDate), 'yyyy/M/d')}
                      </span>
                    )}
                  </div>
                  <div className="w-full bg-surface-container rounded-full h-2.5">
                    <div
                      className="h-2.5 rounded-full bg-primary transition-all"
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">
                      {goal.currentAmount.toLocaleString()}円 / {goal.targetAmount.toLocaleString()}円
                    </span>
                    <span className="font-medium">{Math.round(goal.progressRate)}%</span>
                  </div>
                  {goal.monthlyRequired != null && goal.monthlyRequired > 0 && (
                    <p className="text-xs text-on-surface-variant">
                      月あたり {goal.monthlyRequired.toLocaleString()}円 必要
                    </p>
                  )}
                  {goal.note && <p className="text-xs text-on-surface-variant">{goal.note}</p>}
                </div>
              </Card>
            );
          })
        )}
      </div>

      <Modal
        open={showForm}
        onClose={() => {
          setShowForm(false);
          resetForm();
        }}
        title={editingGoal ? '目標を編集' : '目標を追加'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">目標名 *</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 旅行資金"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">目標金額 *</label>
            <div className="relative">
              <input
                type="number"
                className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary pr-8"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="500000"
                required
                min={1}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant">円</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">現在の貯蓄額</label>
            <div className="relative">
              <input
                type="number"
                className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary pr-8"
                value={currentAmount}
                onChange={(e) => setCurrentAmount(e.target.value)}
                placeholder="0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant">円</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">目標日</label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">メモ</label>
            <input
              className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例: ハワイ旅行のために"
            />
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? '保存中...' : editingGoal ? '更新する' : '追加する'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
