import { useEffect, useMemo } from 'react';
import { Trash2, Wallet, CalendarDays, FileText, Landmark, CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Card } from '@/components/ui';
import { useGarbage } from '@/features/garbage';
import { useBudget } from '@/features/budget';
import { useSubscriptions } from '@/features/budget/useSubscriptions';
import { useCalendar } from '@/features/calendar';
import { useAccounts } from '@/features/accounts';
import { InvitePartner } from '@/features/auth/InvitePartner';

export function DashboardPage() {
  const { categories, todaySchedules, tomorrowSchedules } = useGarbage();
  const { monthlyTotal } = useBudget();
  const { subscriptions } = useSubscriptions();
  const { events, fetchEvents, loading } = useCalendar();
  const { totalBalance } = useAccounts();

  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    const end = format(addDays(new Date(), 30), 'yyyy-MM-dd');
    fetchEvents(today, end);
  }, [today, fetchEvents]);

  const todayGarbage = todaySchedules
    .map((s) => categories.find((c) => c.id === s.categoryId))
    .filter(Boolean);

  const tomorrowGarbage = tomorrowSchedules
    .map((s) => categories.find((c) => c.id === s.categoryId))
    .filter(Boolean);

  const upcomingPayments = useMemo(() => {
    const weekLater = format(addDays(new Date(), 7), 'yyyy-MM-dd');
    return subscriptions
      .filter((s) => s.isActive && s.nextBillingDate >= today && s.nextBillingDate <= weekLater)
      .sort((a, b) => a.nextBillingDate.localeCompare(b.nextBillingDate));
  }, [subscriptions, today]);

  const todayEvents = events.filter((e) => e.date === today);
  const upcomingTasks = events
    .filter((e) => e.type === 'task' && !e.completed && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        {format(new Date(), 'M月d日(E)', { locale: ja })}
      </h1>

      <InvitePartner />

      {todayGarbage.length > 0 && (
        <Link to="/garbage">
          <Card className="border-primary bg-primary/5 hover:shadow-md">
            <div className="flex items-center gap-3">
              <Trash2 size={20} className="text-primary" />
              <div>
                <p className="font-bold text-primary">今日のゴミ出し</p>
                <div className="flex gap-2 mt-1">
                  {todayGarbage.map((cat) => cat && (
                    <span key={cat.id} className="px-2 py-0.5 rounded-full text-xs text-white" style={{ backgroundColor: cat.color }}>
                      {cat.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </Link>
      )}

      {tomorrowGarbage.length > 0 && (
        <Link to="/garbage">
          <Card className="border-outline hover:shadow-md">
            <div className="flex items-center gap-3">
              <Trash2 size={20} className="text-on-surface-variant" />
              <div>
                <p className="font-medium text-on-surface-variant">明日のゴミ出し</p>
                <div className="flex gap-2 mt-1">
                  {tomorrowGarbage.map((cat) => cat && (
                    <span key={cat.id} className="px-2 py-0.5 rounded-full text-xs text-white" style={{ backgroundColor: cat.color }}>
                      {cat.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Link to="/budget">
          <Card className="hover:shadow-md">
            <div className="flex items-center gap-3">
              <Wallet size={20} className="text-accent" />
              <div>
                <p className="text-sm text-on-surface-variant">今月の支出</p>
                <p className="text-xl font-bold">{monthlyTotal.toLocaleString()}円</p>
              </div>
            </div>
          </Card>
        </Link>

        <Link to="/calendar">
          <Card className="hover:shadow-md">
            <div className="flex items-center gap-3">
              <CalendarDays size={20} className="text-primary" />
              <div>
                <p className="text-sm text-on-surface-variant">今日の予定</p>
                <p className="text-xl font-bold">{loading ? '-' : todayEvents.length}件</p>
              </div>
            </div>
          </Card>
        </Link>

        <Link to="/accounts">
          <Card className="hover:shadow-md">
            <div className="flex items-center gap-3">
              <Landmark size={20} className="text-accent" />
              <div>
                <p className="text-sm text-on-surface-variant">総残高</p>
                <p className="text-xl font-bold">{totalBalance.toLocaleString()}円</p>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      {upcomingPayments.length > 0 && (
        <Card>
          <h2 className="font-bold mb-3 flex items-center gap-2">
            <CreditCard size={18} />
            近日の支払い
          </h2>
          <div className="space-y-2">
            {upcomingPayments.map((sub) => {
              const isToday = sub.nextBillingDate === today;
              return (
                <div key={sub.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {isToday && (
                      <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                    )}
                    <span className={isToday ? 'font-medium' : ''}>{sub.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-on-surface-variant">
                    <span className="font-medium text-on-surface">{sub.amount.toLocaleString()}円</span>
                    <span className="text-xs">
                      {isToday ? '今日' : format(new Date(sub.nextBillingDate), 'M/d')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {upcomingTasks.length > 0 && (
        <Card>
          <h2 className="font-bold mb-3 flex items-center gap-2">
            <FileText size={18} />
            やることリスト
          </h2>
          <div className="space-y-2">
            {upcomingTasks.slice(0, 5).map((task) => (
              <div key={task.id} className="flex items-center justify-between text-sm">
                <span>{task.title}</span>
                <span className="text-on-surface-variant text-xs">
                  {format(new Date(task.date), 'M/d')}
                </span>
              </div>
            ))}
          </div>
          {upcomingTasks.length > 5 && (
            <Link to="/calendar" className="text-primary text-sm mt-2 block">
              +{upcomingTasks.length - 5}件のタスク
            </Link>
          )}
        </Card>
      )}
    </div>
  );
}
