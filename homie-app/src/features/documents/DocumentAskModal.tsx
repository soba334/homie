import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Modal, Button, Spinner } from '@/components/ui';
import { api } from '@/utils/api';

interface DocumentAskModalProps {
  open: boolean;
  onClose: () => void;
}

interface Source {
  documentId: string;
  title: string;
  snippet: string;
}

interface Conversation {
  question: string;
  answer: string;
  sources: Source[];
}

interface AskResponse {
  answer: string;
  sources: Source[];
}

export function DocumentAskModal({ open, onClose }: DocumentAskModalProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversations, loading]);

  const handleSubmit = async () => {
    const trimmed = query.trim();
    if (!trimmed || loading) return;

    setQuery('');
    setLoading(true);

    try {
      const data = await api.post<AskResponse>('/api/v1/documents/ask', { query: trimmed });
      setConversations((prev) => [
        ...prev,
        { question: trimmed, answer: data.answer, sources: data.sources },
      ]);
    } catch {
      setConversations((prev) => [
        ...prev,
        { question: trimmed, answer: 'エラーが発生しました。もう一度お試しください。', sources: [] },
      ]);
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
      setConversations([]);
      onClose();
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="資料に質問">
      <div className="flex flex-col" style={{ minHeight: '360px' }}>
        {/* Conversation area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 mb-4">
          {conversations.length === 0 && !loading && (
            <div className="text-center py-8">
              <p className="text-on-surface-variant text-sm whitespace-pre-line">
                {'アップロードした資料の内容について質問できます。\n例: 「火災保険の連絡先は?」「契約の更新日はいつ?」'}
              </p>
            </div>
          )}

          <AnimatePresence mode="popLayout">
            {conversations.map((conv, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="space-y-3"
              >
                {/* User question */}
                <div className="flex justify-end">
                  <div className="bg-primary/10 text-on-surface rounded-2xl rounded-tr-sm px-4 py-2 max-w-[80%]">
                    <p className="text-sm">{conv.question}</p>
                  </div>
                </div>

                {/* AI answer */}
                <div className="flex justify-start">
                  <div className="bg-surface-container rounded-2xl rounded-tl-sm px-4 py-3 max-w-[90%] space-y-2">
                    <p className="text-sm whitespace-pre-wrap">{conv.answer}</p>
                    {conv.sources.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1 border-t border-outline/20">
                        {conv.sources.map((src, j) => (
                          <span
                            key={j}
                            className="inline-flex items-center gap-1 text-xs bg-surface px-2 py-0.5 rounded-full text-on-surface-variant"
                          >
                            <span>{src.title}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="bg-surface-container rounded-2xl rounded-tl-sm px-4 py-3">
                <Spinner />
              </div>
            </motion.div>
          )}
        </div>

        {/* Input area */}
        <div className="flex gap-2 pt-2 border-t border-outline/30">
          <input
            type="text"
            className="flex-1 px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="資料について質問..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <Button
            size="md"
            onClick={handleSubmit}
            disabled={loading || !query.trim()}
          >
            <Send size={16} className="inline mr-1" />
            質問する
          </Button>
        </div>
      </div>
    </Modal>
  );
}
