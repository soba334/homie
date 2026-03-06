import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/utils/api';
import type { Document } from '@/types';

const categoryLabels: Record<string, string> = {
  contract: '契約書',
  insurance: '保険',
  utility: '公共料金',
  other: 'その他',
};

export function useDocuments() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = useCallback(async (search?: string, category?: string) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (category) params.set('category', category);
    const query = params.toString();
    const data = await api.get<Document[]>(`/api/v1/documents${query ? `?${query}` : ''}`);
    setDocuments(data);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchDocuments()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchDocuments]);

  const addDocument = useCallback(async (doc: {
    title: string;
    category: string;
    fileUrl: string;
    fileType: string;
    tags: string[];
    note?: string;
  }) => {
    const created = await api.post<Document>('/api/v1/documents', doc);
    setDocuments((prev) => [created, ...prev]);
  }, []);

  const updateDocument = useCallback(async (id: string, updates: Partial<Document>) => {
    const updated = await api.put<Document>(`/api/v1/documents/${id}`, updates);
    setDocuments((prev) => prev.map((d) => (d.id === id ? updated : d)));
  }, []);

  const deleteDocument = useCallback(async (id: string) => {
    await api.delete(`/api/v1/documents/${id}`);
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const searchDocuments = useCallback(async (query: string) => {
    if (!query.trim()) {
      await fetchDocuments();
      return;
    }
    setLoading(true);
    try {
      await fetchDocuments(query);
    } finally {
      setLoading(false);
    }
  }, [fetchDocuments]);

  const groupedByCategory = useMemo(() => {
    const groups: Record<string, Document[]> = {};
    for (const doc of documents) {
      const label = categoryLabels[doc.category] || doc.category;
      if (!groups[label]) groups[label] = [];
      groups[label].push(doc);
    }
    return groups;
  }, [documents]);

  return {
    documents,
    loading,
    addDocument,
    updateDocument,
    deleteDocument,
    searchDocuments,
    groupedByCategory,
    categoryLabels,
  };
}
