import { useState, useRef } from 'react';
import { Camera, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Modal, Button, Card, Spinner } from '@/components/ui';
import { api, API_BASE } from '@/utils/api';
import type { GarbageCategory, GarbageSchedule } from '@/types';

interface GarbageSortResult {
  category: string | null;
  explanation: string;
  tips: string | null;
}

interface GarbageSortModalProps {
  open: boolean;
  onClose: () => void;
  categories: GarbageCategory[];
  schedules: GarbageSchedule[];
}

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

function getNextCollectionDate(schedule: GarbageSchedule): Date | null {
  const today = new Date();
  // Check up to 35 days ahead (covers all week-of-month patterns)
  for (let i = 0; i < 35; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dow = date.getDay();
    const weekOfMonth = Math.ceil(date.getDate() / 7);

    if (
      schedule.dayOfWeek.includes(dow) &&
      (!schedule.weekOfMonth || schedule.weekOfMonth.length === 0 || schedule.weekOfMonth.includes(weekOfMonth))
    ) {
      // Skip today if it's already past (assume morning collection)
      if (i === 0) continue;
      return date;
    }
  }
  return null;
}

function formatDate(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dow = DAY_NAMES[date.getDay()];
  return `${month}/${day}(${dow})`;
}

export function GarbageSortModal({ open, onClose, categories, schedules }: GarbageSortModalProps) {
  const [query, setQuery] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GarbageSortResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!query.trim() && !imageFile) return;

    setLoading(true);
    setResult(null);

    try {
      let fileId: string | undefined;

      if (imageFile) {
        const formData = new FormData();
        formData.append('file', imageFile);
        const uploadRes = await fetch(`${API_BASE}/api/v1/files`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
        if (!uploadRes.ok) {
          throw new Error('File upload failed');
        }
        const uploaded = (await uploadRes.json()) as { id: string };
        fileId = uploaded.id;
      }

      const data = await api.post<GarbageSortResult>('/api/v1/garbage/ask', {
        query: query.trim(),
        fileId,
      });

      setResult(data);
    } catch {
      setResult({
        category: null,
        explanation: 'エラーが発生しました。もう一度お試しください。',
        tips: null,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleClose = () => {
    if (!loading) {
      setQuery('');
      setImageFile(null);
      setImagePreview(null);
      setResult(null);
      onClose();
    }
  };

  // Find matching category and schedule info
  const matchedCategory = result?.category
    ? categories.find(
        (c) => c.name === result.category || c.name.toLowerCase() === result.category!.toLowerCase(),
      )
    : null;

  const matchedSchedules = matchedCategory
    ? schedules.filter((s) => s.categoryId === matchedCategory.id)
    : [];

  const nextCollection = matchedSchedules.length > 0
    ? matchedSchedules
        .map((s) => ({ schedule: s, date: getNextCollectionDate(s) }))
        .filter((x): x is { schedule: GarbageSchedule; date: Date } => x.date !== null)
        .sort((a, b) => a.date.getTime() - b.date.getTime())[0] ?? null
    : null;

  return (
    <Modal open={open} onClose={handleClose} title="何ゴミ？アシスタント">
      <div className="space-y-4">
        {/* Input area */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary pr-10"
              placeholder="調べたいものを入力..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-surface-container cursor-pointer text-on-surface-variant"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
            >
              <Camera size={18} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleImageSelect}
            />
          </div>
          <Button
            size="md"
            onClick={handleSubmit}
            disabled={loading || (!query.trim() && !imageFile)}
          >
            調べる
          </Button>
        </div>

        {/* Image preview */}
        {imagePreview && (
          <div className="relative inline-block">
            <img
              src={imagePreview}
              alt="選択した画像"
              className="h-20 rounded-lg object-cover"
            />
            <button
              type="button"
              className="absolute -top-2 -right-2 bg-surface rounded-full shadow p-0.5 cursor-pointer hover:bg-surface-container"
              onClick={removeImage}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Spinner />
            <p className="text-sm text-on-surface-variant">分別を調べています...</p>
          </div>
        )}

        {/* Result display */}
        <AnimatePresence>
          {result && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.25 }}
            >
              {matchedCategory ? (
                <Card
                  className="border-l-4"
                  style={{ borderLeftColor: matchedCategory.color }}
                >
                  <div className="space-y-3">
                    {/* Category header */}
                    <div className="flex items-center gap-2">
                      <span
                        className="w-4 h-4 rounded-full inline-block shrink-0"
                        style={{ backgroundColor: matchedCategory.color }}
                      />
                      <span className="font-bold text-lg">{matchedCategory.name}</span>
                    </div>

                    {/* Explanation */}
                    <p className="text-sm text-on-surface-variant">{result.explanation}</p>

                    {/* Tips */}
                    {result.tips && (
                      <div className="bg-surface-container rounded-lg px-3 py-2">
                        <p className="text-xs font-medium mb-0.5">ポイント</p>
                        <p className="text-sm text-on-surface-variant">{result.tips}</p>
                      </div>
                    )}

                    {/* Next collection */}
                    {nextCollection && (
                      <div className="flex items-center gap-2 pt-1 border-t border-outline/30">
                        <span className="text-xs text-on-surface-variant">次の収集日:</span>
                        <span className="text-sm font-medium">
                          {formatDate(nextCollection.date)}
                        </span>
                        {nextCollection.schedule.location && (
                          <span className="text-xs text-on-surface-variant">
                            @ {nextCollection.schedule.location}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              ) : (
                <Card>
                  <div className="space-y-3">
                    {result.category && (
                      <p className="font-bold text-lg">{result.category}</p>
                    )}
                    <p className="text-sm text-on-surface-variant">{result.explanation}</p>
                    {result.tips && (
                      <div className="bg-surface-container rounded-lg px-3 py-2">
                        <p className="text-xs font-medium mb-0.5">ポイント</p>
                        <p className="text-sm text-on-surface-variant">{result.tips}</p>
                      </div>
                    )}
                    {!result.category && (
                      <p className="text-xs text-on-surface-variant">
                        登録されたカテゴリに該当するものが見つかりませんでした
                      </p>
                    )}
                  </div>
                </Card>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  );
}
