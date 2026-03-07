import { useState, useEffect } from 'react';
import { Trash2, Plus, Pencil, HelpCircle } from 'lucide-react';
import { Card, Button, SearchInput, Modal, FileUpload, Spinner, useToast } from '@/components/ui';
import { useGarbage } from './useGarbage';
import { GarbageCategoryForm } from './GarbageCategoryForm';
import { GarbageScheduleForm } from './GarbageScheduleForm';
import { GarbageSortModal } from './GarbageSortModal';
import { useBackgroundJobs } from '@/hooks/useBackgroundJobs';
import { api, API_BASE } from '@/utils/api';
import type { GarbageCategory, GarbageSchedule } from '@/types';

interface GarbageExtractCategory {
  name: string;
  color: string;
  description: string;
  items: string[];
  schedule?: {
    dayOfWeek: number[];
    weekOfMonth: number[];
    note?: string;
  };
}

interface GarbageExtractResult {
  categories: GarbageExtractCategory[];
}

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

export function GarbagePage() {
  const { categories, schedules, loading, searchItems, deleteCategory, deleteSchedule, deleteAll, todaySchedules, addCategory, updateCategory, addSchedule, updateSchedule, refetch } = useGarbage();
  const { toast } = useToast();
  const { addJob, activeJobIds, completedJobs, consumeJob } = useBackgroundJobs();
  const [query, setQuery] = useState('');
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [editingCategory, setEditingCategory] = useState<GarbageCategory | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<GarbageSchedule | null>(null);
  const [showSortModal, setShowSortModal] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<GarbageExtractResult | null>(null);
  const [registering, setRegistering] = useState(false);

  const hasActiveJob = activeJobIds.length > 0;

  // Pick up completed garbage_extract jobs from the global context
  useEffect(() => {
    const done = completedJobs.find((j) => j.jobType === 'garbage_extract');
    if (!done) return;
    consumeJob(done.id);
    if (done.status === 'completed' && done.result) {
      const result = JSON.parse(done.result) as GarbageExtractResult;
      setExtractedData(result);
      setShowUpload(true);
    }
  }, [completedJobs, consumeJob]);

  const searchResults = query ? searchItems(query) : categories;

  const todayCategories = todaySchedules
    .map((s) => categories.find((c) => c.id === s.categoryId))
    .filter(Boolean);

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
          <Trash2 size={24} />
          ゴミ出し管理
        </h1>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setShowSortModal(true)}>
            <HelpCircle size={16} className="inline mr-1" />
            何ゴミ？
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setShowUpload(true)}>
            画像/PDFから登録
          </Button>
          <Button size="sm" onClick={() => setShowCategoryForm(true)}>
            <Plus size={16} className="inline mr-1" />
            分類追加
          </Button>
        </div>
      </div>

      {hasActiveJob && (
        <Card className="border-primary bg-primary/5">
          <div className="flex items-center gap-3">
            <Spinner size={16} />
            <span className="text-sm">分別表を読み取り中...</span>
          </div>
        </Card>
      )}

      {todayCategories.length > 0 && (
        <Card className="border-primary bg-primary/5">
          <h2 className="font-bold text-primary mb-2">今日のゴミ出し</h2>
          <div className="flex flex-wrap gap-2">
            {todayCategories.map((cat) => cat && (
              <span
                key={cat.id}
                className="px-3 py-1 rounded-full text-sm font-medium text-white"
                style={{ backgroundColor: cat.color }}
              >
                {cat.name}
              </span>
            ))}
          </div>
        </Card>
      )}

      <SearchInput
        placeholder="分別方法を検索（例: ペットボトル）"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {searchResults.map((cat) => {
          const catSchedules = schedules.filter((s) => s.categoryId === cat.id);
          return (
            <Card key={cat.id}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-4 h-4 rounded-full inline-block"
                    style={{ backgroundColor: cat.color }}
                  />
                  <h3 className="font-bold text-lg">{cat.name}</h3>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditingCategory(cat)}>
                    <Pencil size={14} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={async () => {
                    try {
                      await deleteCategory(cat.id);
                      toast('削除しました');
                    } catch {
                      toast('削除に失敗しました', 'error');
                    }
                  }}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
              {cat.description && (
                <p className="text-sm text-on-surface-variant mb-2">{cat.description}</p>
              )}
              {catSchedules.length > 0 ? (
                <div className="space-y-1 mb-2">
                  {catSchedules.map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium">
                          {s.dayOfWeek.map((d) => DAY_NAMES[d]).join('・')}
                        </span>
                        {s.weekOfMonth && s.weekOfMonth.length > 0 && (
                          <span className="text-on-surface-variant ml-1">
                            (第{s.weekOfMonth.join('・')}週)
                          </span>
                        )}
                        {s.location && (
                          <span className="text-on-surface-variant ml-1">@ {s.location}</span>
                        )}
                        {s.note && (
                          <span className="text-on-surface-variant ml-1">- {s.note}</span>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          className="text-on-surface-variant hover:text-on-surface cursor-pointer p-0.5"
                          onClick={() => setEditingSchedule(s)}
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          className="text-danger cursor-pointer p-0.5"
                          onClick={async () => {
                            try {
                              await deleteSchedule(s.id);
                              toast('削除しました');
                            } catch {
                              toast('削除に失敗しました', 'error');
                            }
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-on-surface-variant mb-2">
                  スケジュール未設定 — 設定するとカレンダーに表示されます
                </p>
              )}
              {cat.items.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {cat.items.map((item) => (
                    <span key={item} className="px-2 py-0.5 bg-surface-container rounded text-xs">
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {categories.length > 0 && (
        <div className="space-y-2">
          <Button variant="secondary" onClick={() => setShowScheduleForm(true)} className="w-full">
            <Plus size={16} className="inline mr-1" />
            スケジュール追加
          </Button>
          <Button
            variant="ghost"
            className="w-full text-danger"
            onClick={async () => {
              if (window.confirm('全てのゴミ分類・スケジュールを削除しますか？この操作は取り消せません。')) {
                try {
                  await deleteAll();
                  toast('削除しました');
                } catch {
                  toast('削除に失敗しました', 'error');
                }
              }
            }}
          >
            <Trash2 size={16} className="inline mr-1" />
            一括削除
          </Button>
        </div>
      )}

      {/* 新規カテゴリ追加 */}
      <Modal open={showCategoryForm} onClose={() => setShowCategoryForm(false)} title="ゴミ分類を追加">
        <GarbageCategoryForm
          addCategory={addCategory}
          updateCategory={updateCategory}
          onSubmit={() => { setShowCategoryForm(false); refetch(); toast('登録しました'); }}
        />
      </Modal>

      {/* カテゴリ編集 */}
      <Modal open={!!editingCategory} onClose={() => setEditingCategory(null)} title="ゴミ分類を編集">
        {editingCategory && (
          <GarbageCategoryForm
            addCategory={addCategory}
            updateCategory={updateCategory}
            initial={editingCategory}
            onSubmit={() => { setEditingCategory(null); refetch(); toast('更新しました'); }}
          />
        )}
      </Modal>

      {/* 新規スケジュール追加 */}
      <Modal open={showScheduleForm} onClose={() => setShowScheduleForm(false)} title="収集スケジュールを追加">
        <GarbageScheduleForm
          categories={categories}
          addSchedule={addSchedule}
          updateSchedule={updateSchedule}
          onSubmit={() => { setShowScheduleForm(false); refetch(); toast('登録しました'); }}
        />
      </Modal>

      {/* スケジュール編集 */}
      <Modal open={!!editingSchedule} onClose={() => setEditingSchedule(null)} title="収集スケジュールを編集">
        {editingSchedule && (
          <GarbageScheduleForm
            categories={categories}
            addSchedule={addSchedule}
            updateSchedule={updateSchedule}
            initial={editingSchedule}
            onSubmit={() => { setEditingSchedule(null); refetch(); toast('更新しました'); }}
          />
        )}
      </Modal>

      <Modal
        open={showUpload}
        onClose={() => {
          if (!extracting && !registering) {
            setShowUpload(false);
            setExtractedData(null);
            setExtracting(false);
          }
        }}
        title="画像/PDFからゴミ情報を登録"
      >
        {extracting ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <Spinner />
            <p className="text-sm text-on-surface-variant">分別表を読み取り中...</p>
          </div>
        ) : extractedData ? (
          <div className="space-y-3">
            <p className="text-sm text-on-surface-variant">
              {extractedData.categories.length}件の分類が見つかりました。内容を確認して登録してください。
            </p>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {extractedData.categories.map((cat, i) => (
                <Card key={i} className="text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="w-3 h-3 rounded-full inline-block shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="font-bold">{cat.name}</span>
                  </div>
                  {cat.description && (
                    <p className="text-xs text-on-surface-variant mb-1">{cat.description}</p>
                  )}
                  {cat.items.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1">
                      {cat.items.map((item) => (
                        <span key={item} className="px-2 py-0.5 bg-surface-container rounded text-xs">
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                  {cat.schedule && cat.schedule.dayOfWeek.length > 0 && (
                    <p className="text-xs text-on-surface-variant">
                      収集日: {cat.schedule.dayOfWeek.map((d) => DAY_NAMES[d]).join('・')}
                      {cat.schedule.weekOfMonth.length > 0 && (
                        <span className="ml-1">
                          第{cat.schedule.weekOfMonth.join('・')}週
                        </span>
                      )}
                    </p>
                  )}
                </Card>
              ))}
            </div>
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                className="text-sm text-primary hover:underline cursor-pointer"
                onClick={() => setExtractedData(null)}
              >
                やり直す
              </button>
              <Button
                disabled={registering}
                onClick={async () => {
                  setRegistering(true);
                  try {
                    for (const cat of extractedData.categories) {
                      const created = await addCategory({
                        name: cat.name,
                        color: cat.color,
                        description: cat.description,
                        items: cat.items,
                      });
                      if (cat.schedule && created) {
                        await addSchedule({
                          categoryId: created.id,
                          dayOfWeek: cat.schedule.dayOfWeek,
                          weekOfMonth: cat.schedule.weekOfMonth,
                          note: cat.schedule.note,
                        });
                      }
                    }
                    await refetch();
                    toast('全ての分類を登録しました');
                    setShowUpload(false);
                    setExtractedData(null);
                  } catch {
                    toast('登録に失敗しました', 'error');
                  } finally {
                    setRegistering(false);
                  }
                }}
              >
                {registering ? '登録中...' : '全て登録する'}
              </Button>
            </div>
          </div>
        ) : (
          <FileUpload accept="image/*,.pdf" onFileSelect={async (files) => {
            const file = files[0];
            if (!file) return;
            setExtracting(true);
            try {
              const formData = new FormData();
              formData.append('file', file);
              const uploadRes = await fetch(`${API_BASE}/api/v1/files`, {
                method: 'POST',
                credentials: 'include',
                body: formData,
              });
              if (!uploadRes.ok) {
                throw new Error('ファイルのアップロードに失敗しました');
              }
              const uploaded = await uploadRes.json() as { id: string };
              const resp = await api.post<{ jobId: string }>('/api/v1/garbage/extract', { fileId: uploaded.id });
              addJob(resp.jobId, 'garbage_extract');
              setShowUpload(false);
              toast('バックグラウンドで読み取り中...');
            } catch {
              toast('アップロードに失敗しました', 'error');
            } finally {
              setExtracting(false);
            }
          }}>
            <div className="flex flex-col items-center gap-2 text-on-surface-variant">
              <p className="font-medium">ゴミカレンダーや分別表をアップロード</p>
              <p className="text-sm">画像またはPDFファイルを選択</p>
            </div>
          </FileUpload>
        )}
      </Modal>

      <GarbageSortModal
        open={showSortModal}
        onClose={() => setShowSortModal(false)}
        categories={categories}
        schedules={schedules}
      />
    </div>
  );
}
