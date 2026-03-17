import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { api } from '@/utils/api';
import { queryKeys } from '@/lib/queryKeys';
import {
  GarbageCategoryListSchema,
  GarbageCategorySchema,
  GarbageScheduleListSchema,
  GarbageScheduleSchema,
} from '@/lib/schemas';
import type { GarbageCategory, GarbageSchedule } from '@/types';

/** ひらがな→カタカナ統一 + lowercase で表記揺れを吸収 */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[\u3041-\u3096]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60),
  );
}

export function useGarbage() {
  const queryClient = useQueryClient();

  const categoriesQuery = useQuery({
    queryKey: queryKeys.garbage.categories(),
    queryFn: () => api.getWithSchema('/api/v1/garbage/categories', GarbageCategoryListSchema),
  });

  const schedulesQuery = useQuery({
    queryKey: queryKeys.garbage.schedules(),
    queryFn: () => api.getWithSchema('/api/v1/garbage/schedules', GarbageScheduleListSchema),
  });

  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const schedules = useMemo(() => schedulesQuery.data ?? [], [schedulesQuery.data]);
  const loading = categoriesQuery.isLoading || schedulesQuery.isLoading;

  const addCategoryMutation = useMutation({
    mutationFn: (category: {
      name: string;
      color: string;
      description: string;
      items: string[];
    }) => api.postWithSchema('/api/v1/garbage/categories', GarbageCategorySchema, category),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.garbage.all });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<GarbageCategory> }) =>
      api.putWithSchema(`/api/v1/garbage/categories/${id}`, GarbageCategorySchema, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.garbage.all });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/garbage/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.garbage.all });
    },
  });

  const addScheduleMutation = useMutation({
    mutationFn: (schedule: {
      categoryId: string;
      dayOfWeek: number[];
      weekOfMonth?: number[];
      location?: string;
      note?: string;
    }) => api.postWithSchema('/api/v1/garbage/schedules', GarbageScheduleSchema, schedule),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.garbage.all });
    },
  });

  const updateScheduleMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<GarbageSchedule> }) =>
      api.putWithSchema(`/api/v1/garbage/schedules/${id}`, GarbageScheduleSchema, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.garbage.all });
    },
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/garbage/schedules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.garbage.all });
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: () => api.delete('/api/v1/garbage/all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.garbage.all });
    },
  });

  const addCategory = useCallback(async (category: {
    name: string;
    color: string;
    description: string;
    items: string[];
  }) => {
    return addCategoryMutation.mutateAsync(category);
  }, [addCategoryMutation]);

  const updateCategory = useCallback(async (id: string, updates: Partial<GarbageCategory>) => {
    await updateCategoryMutation.mutateAsync({ id, updates });
  }, [updateCategoryMutation]);

  const deleteCategory = useCallback(async (id: string) => {
    await deleteCategoryMutation.mutateAsync(id);
  }, [deleteCategoryMutation]);

  const addSchedule = useCallback(async (schedule: {
    categoryId: string;
    dayOfWeek: number[];
    weekOfMonth?: number[];
    location?: string;
    note?: string;
  }) => {
    await addScheduleMutation.mutateAsync(schedule);
  }, [addScheduleMutation]);

  const updateSchedule = useCallback(async (id: string, updates: Partial<GarbageSchedule>) => {
    await updateScheduleMutation.mutateAsync({ id, updates });
  }, [updateScheduleMutation]);

  const deleteSchedule = useCallback(async (id: string) => {
    await deleteScheduleMutation.mutateAsync(id);
  }, [deleteScheduleMutation]);

  const deleteAll = useCallback(async () => {
    await deleteAllMutation.mutateAsync();
  }, [deleteAllMutation]);

  const searchItems = useCallback((query: string) => {
    if (!query.trim()) return [];
    const q = normalize(query);
    return categories.filter(
      (c) => normalize(c.name).includes(q) || c.items.some((item) => normalize(item).includes(q)),
    );
  }, [categories]);

  const getSchedulesForDate = useCallback(
    (date: Date) => {
      const dow = date.getDay();
      const weekOfMonth = Math.ceil(date.getDate() / 7);
      return schedules.filter(
        (s) =>
          s.dayOfWeek.includes(dow) &&
          (!s.weekOfMonth || s.weekOfMonth.length === 0 || s.weekOfMonth.includes(weekOfMonth)),
      );
    },
    [schedules],
  );

  const todaySchedules = useMemo(() => getSchedulesForDate(new Date()), [getSchedulesForDate]);

  const tomorrowSchedules = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return getSchedulesForDate(tomorrow);
  }, [getSchedulesForDate]);

  const refetch = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.garbage.categories() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.garbage.schedules() }),
    ]);
  }, [queryClient]);

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
    tomorrowSchedules,
    refetch,
  };
}
