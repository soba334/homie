import { useState } from 'react';
import {
  Briefcase,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Calculator,
} from 'lucide-react';
import { Card, Button, Modal, Spinner, Tabs, TabContent } from '@/components/ui';
import { useEmployments, useShifts, useSalary } from './useEmployment';
import { useAccounts } from '@/features/accounts/useAccounts';
import { useAuth } from '@/features/auth/useAuth';
import { format } from 'date-fns';

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  bank: '銀行',
  credit_card: 'クレカ',
  cash: '現金',
  e_money: '電子マネー',
};

type Tab = 'employments' | 'shifts' | 'salary';

const TABS: { key: Tab; label: string }[] = [
  { key: 'employments', label: '就業先' },
  { key: 'shifts', label: 'シフト' },
  { key: 'salary', label: '給料' },
];

const EMPLOYMENT_TYPES = [
  { value: 'part_time', label: 'パート' },
  { value: 'full_time', label: '正社員' },
] as const;

const TYPE_LABEL: Record<string, string> = {
  part_time: 'パート',
  full_time: '正社員',
};

export function EmploymentPage() {
  const [activeTab, setActiveTab] = useState<Tab>('employments');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Briefcase size={24} />
        就業・給料
      </h1>

      <Tabs tabs={TABS} activeKey={activeTab} onChange={(key) => setActiveTab(key as Tab)} />

      <TabContent activeKey={activeTab}>
        {activeTab === 'employments' && <EmploymentsTab />}
        {activeTab === 'shifts' && <ShiftsTab />}
        {activeTab === 'salary' && <SalaryTab />}
      </TabContent>
    </div>
  );
}

/* ========== Employments Tab ========== */

