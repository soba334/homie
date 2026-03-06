import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Card, Button } from '@/components/ui';
import type { GoogleCalendarInfo } from '@/types';

interface Props {
  isConnected: boolean;
  loading: boolean;
  error: string | null;
  calendars: GoogleCalendarInfo[];
  onConnect: () => void;
  onDisconnect: () => void;
  onFetchCalendars: () => void;
  onUpdateSelections: (items: { id: string; selected: boolean }[]) => void;
}

export function GoogleCalendarConnect({
  isConnected,
  loading,
  error,
  calendars,
  onConnect,
  onDisconnect,
  onFetchCalendars,
  onUpdateSelections,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (isConnected && expanded && calendars.length === 0) {
      onFetchCalendars();
    }
  }, [isConnected, expanded, calendars.length, onFetchCalendars]);

  const handleToggle = (cal: GoogleCalendarInfo) => {
    onUpdateSelections([{ id: cal.id, selected: !cal.selected }]);
  };

  return (
    <Card className={isConnected ? 'border-blue-200 bg-blue-50/50' : ''}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 24 24" width="20" height="20" className="shrink-0">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <div>
            <p className="text-sm font-medium">
              {isConnected ? 'Google Calendar 連携中' : 'Google Calendar'}
            </p>
            {!isConnected && (
              <p className="text-xs text-on-surface-variant">連携するとGoogleカレンダーの予定が表示されます</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isConnected && (
            <button
              className="p-1 hover:bg-surface-container rounded cursor-pointer"
              onClick={() => setExpanded(!expanded)}
              title="カレンダー選択"
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}
          {isConnected ? (
            <Button size="sm" variant="ghost" onClick={onDisconnect} disabled={loading}>
              連携解除
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={onConnect}>
              連携する
            </Button>
          )}
        </div>
      </div>

      {isConnected && expanded && (
        <div className="mt-3 pt-3 border-t border-outline/20 space-y-1">
          <p className="text-xs text-on-surface-variant mb-2">同期するカレンダーを選択</p>
          {calendars.length === 0 ? (
            <p className="text-xs text-on-surface-variant">読み込み中...</p>
          ) : (
            calendars.map((cal) => (
              <label key={cal.id} className="flex items-center gap-2 py-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cal.selected}
                  onChange={() => handleToggle(cal)}
                  className="rounded accent-primary"
                />
                <span
                  className="w-3 h-3 rounded-sm shrink-0"
                  style={{ backgroundColor: cal.backgroundColor || '#4285f4' }}
                />
                <span className="text-sm truncate">
                  {cal.summary || '(名前なし)'}
                  {cal.primary && <span className="text-xs text-on-surface-variant ml-1">(メイン)</span>}
                </span>
              </label>
            ))
          )}
        </div>
      )}

      {error && <p className="text-xs text-danger mt-2">{error}</p>}
    </Card>
  );
}
