import { useState } from 'react';
import { Trash2, Plus, Loader2, Pencil } from 'lucide-react';
import { Card, Button, SearchInput, Modal, FileUpload } from '@/components/ui';
import { useGarbage } from './useGarbage';
import { GarbageCategoryForm } from './GarbageCategoryForm';
import { GarbageScheduleForm } from './GarbageScheduleForm';
import type { GarbageCategory, GarbageSchedule } from '@/types';

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

export function GarbagePage() {
  const { categories, schedules, loading, searchItems, deleteCategory, deleteSchedule, deleteAll, todaySchedules, addCategory, updateCategory, addSchedule, updateSchedule, refetch } = useGarbage();
  const [query, setQuery] = useState('');
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [editingCategory, setEditingCategory] = useState<GarbageCategory | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<GarbageSchedule | null>(null);

  const searchResults = query ? searchItems(query) : categories;

  const todayCategories = todaySchedules
    .map((s) => categories.find((c) => c.id === s.categoryId))
    .filter(Boolean);

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
          <Trash2 size={24} />
          ゴミ出し管理
        </h1>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setShowUpload(true)}>
            画像/PDFから登録
          </Button>
          <Button size="sm" onClick={() => setShowCategoryForm(true)}>
            <Plus size={16} className="inline mr-1" />
            分類追加
          </Button>
        </div>
      </div>

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
                  <Button size="sm" variant="ghost" onClick={() => deleteCategory(cat.id)}>
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
                          onClick={() => deleteSchedule(s.id)}
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
            onClick={() => {
              if (window.confirm('全てのゴミ分類・スケジュールを削除しますか？この操作は取り消せません。')) {
                deleteAll();
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
          onSubmit={() => { setShowCategoryForm(false); refetch(); }}
        />
      </Modal>

      {/* カテゴリ編集 */}
      <Modal open={!!editingCategory} onClose={() => setEditingCategory(null)} title="ゴミ分類を編集">
        {editingCategory && (
          <GarbageCategoryForm
            addCategory={addCategory}
            updateCategory={updateCategory}
            initial={editingCategory}
            onSubmit={() => { setEditingCategory(null); refetch(); }}
          />
        )}
      </Modal>

      {/* 新規スケジュール追加 */}
      <Modal open={showScheduleForm} onClose={() => setShowScheduleForm(false)} title="収集スケジュールを追加">
        <GarbageScheduleForm
          categories={categories}
          addSchedule={addSchedule}
          updateSchedule={updateSchedule}
          onSubmit={() => { setShowScheduleForm(false); refetch(); }}
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
            onSubmit={() => { setEditingSchedule(null); refetch(); }}
          />
        )}
      </Modal>

      <Modal open={showUpload} onClose={() => setShowUpload(false)} title="画像/PDFからゴミ情報を登録">
        <FileUpload accept="image/*,.pdf" onFileSelect={(files) => {
          console.log('Uploaded files for OCR processing:', files);
          setShowUpload(false);
        }}>
          <div className="flex flex-col items-center gap-2 text-on-surface-variant">
            <p className="font-medium">ゴミカレンダーや分別表をアップロード</p>
            <p className="text-sm">画像またはPDFファイルを選択</p>
          </div>
        </FileUpload>
        <p className="text-xs text-on-surface-variant mt-3">
          ※ OCR処理は今後のアップデートで対応予定です。現在は手動入力をご利用ください。
        </p>
      </Modal>
    </div>
  );
}