function EmploymentsTab() {
  const { employments, loading, addEmployment, updateEmployment, deleteEmployment } =
    useEmployments();
  const { user } = useAuth();
  const { accounts } = useAccounts();
  const members = user?.home?.members ?? [];
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [empType, setEmpType] = useState<string>('part_time');
  const [hourlyRate, setHourlyRate] = useState('');
  const [monthlySalary, setMonthlySalary] = useState('');
  const [transportAllowance, setTransportAllowance] = useState('');
  const [userId, setUserId] = useState(user?.id ?? '');
  const [depositAccountId, setDepositAccountId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const memberName = (id: string) => {
    const m = members.find((m) => m.id === id);
    return m ? (m.displayName || m.name) : '';
  };

  function resetForm() {
    setName('');
    setEmpType('part_time');
    setHourlyRate('');
    setMonthlySalary('');
    setTransportAllowance('');
    setUserId(user?.id ?? '');
    setDepositAccountId('');
    setEditingId(null);
    setError(null);
  }

  function openEdit(emp: {
    id: string;
    userId: string;
    name: string;
    type: string;
    hourlyRate?: number;
    monthlySalary?: number;
    transportAllowance?: number;
    depositAccountId?: string;
  }) {
    setEditingId(emp.id);
    setName(emp.name);
    setEmpType(emp.type);
    setUserId(emp.userId);
    setHourlyRate(emp.hourlyRate ? String(emp.hourlyRate) : '');
    setMonthlySalary(emp.monthlySalary ? String(emp.monthlySalary) : '');
    setTransportAllowance(emp.transportAllowance ? String(emp.transportAllowance) : '');
    setDepositAccountId(emp.depositAccountId ?? '');
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = {
        name: name.trim(),
        type: empType,
        userId: userId || undefined,
        hourlyRate: parseInt(hourlyRate, 10) || undefined,
        monthlySalary: parseInt(monthlySalary, 10) || undefined,
        transportAllowance: parseInt(transportAllowance, 10) || undefined,
        depositAccountId: depositAccountId || undefined,
      };
      if (editingId) {
        await updateEmployment(editingId, data);
      } else {
        await addEmployment(data);
      }
      resetForm();
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
        >
          <Plus size={16} className="inline mr-1" />
          追加
        </Button>
      </div>

      {employments.length === 0 ? (
        <Card>
          <p className="text-center text-on-surface-variant py-4">就業先が登録されていません</p>
        </Card>
      ) : (
        employments.map((emp) => (
          <Card key={emp.id} onClick={() => openEdit(emp)}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{emp.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-surface-container">
                    {TYPE_LABEL[emp.type] || emp.type}
                  </span>
                  {memberName(emp.userId) && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${emp.userId === user?.id ? 'bg-primary/10 text-primary' : 'bg-surface-container text-on-surface-variant'}`}>
                      {memberName(emp.userId)}
                    </span>
                  )}
                </div>
                <p className="text-sm text-on-surface-variant mt-1">
                  {emp.type === 'part_time' && emp.hourlyRate
                    ? `時給 ${emp.hourlyRate.toLocaleString()}円`
                    : emp.monthlySalary
                      ? `月給 ${emp.monthlySalary.toLocaleString()}円`
                      : ''}
                  {emp.depositAccountId && (
                    <span className="ml-2 text-xs">
                      → {accounts.find((a) => a.id === emp.depositAccountId)?.name || '不明'}
                    </span>
                  )}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteEmployment(emp.id);
                }}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </Card>
        ))
      )}

      <Modal
        open={showForm}
        onClose={() => {
          setShowForm(false);
          resetForm();
        }}
        title={editingId ? '就業先を編集' : '就業先を追加'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">メンバー</label>
            <div className="flex gap-2">
              {members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors
                    ${userId === m.id ? 'bg-primary text-white' : 'bg-surface-container hover:bg-outline'}`}
                  onClick={() => setUserId(m.id)}
                >
                  {m.displayName || m.name}{m.id === user?.id ? ' (自分)' : ''}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">就業先名 *</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: スターバックス"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">雇用形態</label>
            <div className="flex gap-2">
              {EMPLOYMENT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={`flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors
                    ${empType === t.value ? 'bg-primary text-white' : 'bg-surface-container'}`}
                  onClick={() => setEmpType(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          {empType === 'part_time' ? (
            <div>
              <label className="block text-sm font-medium mb-1">時給</label>
              <div className="relative">
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary pr-8"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder="1200"
                  min={1}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
                  円
                </span>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1">月給</label>
              <div className="relative">
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary pr-8"
                  value={monthlySalary}
                  onChange={(e) => setMonthlySalary(e.target.value)}
                  placeholder="250000"
                  min={1}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
                  円
                </span>
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">交通費（月額）</label>
            <div className="relative">
              <input
                type="number"
                className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary pr-8"
                value={transportAllowance}
                onChange={(e) => setTransportAllowance(e.target.value)}
                placeholder="10000"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
                円
              </span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">振込口座</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`px-3 py-1.5 rounded-full text-sm cursor-pointer transition-colors
                  ${depositAccountId === '' ? 'bg-primary text-white' : 'bg-surface-container hover:bg-outline'}`}
                onClick={() => setDepositAccountId('')}
              >
                指定なし
              </button>
              {accounts.filter((a) => a.type === 'bank').map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  className={`px-3 py-1.5 rounded-full text-sm cursor-pointer transition-colors
                    ${depositAccountId === acc.id ? 'bg-primary text-white' : 'bg-surface-container hover:bg-outline'}`}
                  onClick={() => setDepositAccountId(acc.id)}
                >
                  {acc.name}
                  <span className="ml-1 opacity-60 text-xs">{ACCOUNT_TYPE_LABEL[acc.type]}</span>
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? '保存中...' : editingId ? '更新する' : '追加する'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}

/* ========== Shifts Tab ========== */

function ShiftsTab() {
  const { employments } = useEmployments();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
  const { shifts, loading, addShift, deleteShift } = useShifts(yearMonth);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [employmentId, setEmploymentId] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [breakMinutes, setBreakMinutes] = useState('60');
  const [isHoliday, setIsHoliday] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const empNameMap = Object.fromEntries(employments.map((e) => [e.id, e.name]));

  function prevMonth() {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
  }

  function nextMonth() {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employmentId) return;
    setSubmitting(true);
    setError(null);
    try {
      await addShift({
        employmentId,
        date,
        startTime,
        endTime,
        breakMinutes: parseInt(breakMinutes, 10) || 0,
        isHoliday,
      });
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '追加に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button size="sm" variant="ghost" onClick={prevMonth}>
            <ChevronLeft size={20} />
          </Button>
          <span className="text-lg font-bold">
            {year}年{month}月
          </span>
          <Button size="sm" variant="ghost" onClick={nextMonth}>
            <ChevronRight size={20} />
          </Button>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus size={16} className="inline mr-1" />
          追加
        </Button>
      </div>

      {shifts.length === 0 ? (
        <Card>
          <p className="text-center text-on-surface-variant py-4">シフトが登録されていません</p>
        </Card>
      ) : (
        shifts.map((shift) => (
          <Card key={shift.id}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{format(new Date(shift.date), 'M/d')}</span>
                  {shift.isHoliday && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                      休日
                    </span>
                  )}
                </div>
                <p className="text-sm text-on-surface-variant mt-1">
                  {shift.startTime} - {shift.endTime}
                  {shift.breakMinutes > 0 && ` (休憩${shift.breakMinutes}分)`}
                </p>
                <p className="text-xs text-on-surface-variant">
                  {empNameMap[shift.employmentId] || '不明'}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => deleteShift(shift.id)}>
                <Trash2 size={14} />
              </Button>
            </div>
          </Card>
        ))
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="シフトを追加">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">就業先 *</label>
            <select
              className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              value={employmentId}
              onChange={(e) => setEmploymentId(e.target.value)}
              required
            >
              <option value="">選択してください</option>
              {employments.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">日付</label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">開始時間</label>
              <input
                type="time"
                className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">終了時間</label>
              <input
                type="time"
                className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">休憩（分）</label>
            <input
              type="number"
              className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              value={breakMinutes}
              onChange={(e) => setBreakMinutes(e.target.value)}
              min={0}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isHoliday"
              checked={isHoliday}
              onChange={(e) => setIsHoliday(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="isHoliday" className="text-sm font-medium">
              休日出勤
            </label>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? '追加中...' : '追加する'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}

/* ========== Salary Tab ========== */

function SalaryTab() {
  const { employments } = useEmployments();
  const { accounts } = useAccounts();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
  const { records, loading, predict, addRecord, deleteRecord } = useSalary(yearMonth);
  const [showPrediction, setShowPrediction] = useState(false);
  const [predictionEmploymentId, setPredictionEmploymentId] = useState('');
  const [prediction, setPrediction] = useState<{
    basePay: number;
    overtimePay: number;
    nightPay: number;
    holidayPay: number;
    transportAllowance: number;
    grossAmount: number;
    socialInsurance: number;
    incomeTax: number;
    netAmount: number;
  } | null>(null);
  const [predicting, setPredicting] = useState(false);
  const [showAddRecord, setShowAddRecord] = useState(false);

  // Record form
  const [recEmploymentId, setRecEmploymentId] = useState('');
  const [grossAmount, setGrossAmount] = useState('');
  const [netAmount, setNetAmount] = useState('');
  const [recNote, setRecNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const empNameMap = Object.fromEntries(employments.map((e) => [e.id, e.name]));

  function prevMonth() {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
  }

  function nextMonth() {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
  }

  async function handlePredict() {
    if (!predictionEmploymentId) return;
    setPredicting(true);
    try {
      const result = await predict(predictionEmploymentId, yearMonth);
      setPrediction(result);
    } catch {
      setPrediction(null);
    } finally {
      setPredicting(false);
    }
  }

  async function handleAddRecord(e: React.FormEvent) {
    e.preventDefault();
    if (!recEmploymentId) return;
    setSubmitting(true);
    setError(null);
    try {
      await addRecord({
        employmentId: recEmploymentId,
        yearMonth,
        grossAmount: parseInt(grossAmount, 10) || 0,
        netAmount: parseInt(netAmount, 10) || 0,
        note: recNote.trim() || undefined,
      });
      setShowAddRecord(false);
      setGrossAmount('');
      setNetAmount('');
      setRecNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '追加に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button size="sm" variant="ghost" onClick={prevMonth}>
            <ChevronLeft size={20} />
          </Button>
          <span className="text-lg font-bold">
            {year}年{month}月
          </span>
          <Button size="sm" variant="ghost" onClick={nextMonth}>
            <ChevronRight size={20} />
          </Button>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setShowPrediction(true)}>
            <Calculator size={16} className="inline mr-1" />
            予測
          </Button>
          <Button size="sm" onClick={() => setShowAddRecord(true)}>
            <Plus size={16} className="inline mr-1" />
            記録
          </Button>
        </div>
      </div>

      {/* Salary Records */}
      <div className="space-y-2">
        <h2 className="font-bold">給料記録</h2>
        {records.length === 0 ? (
          <Card>
            <p className="text-center text-on-surface-variant py-4">給料記録がありません</p>
          </Card>
        ) : (
          records.map((rec) => (
            <Card key={rec.id}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">
                    {empNameMap[rec.employmentId] || '不明'}
                  </span>
                  <div className="flex gap-4 text-sm text-on-surface-variant mt-1">
                    <span>総支給: {rec.grossAmount.toLocaleString()}円</span>
                    <span>手取り: {rec.netAmount.toLocaleString()}円</span>
                  </div>
                  {(rec.depositAccountId || employments.find((e) => e.id === rec.employmentId)?.depositAccountId) && (
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      振込先: {accounts.find((a) => a.id === (rec.depositAccountId || employments.find((e) => e.id === rec.employmentId)?.depositAccountId))?.name || '不明'}
                    </p>
                  )}
                  {rec.note && (
                    <p className="text-xs text-on-surface-variant mt-1">{rec.note}</p>
                  )}
                </div>
                <Button size="sm" variant="ghost" onClick={() => deleteRecord(rec.id)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Prediction Modal */}
      <Modal
        open={showPrediction}
        onClose={() => {
          setShowPrediction(false);
          setPrediction(null);
        }}
        title="給料予測"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">就業先</label>
            <select
              className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              value={predictionEmploymentId}
              onChange={(e) => {
                setPredictionEmploymentId(e.target.value);
                setPrediction(null);
              }}
            >
              <option value="">選択してください</option>
              {employments.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>
          <Button
            className="w-full"
            variant="secondary"
            onClick={handlePredict}
            disabled={!predictionEmploymentId || predicting}
          >
            {predicting ? '計算中...' : '予測を計算'}
          </Button>

          {prediction && (
            <Card>
              <h3 className="font-bold mb-3">給料予測内訳</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>基本給</span>
                  <span>{prediction.basePay.toLocaleString()}円</span>
                </div>
                <div className="flex justify-between">
                  <span>残業手当</span>
                  <span>{prediction.overtimePay.toLocaleString()}円</span>
                </div>
                <div className="flex justify-between">
                  <span>深夜手当</span>
                  <span>{prediction.nightPay.toLocaleString()}円</span>
                </div>
                <div className="flex justify-between">
                  <span>休日手当</span>
                  <span>{prediction.holidayPay.toLocaleString()}円</span>
                </div>
                <div className="flex justify-between">
                  <span>交通費</span>
                  <span>{prediction.transportAllowance.toLocaleString()}円</span>
                </div>
                <div className="flex justify-between font-bold border-t border-outline pt-2">
                  <span>総支給</span>
                  <span>{prediction.grossAmount.toLocaleString()}円</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>社会保険</span>
                  <span>-{prediction.socialInsurance.toLocaleString()}円</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>所得税</span>
                  <span>-{prediction.incomeTax.toLocaleString()}円</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t border-outline pt-2">
                  <span>手取り</span>
                  <span>{prediction.netAmount.toLocaleString()}円</span>
                </div>
              </div>
            </Card>
          )}
        </div>
      </Modal>

      {/* Add Record Modal */}
      <Modal open={showAddRecord} onClose={() => setShowAddRecord(false)} title="給料記録を追加">
        <form onSubmit={handleAddRecord} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">就業先 *</label>
            <select
              className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              value={recEmploymentId}
              onChange={(e) => setRecEmploymentId(e.target.value)}
              required
            >
              <option value="">選択してください</option>
              {employments.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">総支給額</label>
            <div className="relative">
              <input
                type="number"
                className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary pr-8"
                value={grossAmount}
                onChange={(e) => setGrossAmount(e.target.value)}
                placeholder="250000"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
                円
              </span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">手取り額</label>
            <div className="relative">
              <input
                type="number"
                className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary pr-8"
                value={netAmount}
                onChange={(e) => setNetAmount(e.target.value)}
                placeholder="200000"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
                円
              </span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">メモ</label>
            <input
              className="w-full px-3 py-2 border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              value={recNote}
              onChange={(e) => setRecNote(e.target.value)}
              placeholder="例: 残業20時間分含む"
            />
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? '追加中...' : '追加する'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
