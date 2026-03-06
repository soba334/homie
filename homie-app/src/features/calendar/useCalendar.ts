import { useState, useCallback, useMemo, useRef } from 'react';
import { api } from '@/utils/api';
import type { CalendarEvent } from '@/types';

export function useCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const rangeRef = useRef<{ start: string; end: string } | null>(null);

  const fetchEvents = useCallback(async (start: string, end: string) => {
    rangeRef.current = { start, end };
    setLoading(true);
    try {
      const data = await api.get<CalendarEvent[]>(
        `/api/v1/calendar/events?start=${start}&end=${end}`,
      );
      setEvents(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(() => {
    if (rangeRef.current) {
      fetchEvents(rangeRef.current.start, rangeRef.current.end);
    }
  }, [fetchEvents]);

  const addEvent = useCallback(async (event: {
    title: string;
    date: string;
    endDate?: string;
    allDay: boolean;
    type: string;
    assignee?: string;
    completed?: boolean;
    color?: string;
    description?: string;
    recurrenceRule?: string;
    recurrenceInterval?: number;
    recurrenceEnd?: string;
  }) => {
    await api.post<CalendarEvent>('/api/v1/calendar/events', event);
    refetch();
  }, [refetch]);

  const updateEvent = useCallback(async (id: string, updates: Partial<CalendarEvent>) => {
    await api.put<CalendarEvent>(`/api/v1/calendar/events/${id}`, updates);
    refetch();
  }, [refetch]);

  const deleteEvent = useCallback(async (id: string) => {
    await api.delete(`/api/v1/calendar/events/${id}`);
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const toggleTask = useCallback(async (id: string) => {
    await api.patch(`/api/v1/calendar/events/${id}/toggle`);
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, completed: !e.completed } : e)),
    );
  }, []);

  const getEventsForDate = useCallback((dateStr: string) => {
    return events.filter((e) => e.date === dateStr);
  }, [events]);

  const upcomingTasks = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return events
      .filter((e) => e.type === 'task' && !e.completed && e.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [events]);

  return {
    events,
    loading,
    fetchEvents,
    addEvent,
    updateEvent,
    deleteEvent,
    toggleTask,
    getEventsForDate,
    upcomingTasks,
  };
}
