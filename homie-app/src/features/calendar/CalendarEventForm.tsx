import { useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui';
import { useCalendar } from './useCalendar';
import { useAuth } from '@/features/auth/useAuth';

const EVENT_TYPES = [
  { value: 'shared', label: '共通の予定' },
  { value: 'personal', label: '個人の予定' },
  { value: 'task', label: 'タスク' },
];

interface Props {
  initialDate: Date;
  onSubmit: () => void;
}

export function CalendarEventForm({ initialDate, onSubmit }: Props) {
  const { addEvent } = useCalendar();
  const { user } = useAuth();
  const members = user?.home?.members ?? [];
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(format(initialDate, 'yyyy-MM-dd'));
  const [type, setType] = useState('shared');
  const [assignee, setAssignee] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      await addEvent({
        title: title.trim(),
        date,
        allDay: true,
        type,
        assignee: assignee || undefined,
        description: description.trim() || undefined,
        completed: false,
      });
      onSubmit();
    } catch (err) {
      setError(err instanceof Error ? err.message : '追加に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">タイトル *</label>
        <input
          className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例: 内見予約"
          required
        />
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
        <label className="block text-sm font-medium mb-1">種類</label>
        <div className="flex gap-2">
          {EVENT_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              className={`flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors
                ${type === t.value ? 'bg-primary text-white' : 'bg-surface-container hover:bg-outline'}`}
              onClick={() => setType(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">担当</label>
        <div className="flex gap-2">
          <button
            type="button"
            className={`flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors
              ${assignee === '' ? 'bg-primary text-white' : 'bg-surface-container hover:bg-outline'}`}
            onClick={() => setAssignee('')}
          >
            ふたりとも
          </button>
          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors
                ${assignee === m.id ? 'bg-primary text-white' : 'bg-surface-container hover:bg-outline'}`}
              onClick={() => setAssignee(m.id)}
            >
              {m.displayName || m.name}{m.id === user?.id ? ' (自分)' : ''}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">メモ</label>
        <textarea
          className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? '追加中...' : '追加する'}
      </Button>
    </form>
  );
}
