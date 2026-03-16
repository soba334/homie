import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useCallback } from 'react';
import { api } from '@/utils/api';
import { queryKeys } from '@/lib/queryKeys';
import {
  CalendarEventListSchema,
  CalendarEventSchema,
} from '@/lib/schemas';
import type { CalendarEvent } from '@/lib/schemas';

export function useCalendar() {
  const queryClient = useQueryClient();
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);

  const eventsQuery = useQuery({
    queryKey: queryKeys.calendar.events(range?.start, range?.end),
    queryFn: () =>
      api.getWithSchema(
        `/api/v1/calendar/events?start=${range!.start}&end=${range!.end}`,
        CalendarEventListSchema,
      ),
    enabled: range !== null,
  });

  const fetchEvents = useCallback((start: string, end: string) => {
    setRange({ start, end });
  }, []);

  const refetch = useCallback(async () => {
    await eventsQuery.refetch();
  }, [eventsQuery]);

  const addEventMutation = useMutation({
    mutationFn: (event: {
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
    }) => api.postWithSchema('/api/v1/calendar/events', CalendarEventSchema, event),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<CalendarEvent> }) =>
      api.putWithSchema(`/api/v1/calendar/events/${id}`, CalendarEventSchema, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/calendar/events/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all });
    },
  });

  const toggleTaskMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/calendar/events/${id}/toggle`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all });
    },
  });

  const events = eventsQuery.data ?? [];
  const loading = eventsQuery.isLoading;

  const getEventsForDate = useCallback(
    (dateStr: string) => {
      return events.filter((e) => e.date === dateStr);
    },
    [events],
  );

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
    addEvent: (event: Parameters<typeof addEventMutation.mutateAsync>[0]) =>
      addEventMutation.mutateAsync(event),
    updateEvent: (id: string, updates: Partial<CalendarEvent>) =>
      updateEventMutation.mutateAsync({ id, updates }),
    deleteEvent: (id: string) => deleteEventMutation.mutateAsync(id),
    toggleTask: (id: string) => toggleTaskMutation.mutateAsync(id),
    getEventsForDate,
    upcomingTasks,
    refetch,
  };
}
