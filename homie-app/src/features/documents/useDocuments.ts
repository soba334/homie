import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useMemo } from 'react';
import { api } from '@/utils/api';
import { queryKeys } from '@/lib/queryKeys';
import { DocumentListSchema, DocumentSchema } from '@/lib/schemas';
import type { Document } from '@/types';

const categoryLabels: Record<string, string> = {
  contract: '契約書',
  insurance: '保険',
  utility: '公共料金',
  other: 'その他',
};

export function useDocuments() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');

  const buildPath = (search?: string) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    const query = params.toString();
    return `/api/v1/documents${query ? `?${query}` : ''}`;
  };

  const documentsQuery = useQuery({
    queryKey: [...queryKeys.documents.list(), searchQuery],
    queryFn: () =>
      api.getWithSchema(buildPath(searchQuery || undefined), DocumentListSchema),
  });

  const documents = documentsQuery.data ?? [];
  const loading = documentsQuery.isLoading;

  const addDocumentMutation = useMutation({
    mutationFn: (doc: {
      title: string;
      category: string;
      fileUrl: string;
      fileType: string;
      tags: string[];
      note?: string;
    }) => api.postWithSchema('/api/v1/documents', DocumentSchema, doc),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
    },
  });

  const updateDocumentMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Document> }) =>
      api.putWithSchema(`/api/v1/documents/${id}`, DocumentSchema, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
    },
  });

  const addDocument = useCallback(async (doc: {
    title: string;
    category: string;
    fileUrl: string;
    fileType: string;
    tags: string[];
    note?: string;
  }): Promise<Document> => {
    return addDocumentMutation.mutateAsync(doc);
  }, [addDocumentMutation]);

  const updateDocument = useCallback(async (id: string, updates: Partial<Document>) => {
    await updateDocumentMutation.mutateAsync({ id, updates });
  }, [updateDocumentMutation]);

  const deleteDocument = useCallback(async (id: string) => {
    await deleteDocumentMutation.mutateAsync(id);
  }, [deleteDocumentMutation]);

  const searchDocuments = useCallback(async (query: string) => {
    setSearchQuery(query.trim() ? query : '');
  }, []);

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
