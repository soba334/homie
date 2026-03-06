import { useState, useEffect, useMemo } from 'react';
import { CalendarDays, Plus, ChevronLeft, ChevronRight, CheckSquare, Square, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, isSameMonth, isSameDay, isToday } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Card, Button, Modal, Spinner } from '@/components/ui';
import { useCalendar } from './useCalendar';
import { useGoogleCalendar } from './google';
import { useAuth } from '@/features/auth/useAuth';
import { CalendarEventForm } from './CalendarEventForm';
import { GoogleCalendarConnect } from './GoogleCalendarConnect';

const EVENT_TYPE_COLORS: Record<string, string> = {
  shared: '#3b82f6',   // 青 - 共通の予定
  personal: '#8b5cf6', // 紫 - 個人の予定
  task: '#f59e0b',     // 黄 - タスク
  garbage: '#22c55e',  // 緑 - ゴミ出し
  google: '#4285f4',   // Google青 - Google Calendar
};

function eventColor(ev: { type: string; color?: string }) {
  return ev.color || EVENT_TYPE_COLORS[ev.type] || '#6366f1';
}

export function CalendarPage() {
  const { user } = useAuth();
  const { events, loading, fetchEvents, toggleTask, deleteEvent } = useCalendar();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // shared/garbage: 誰でも編集可, それ以外: 作成者のみ
  const canEdit = (ev: { type: string; createdBy?: string }) =>
    ev.type === 'shared' || ev.type === 'garbage' || !ev.createdBy || ev.createdBy === user?.id;
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showForm, setShowForm] = useState(false);

  const google = useGoogleCalendar();

  // Fetch events for the visible range (prev month to next month for overlap)
  useEffect(() => {
    const start = format(startOfMonth(addMonths(currentMonth, -1)), 'yyyy-MM-dd');
    const end = format(endOfMonth(addMonths(currentMonth, 1)), 'yyyy-MM-dd');
    fetchEvents(start, end);
  }, [currentMonth, fetchEvents]);

  // Filter events by Google calendar selection (display only)
  const hiddenCalendarIds = useMemo(() => {
    return new Set(
      google.calendars.filter((c) => !c.selected).map((c) => c.id),
    );
  }, [google.calendars]);

  const filteredEvents = useMemo(() => {
    if (hiddenCalendarIds.size === 0) return events;
    return events.filter((ev) => {
      if (!ev.googleCalendarId) return true;
      return !hiddenCalendarIds.has(ev.googleCalendarId);
    });
  }, [events, hiddenCalendarIds]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days: Date[] = [];
  let d = calStart;
  while (d <= calEnd) {
    days.push(d);
    d = addDays(d, 1);
  }

  // Group events by date for efficient lookup
  const eventsByDate = useMemo(() => {
    const map = new Map<string, typeof filteredEvents>();
    for (const ev of filteredEvents) {
      const dateStr = ev.date;
      const existing = map.get(dateStr) || [];
      existing.push(ev);
      map.set(dateStr, existing);
    }
    return map;
  }, [filteredEvents]);

  const getEventsForDate = (date: Date) => {
    return eventsByDate.get(format(date, 'yyyy-MM-dd')) || [];
  };

  const selectedEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  const upcomingTasks = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return filteredEvents
      .filter((e) => e.type === 'task' && !e.completed && e.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredEvents]);

  const handleSync = async () => {
    await google.sync();
    google.fetchCalendars();
    const start = format(startOfMonth(addMonths(currentMonth, -1)), 'yyyy-MM-dd');
    const end = format(endOfMonth(addMonths(currentMonth, 1)), 'yyyy-MM-dd');
    fetchEvents(start, end);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarDays size={24} />
          カレンダー
        </h1>
        <div className="flex gap-2">
          {google.isConnected && (
            <Button size="sm" variant="secondary" onClick={handleSync} disabled={google.loading}>
              <motion.span
                className="inline mr-1"
                animate={google.loading ? { rotate: 360 } : { rotate: 0 }}
                transition={google.loading ? { repeat: Infinity, duration: 1, ease: 'linear' } : { duration: 0 }}
              >
                <RefreshCw size={16} />
              </motion.span>
              同期
            </Button>
          )}
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus size={16} className="inline mr-1" />
            予定追加
          </Button>
        </div>
      </div>

      <GoogleCalendarConnect
        isConnected={google.isConnected}
        loading={google.loading}
        error={google.error}
        calendars={google.calendars}
        onConnect={google.connect}
        onDisconnect={google.disconnect}
        onFetchCalendars={google.fetchCalendars}
        onUpdateSelections={google.updateCalendarSelections}
      />

      <Card>
        <div className="flex items-center justify-between mb-4">
          <button className="p-2 hover:bg-surface-container rounded-lg cursor-pointer" onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}>
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">
              {format(currentMonth, 'yyyy年M月', { locale: ja })}
            </h2>
            {loading && <Spinner size={16} />}
          </div>
          <button className="p-2 hover:bg-surface-container rounded-lg cursor-pointer" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="grid grid-cols-7 text-center text-sm mb-1">
          {['日', '月', '火', '水', '木', '金', '土'].map((d) => (
            <div key={d} className={`py-1 font-medium ${d === '日' ? 'text-danger' : d === '土' ? 'text-blue-500' : 'text-on-surface-variant'}`}>
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px bg-outline rounded-lg overflow-hidden">
          {days.map((day) => {
            const dayEvents = getEventsForDate(day);
            const inMonth = isSameMonth(day, currentMonth);
            const selected = selectedDate && isSameDay(day, selectedDate);
            const today = isToday(day);
            return (
              <button
                key={day.toISOString()}
                className={`p-1 min-h-16 text-left cursor-pointer transition-colors
                  ${inMonth ? 'bg-surface' : 'bg-surface-dim'}
                  ${selected ? 'ring-2 ring-primary ring-inset' : ''}
                  ${today ? 'bg-primary/5' : ''}
                  hover:bg-surface-container`}
                onClick={() => setSelectedDate(day)}
              >
                <span className={`text-xs font-medium block mb-0.5
                  ${!inMonth ? 'text-on-surface-variant/40' : ''}
                  ${today ? 'text-primary font-bold' : ''}
                  ${day.getDay() === 0 ? 'text-danger' : day.getDay() === 6 ? 'text-blue-500' : ''}`}>
                  {format(day, 'd')}
                </span>
                <div className="flex flex-wrap gap-0.5">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <span
                      key={ev.id + (ev.occurrenceDate || '')}
                      className="w-1.5 h-1.5 rounded-full inline-block"
                      style={{ backgroundColor: eventColor(ev) }}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {selectedDate && (
        <Card>
          <h2 className="font-bold mb-3">
            {format(selectedDate, 'M月d日(E)', { locale: ja })}の予定
          </h2>
          {selectedEvents.length === 0 ? (
            <p className="text-on-surface-variant text-sm">予定はありません</p>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map((ev) => (
                <div key={ev.id + (ev.occurrenceDate || '')} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: eventColor(ev) }} />
                    <span className={`text-sm ${ev.completed ? 'line-through text-on-surface-variant' : ''}`}>{ev.title}</span>
                    {ev.type === 'google' || ev.googleEventId ? (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Google</span>
                    ) : ev.type === 'garbage' ? (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">ゴミ</span>
                    ) : ev.type === 'task' ? (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">タスク</span>
                    ) : ev.type === 'personal' ? (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">個人</span>
                    ) : ev.type === 'shared' ? (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">共通</span>
                    ) : null}
                    {ev.type === 'task' && canEdit(ev) && (
                      <button className="cursor-pointer" onClick={() => toggleTask(ev.id)}>
                        {ev.completed ? <CheckSquare size={16} className="text-success" /> : <Square size={16} className="text-on-surface-variant" />}
                      </button>
                    )}
                    {ev.type === 'task' && !canEdit(ev) && (
                      ev.completed ? <CheckSquare size={16} className="text-success" /> : <Square size={16} className="text-on-surface-variant" />
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!ev.garbageScheduleId && !ev.isRecurrenceInstance && canEdit(ev) && (
                      <button className="text-danger text-xs cursor-pointer" onClick={() => deleteEvent(ev.id)}>削除</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {upcomingTasks.length > 0 && (
        <Card>
          <h2 className="font-bold mb-3">未完了タスク</h2>
          <div className="space-y-2">
            {upcomingTasks.map((task) => (
              <div key={task.id} className="flex items-center gap-2">
                {canEdit(task) ? (
                  <button className="cursor-pointer" onClick={() => toggleTask(task.id)}>
                    <Square size={16} className="text-on-surface-variant" />
                  </button>
                ) : (
                  <Square size={16} className="text-on-surface-variant" />
                )}
                <span className="text-sm flex-1">{task.title}</span>
                <span className="text-xs text-on-surface-variant">{format(new Date(task.date), 'M/d')}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="予定を追加">
        <CalendarEventForm
          initialDate={selectedDate || new Date()}
          onSubmit={() => setShowForm(false)}
        />
      </Modal>
    </div>
  );
}
