import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/utils/api';
import type { GarbageCategory, GarbageSchedule } from '@/types';

export function useGarbage() {
  const [categories, setCategories] = useState<GarbageCategory[]>([]);
  const [schedules, setSchedules] = useState<GarbageSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = useCallback(async () => {
    const data = await api.get<GarbageCategory[]>('/api/v1/garbage/categories');
    setCategories(data);
  }, []);

  const fetchSchedules = useCallback(async () => {
    const data = await api.get<GarbageSchedule[]>('/api/v1/garbage/schedules');
    setSchedules(data);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchCategories(), fetchSchedules()])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchCategories, fetchSchedules]);

  const addCategory = useCallback(async (category: {
    name: string;
    color: string;
    description: string;
    items: string[];
  }) => {
    const created = await api.post<GarbageCategory>('/api/v1/garbage/categories', category);
    setCategories((prev) => [...prev, created]);
  }, []);

  const updateCategory = useCallback(async (id: string, updates: Partial<GarbageCategory>) => {
    const updated = await api.put<GarbageCategory>(`/api/v1/garbage/categories/${id}`, updates);
    setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
  }, []);

  const deleteCategory = useCallback(async (id: string) => {
    await api.delete(`/api/v1/garbage/categories/${id}`);
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setSchedules((prev) => prev.filter((s) => s.categoryId !== id));
  }, []);

  const addSchedule = useCallback(async (schedule: {
    categoryId: string;
    dayOfWeek: number[];
    weekOfMonth?: number[];
    location?: string;
    note?: string;
  }) => {
    const created = await api.post<GarbageSchedule>('/api/v1/garbage/schedules', schedule);
    setSchedules((prev) => [...prev, created]);
  }, []);

  const updateSchedule = useCallback(async (id: string, updates: Partial<GarbageSchedule>) => {
    const updated = await api.put<GarbageSchedule>(`/api/v1/garbage/schedules/${id}`, updates);
    setSchedules((prev) => prev.map((s) => (s.id === id ? updated : s)));
  }, []);

  const deleteSchedule = useCallback(async (id: string) => {
    await api.delete(`/api/v1/garbage/schedules/${id}`);
    setSchedules((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const deleteAll = useCallback(async () => {
    await api.delete('/api/v1/garbage/all');
    setCategories([]);
    setSchedules([]);
  }, []);

  const searchItems = useCallback((query: string) => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return categories.filter(
      (c) => c.name.toLowerCase().includes(q) || c.items.some((item) => item.toLowerCase().includes(q)),
    );
  }, [categories]);

  const todaySchedules = useMemo(() => {
    const today = new Date().getDay();
    return schedules.filter((s) => s.dayOfWeek.includes(today));
  }, [schedules]);

  const refetch = useCallback(async () => {
    await Promise.all([fetchCategories(), fetchSchedules()]);
  }, [fetchCategories, fetchSchedules]);

  return {
    categories,
    schedules,
    loading,
    addCategory,
    updateCategory,
    deleteCategory,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    deleteAll,
    searchItems,
    todaySchedules,
    refetch,
  };
}
