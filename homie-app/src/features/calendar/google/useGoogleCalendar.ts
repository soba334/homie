import { useState, useEffect, useCallback } from 'react';
import { api, API_BASE } from '@/utils/api';
import type { GoogleCalendarStatus, GoogleCalendarInfo, SyncResult } from '@/types';

export function useGoogleCalendar() {
  const [status, setStatus] = useState<GoogleCalendarStatus>({ connected: false });
  const [calendars, setCalendars] = useState<GoogleCalendarInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<GoogleCalendarStatus>('/api/v1/calendar/google/status')
      .then(setStatus)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fetchCalendars = useCallback(async () => {
    try {
      const data = await api.get<GoogleCalendarInfo[]>('/api/v1/calendar/google/calendars');
      setCalendars(data);
    } catch {
      /* ignore */
    }
  }, []);

  const updateCalendarSelections = useCallback(async (items: { id: string; selected: boolean }[]) => {
    setError(null);
    try {
      await api.put('/api/v1/calendar/google/calendars', { calendars: items });
      setCalendars((prev) =>
        prev.map((c) => {
          const update = items.find((i) => i.id === c.id);
          return update ? { ...c, selected: update.selected } : c;
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新に失敗しました');
    }
  }, []);

  const connect = useCallback(() => {
    window.location.href = `${API_BASE}/api/v1/calendar/google/connect`;
  }, []);

  const disconnect = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await api.post('/api/v1/calendar/google/disconnect');
      setStatus({ connected: false });
      setCalendars([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '切断に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  const sync = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.post<SyncResult>('/api/v1/calendar/google/sync');
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : '同期に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    isConnected: status.connected,
    connectedAt: status.connectedAt,
    calendars,
    loading,
    error,
    connect,
    disconnect,
    sync,
    fetchCalendars,
    updateCalendarSelections,
  };
}
