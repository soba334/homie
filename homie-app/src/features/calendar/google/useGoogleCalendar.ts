import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { api, API_BASE } from '@/utils/api';
import { queryKeys } from '@/lib/queryKeys';
import {
  GoogleCalendarStatusSchema,
  GoogleCalendarInfoListSchema,
  SyncResultSchema,
} from '@/lib/schemas';

export function useGoogleCalendar() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: queryKeys.calendar.googleStatus(),
    queryFn: () => api.getWithSchema('/api/v1/calendar/google/status', GoogleCalendarStatusSchema),
  });

  const calendarsQuery = useQuery({
    queryKey: queryKeys.calendar.googleCalendars(),
    queryFn: () =>
      api.getWithSchema('/api/v1/calendar/google/calendars', GoogleCalendarInfoListSchema),
    enabled: false,
  });

  const fetchCalendars = useCallback(() => {
    calendarsQuery.refetch();
  }, [calendarsQuery]);

  const updateCalendarSelectionsMutation = useMutation({
    mutationFn: (items: { id: string; selected: boolean }[]) =>
      api.put('/api/v1/calendar/google/calendars', { calendars: items }),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.googleCalendars() });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : '更新に失敗しました');
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => api.post('/api/v1/calendar/google/disconnect'),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.googleStatus() });
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.googleCalendars() });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : '切断に失敗しました');
    },
  });

  const syncMutation = useMutation({
    mutationFn: () =>
      api.postWithSchema('/api/v1/calendar/google/sync', SyncResultSchema),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : '同期に失敗しました');
    },
  });

  const connect = useCallback(() => {
    window.location.href = `${API_BASE}/api/v1/calendar/google/connect`;
  }, []);

  const status = statusQuery.data ?? { connected: false };
  const loading =
    statusQuery.isLoading || disconnectMutation.isPending || syncMutation.isPending;

  return {
    isConnected: status.connected,
    connectedAt: status.connectedAt,
    calendars: calendarsQuery.data ?? [],
    loading,
    error,
    connect,
    disconnect: () => disconnectMutation.mutateAsync(),
    sync: () => syncMutation.mutateAsync(),
    fetchCalendars,
    updateCalendarSelections: (items: { id: string; selected: boolean }[]) =>
      updateCalendarSelectionsMutation.mutateAsync(items),
  };
}
