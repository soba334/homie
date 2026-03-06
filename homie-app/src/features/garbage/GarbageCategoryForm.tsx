import { useState } from 'react';
import { Button } from '@/components/ui';
import type { GarbageCategory } from '@/types';

const PRESET_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#0ea5e9'];

interface Props {
  addCategory: (category: { name: string; color: string; description: string; items: string[] }) => Promise<void>;
  updateCategory: (id: string, updates: Partial<GarbageCategory>) => Promise<void>;
  onSubmit: () => void;
  initial?: GarbageCategory;
}

export function GarbageCategoryForm({ addCategory, updateCategory, onSubmit, initial }: Props) {
  const [name, setName] = useState(initial?.name || '');
  const [color, setColor] = useState(initial?.color || PRESET_COLORS[0]);
  const [description, setDescription] = useState(initial?.description || '');
  const [itemsText, setItemsText] = useState(initial?.items.join('、') || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!initial;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const items = itemsText.split(/[,、\n]/).map((s) => s.trim()).filter(Boolean);
      if (isEdit) {
        await updateCategory(initial.id, {
          name: name.trim(),
          color,
          description: description.trim(),
          items,
        });
      } else {
        await addCategory({
          name: name.trim(),
          color,
          description: description.trim(),
          items,
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
        <label className="block text-sm font-medium mb-1">分類名 *</label>
        <input
          className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: 燃えるゴミ"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">カラー</label>
        <div className="flex gap-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`w-8 h-8 rounded-full cursor-pointer ring-2 ring-offset-2 ${color === c ? 'ring-primary' : 'ring-transparent'}`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">説明</label>
        <input
          className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="例: 生ゴミ、紙くず、衣類など"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">含まれるもの（カンマ区切り）</label>
        <textarea
          className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          rows={3}
          value={itemsText}
          onChange={(e) => setItemsText(e.target.value)}
          placeholder="例: 生ゴミ、紙くず、衣類、ゴム製品"
        />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? `${isEdit ? '更新' : '追加'}中...` : `${isEdit ? '更新する' : '追加する'}`}
      </Button>
    </form>
  );
}
