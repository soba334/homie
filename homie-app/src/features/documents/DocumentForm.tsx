import { useState } from 'react';
import { Button, FileUpload } from '@/components/ui';
import { useDocuments } from './useDocuments';
import { api } from '@/utils/api';

const CATEGORIES = [
  { value: 'contract', label: '契約書' },
  { value: 'insurance', label: '保険' },
  { value: 'utility', label: '公共料金' },
  { value: 'other', label: 'その他' },
];

interface Props {
  onSubmit: () => void;
}

export function DocumentForm({ onSubmit }: Props) {
  const { addDocument } = useDocuments();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('contract');
  const [tagsText, setTagsText] = useState('');
  const [note, setNote] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [fileType, setFileType] = useState('pdf');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileSelect(files: File[]) {
    const file = files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    setFileType(file.type.startsWith('image/') ? 'image' : 'pdf');
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await addDocument({
        title: title.trim(),
        category,
        fileUrl,
        fileType,
        tags: tagsText.split(/[,、\n]/).map((s) => s.trim()).filter(Boolean),
        note: note.trim() || undefined,
      });
      // Trigger text extraction in background (silent fail)
      api.post(`/api/v1/documents/${created.id}/extract-text`, {}).catch(() => {});
      onSubmit();
    } catch (err) {
      setError(err instanceof Error ? err.message : '追加に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FileUpload accept="image/*,.pdf" onFileSelect={handleFileSelect}>
        {fileUrl ? (
          <p className="text-sm text-success font-medium">ファイルが選択されました</p>
        ) : undefined}
      </FileUpload>
      <div>
        <label className="block text-sm font-medium mb-1">タイトル *</label>
        <input
          className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例: 賃貸契約書"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">カテゴリ</label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              className={`px-3 py-1.5 rounded-full text-sm cursor-pointer transition-colors
                ${category === cat.value ? 'bg-primary text-white' : 'bg-surface-container hover:bg-outline'}`}
              onClick={() => setCategory(cat.value)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">タグ（カンマ区切り）</label>
        <input
          className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          placeholder="例: 賃貸、不動産、2024年"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">メモ</label>
        <textarea
          className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="契約期間や備考など"
        />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? '追加中...' : '追加する'}
      </Button>
    </form>
  );
}
