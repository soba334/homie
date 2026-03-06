import { useState } from 'react';
import { Button } from '@/components/ui';
import type { GarbageCategory, GarbageSchedule } from '@/types';

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

interface Props {
  categories: GarbageCategory[];
  addSchedule: (schedule: {
    categoryId: string;
    dayOfWeek: number[];
    weekOfMonth?: number[];
    location?: string;
    note?: string;
  }) => Promise<void>;
  updateSchedule: (id: string, updates: Partial<GarbageSchedule>) => Promise<void>;
  onSubmit: () => void;
  initial?: GarbageSchedule;
}

export function GarbageScheduleForm({ categories, addSchedule, updateSchedule, onSubmit, initial }: Props) {
  const [categoryId, setCategoryId] = useState(initial?.categoryId || categories[0]?.id || '');
  const [selectedDays, setSelectedDays] = useState<number[]>(initial?.dayOfWeek || []);
  const [selectedWeeks, setSelectedWeeks] = useState<number[]>(initial?.weekOfMonth || []);
  const [location, setLocation] = useState(initial?.location || '');
  const [note, setNote] = useState(initial?.note || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!initial;

  function toggleDay(day: number) {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }

  function toggleWeek(week: number) {
    setSelectedWeeks((prev) =>
      prev.includes(week) ? prev.filter((w) => w !== week) : [...prev, week],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryId || selectedDays.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = {
        categoryId,
        dayOfWeek: selectedDays.sort(),
        weekOfMonth: selectedWeeks.length > 0 ? selectedWeeks.sort() : undefined,
        location: location.trim() || undefined,
        note: note.trim() || undefined,
      };
      if (isEdit) {
        await updateSchedule(initial.id, data);
      } else {
        await addSchedule(data);
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
        <label className="block text-sm font-medium mb-1">ゴミ分類 *</label>
        <select
          className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          required
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">収集曜日 *</label>
        <div className="flex gap-1">
          {DAY_NAMES.map((name, i) => (
            <button
              key={i}
              type="button"
              className={`w-10 h-10 rounded-full text-sm font-medium cursor-pointer transition-colors
                ${selectedDays.includes(i) ? 'bg-primary text-white' : 'bg-surface-container text-on-surface hover:bg-outline'}`}
              onClick={() => toggleDay(i)}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">収集週（空欄＝毎週）</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((w) => (
            <button
              key={w}
              type="button"
              className={`w-10 h-10 rounded-lg text-sm font-medium cursor-pointer transition-colors
                ${selectedWeeks.includes(w) ? 'bg-primary text-white' : 'bg-surface-container text-on-surface hover:bg-outline'}`}
              onClick={() => toggleWeek(w)}
            >
              {w}週
            </button>
          ))}
        </div>
        <p className="text-xs text-on-surface-variant mt-1">第何週に収集するか選択。空欄なら毎週</p>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">収集場所</label>
        <input
          className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="例: マンション1階ゴミ置き場"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">メモ</label>
        <input
          className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="例: 朝8時までに出す"
        />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <Button type="submit" className="w-full" disabled={submitting || selectedDays.length === 0}>
        {submitting ? `${isEdit ? '更新' : '追加'}中...` : `${isEdit ? '更新する' : '追加する'}`}
      </Button>
    </form>
  );
}
