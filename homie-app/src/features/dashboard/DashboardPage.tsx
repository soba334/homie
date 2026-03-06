import { useEffect, useMemo } from 'react';
import { Trash2, Wallet, CalendarDays, FileText, Landmark, CreditCard, PiggyBank, Target, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import { motion } from 'motion/react';
import { Card } from '@/components/ui';
import { useGarbage } from '@/features/garbage';
import { useBudget } from '@/features/budget';
import { useSubscriptions } from '@/features/budget/useSubscriptions';
import { useMonthlyBudgets } from '@/features/monthly-budgets/useMonthlyBudgets';
import { useSavings } from '@/features/savings/useSavings';
import { useCalendar } from '@/features/calendar';
import { useAccounts } from '@/features/accounts';
import { InvitePartner } from '@/features/auth/InvitePartner';

export function DashboardPage() {
  const { categories, todaySchedules, tomorrowSchedules } = useGarbage();
  const yearMonth = format(new Date(), 'yyyy-MM');
  const { monthlyTotal } = useBudget(yearMonth);
  const { subscriptions } = useSubscriptions();
  const { budgets: monthlyBudgets } = useMonthlyBudgets(yearMonth);
  const { goals: savingsGoals } = useSavings();
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

  // Budget aggregation
  const totalBudget = monthlyBudgets.reduce((s, b) => s + b.budgetAmount, 0);
  const budgetRemaining = totalBudget - monthlyTotal;
  const budgetUsageRate = totalBudget > 0 ? Math.min((monthlyTotal / totalBudget) * 100, 100) : 0;

  // Categories sorted by usage rate (highest first), show top 3 that are over 60%
  const warningCategories = useMemo(() => {
    return monthlyBudgets
      .filter((b) => b.usageRate >= 0.6)
      .sort((a, b) => b.usageRate - a.usageRate)
      .slice(0, 3);
  }, [monthlyBudgets]);

  // Savings aggregation
  const totalSavingsTarget = savingsGoals.reduce((s, g) => s + g.targetAmount, 0);
  const totalSavingsCurrent = savingsGoals.reduce((s, g) => s + g.currentAmount, 0);
  const savingsOverallRate = totalSavingsTarget > 0 ? Math.min((totalSavingsCurrent / totalSavingsTarget) * 100, 100) : 0;

  // Days remaining in month
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = daysInMonth - now.getDate();
  const dailyBudget = daysRemaining > 0 && budgetRemaining > 0 ? Math.floor(budgetRemaining / daysRemaining) : 0;

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

      {/* Budget Overview */}
      <Link to="/budget">
        <Card className="hover:shadow-md">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold flex items-center gap-2">
              <Wallet size={18} className="text-accent" />
              今月の家計
            </h2>
            <span className="text-xs text-on-surface-variant">
              残り{daysRemaining}日
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="text-center">
              <p className="text-xs text-on-surface-variant">支出</p>
              <p className="text-lg font-bold">{monthlyTotal.toLocaleString()}<span className="text-xs font-normal">円</span></p>
            </div>
            <div className="text-center">
              <p className="text-xs text-on-surface-variant">
                {totalBudget > 0 ? '予算残' : '予算'}
              </p>
              {totalBudget > 0 ? (
                <p className={`text-lg font-bold ${budgetRemaining < 0 ? 'text-red-600' : ''}`}>
                  {budgetRemaining.toLocaleString()}<span className="text-xs font-normal">円</span>
                </p>
              ) : (
                <p className="text-sm text-on-surface-variant mt-1">未設定</p>
              )}
            </div>
            <div className="text-center">
              <p className="text-xs text-on-surface-variant">1日あたり</p>
              {dailyBudget > 0 ? (
                <p className="text-lg font-bold">{dailyBudget.toLocaleString()}<span className="text-xs font-normal">円</span></p>
              ) : (
                <p className="text-sm text-on-surface-variant mt-1">-</p>
              )}
            </div>
          </div>
          {totalBudget > 0 && (
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-on-surface-variant">消化率</span>
                <span className={`font-medium ${budgetRemaining < 0 ? 'text-red-600' : ''}`}>
                  {Math.round(budgetUsageRate)}%
                </span>
              </div>
              <div className="w-full bg-surface-container rounded-full h-2">
                <motion.div
                  className={`h-2 rounded-full ${budgetRemaining < 0 ? 'bg-red-500' : budgetUsageRate > 80 ? 'bg-amber-500' : 'bg-primary'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${budgetUsageRate}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>
            </div>
          )}
        </Card>
      </Link>

      {/* Budget category warnings */}
      {warningCategories.length > 0 && (
        <Card>
          <h2 className="font-bold text-sm flex items-center gap-1.5 mb-2">
            <Target size={16} />
            予算の消化状況
          </h2>
          <div className="space-y-2">
            {warningCategories.map((item) => {
              const rate = Math.min(item.usageRate * 100, 100);
              return (
                <div key={item.category}>
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{item.category}</span>
                      {item.overBudget && <AlertTriangle size={12} className="text-red-500" />}
                    </div>
                    <span className={`text-xs font-medium ${item.overBudget ? 'text-red-600' : item.usageRate >= 0.8 ? 'text-amber-600' : 'text-on-surface-variant'}`}>
                      {item.actualAmount.toLocaleString()} / {item.budgetAmount.toLocaleString()}円
                    </span>
                  </div>
                  <div className="w-full bg-surface-container rounded-full h-1.5">
                    <motion.div
                      className={`h-1.5 rounded-full ${item.overBudget ? 'bg-red-500' : item.usageRate >= 0.8 ? 'bg-amber-500' : 'bg-primary'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${rate}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-3">
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

        <Link to="/savings">
          <Card className="hover:shadow-md">
            <div className="flex items-center gap-3">
              <PiggyBank size={20} className="text-primary" />
              <div>
                <p className="text-sm text-on-surface-variant">貯蓄進捗</p>
                <p className="text-xl font-bold">
                  {savingsGoals.length > 0 ? `${Math.round(savingsOverallRate)}%` : '-'}
                </p>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      {/* Savings Goals */}
      {savingsGoals.length > 0 && (
        <Link to="/savings">
          <Card className="hover:shadow-md">
            <h2 className="font-bold text-sm flex items-center gap-1.5 mb-3">
              <PiggyBank size={16} />
              貯蓄目標
            </h2>
            <div className="space-y-2.5">
              {savingsGoals.map((goal) => {
                const rate = Math.min(goal.progressRate, 100);
                return (
                  <div key={goal.id}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm">{goal.name}</span>
                      <span className="text-xs font-medium">{Math.round(goal.progressRate)}%</span>
                    </div>
                    <div className="w-full bg-surface-container rounded-full h-1.5">
                      <motion.div
                        className="h-1.5 rounded-full bg-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${rate}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-on-surface-variant mt-0.5">
                      <span>{goal.currentAmount.toLocaleString()}円 / {goal.targetAmount.toLocaleString()}円</span>
                      {goal.monthlyRequired != null && goal.monthlyRequired > 0 && (
                        <span>月{goal.monthlyRequired.toLocaleString()}円</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </Link>
      )}

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
