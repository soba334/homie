import { useState, useCallback } from 'react';
import { FileText, Plus, Trash2, ExternalLink, MessageCircleQuestionMark, ScanText } from 'lucide-react';
import { Card, Button, SearchInput, Modal, Spinner, useToast } from '@/components/ui';
import { useDocuments } from './useDocuments';
import { DocumentForm } from './DocumentForm';
import { DocumentAskModal } from './DocumentAskModal';
import { format } from 'date-fns';
import { api } from '@/utils/api';
import type { Document } from '@/types';

export function DocumentsPage() {
  const { documents, loading, searchDocuments, groupedByCategory, deleteDocument } = useDocuments();
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showAskModal, setShowAskModal] = useState(false);

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    searchDocuments(value);
  }, [searchDocuments]);

  const displayGrouped = !query;

  if (loading && documents.length === 0) {
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
          <FileText size={24} />
          書類管理
        </h1>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setShowAskModal(true)}>
            <MessageCircleQuestionMark size={16} className="inline mr-1" />
            資料に質問
          </Button>
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus size={16} className="inline mr-1" />
            書類追加
          </Button>
        </div>
      </div>

      <SearchInput
        placeholder="書類を検索（タイトル、タグ、メモ）"
        value={query}
        onChange={handleSearch}
      />

      {displayGrouped ? (
        Object.keys(groupedByCategory).length === 0 ? (
          <Card>
            <p className="text-center text-on-surface-variant py-8">
              まだ書類が登録されていません
            </p>
          </Card>
        ) : (
          Object.entries(groupedByCategory).map(([cat, docs]) => (
            <div key={cat}>
              <h2 className="font-bold text-lg mb-2">{cat}</h2>
              <div className="space-y-2">
                {docs.map((doc) => (
                  <DocumentCard key={doc.id} doc={doc} onDelete={() => deleteDocument(doc.id)} />
                ))}
              </div>
            </div>
          ))
        )
      ) : (
        <div className="space-y-2">
          {documents.length === 0 ? (
            <Card>
              <p className="text-center text-on-surface-variant py-4">該当する書類がありません</p>
            </Card>
          ) : (
            documents.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} onDelete={() => deleteDocument(doc.id)} />
            ))
          )}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="書類を追加">
        <DocumentForm onSubmit={() => setShowForm(false)} />
      </Modal>

      <DocumentAskModal open={showAskModal} onClose={() => setShowAskModal(false)} />
    </div>
  );
}

function DocumentCard({ doc, onDelete }: { doc: Document; onDelete: () => void }) {
  const { toast } = useToast();
  const [extracting, setExtracting] = useState(false);

  const handleExtract = async () => {
    setExtracting(true);
    try {
      await api.post(`/api/v1/documents/${doc.id}/extract-text`, {});
      toast('テキストを抽出しました');
    } catch {
      toast('テキスト抽出に失敗しました', 'error');
    } finally {
      setExtracting(false);
    }
  };

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-primary" />
            <span className="font-medium">{doc.title}</span>
          </div>
          {doc.note && (
            <p className="text-sm text-on-surface-variant mt-1">{doc.note}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-on-surface-variant">
              {format(new Date(doc.uploadedAt), 'yyyy/M/d')}
            </span>
            {doc.tags.map((tag) => (
              <span key={tag} className="text-xs px-2 py-0.5 bg-surface-container rounded-full">{tag}</span>
            ))}
          </div>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={handleExtract} disabled={extracting}>
            <ScanText size={14} />
          </Button>
          {doc.fileUrl && (
            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-surface-container rounded-lg">
              <ExternalLink size={14} />
            </a>
          )}
          <Button size="sm" variant="ghost" onClick={onDelete}>
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
    </Card>
  );
}
