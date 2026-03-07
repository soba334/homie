export interface GarbageCategory {
  id: string;
  homeId: string;
  name: string;
  color: string;
  description: string;
  items: string[];
}

export interface GarbageSchedule {
  id: string;
  homeId: string;
  categoryId: string;
  dayOfWeek: number[];
  weekOfMonth?: number[];
  location?: string;
  note?: string;
}

export interface BudgetEntry {
  id: string;
  homeId: string;
  date: string;
  amount: number;
  category: string;
  description: string;
  paidBy: string;
  receiptImageUrl?: string;
  accountId?: string;
}

export interface BudgetSummary {
  monthlyTotal: number;
  byPerson: Record<string, number>;
  byCategory: Record<string, number>;
}

export interface CalendarEvent {
  id: string;
  homeId: string;
  title: string;
  date: string;
  endDate?: string;
  allDay: boolean;
  type: string;
  assignee?: string;
  completed?: boolean;
  color?: string;
  description?: string;
  googleEventId?: string;
  recurrenceRule?: string;
  recurrenceInterval?: number;
  recurrenceEnd?: string;
  isRecurrenceInstance?: boolean;
  originalEventId?: string;
  occurrenceDate?: string;
  garbageScheduleId?: string;
  googleCalendarId?: string;
  createdBy?: string;
}

export interface Document {
  id: string;
  homeId: string;
  title: string;
  category: string;
  fileUrl: string;
  fileType: string;
  uploadedAt: string;
  tags: string[];
  note?: string;
}

export interface GoogleCalendarStatus {
  connected: boolean;
  connectedAt?: string;
}

export interface SyncResult {
  imported: number;
  updated: number;
  deleted: number;
  pushed: number;
}

export interface GoogleCalendarInfo {
  id: string;
  summary: string;
  selected: boolean;
  backgroundColor?: string;
  accessRole: string;
  primary: boolean;
}

// Accounts
export interface Account {
  id: string;
  homeId: string;
  userId: string;
  name: string;
  type: 'bank' | 'credit_card' | 'cash' | 'e_money';
  initialBalance: number;
  color?: string;
  billingDate?: number;
  paymentDate?: number;
  paymentAccountId?: string;
  note?: string;
  createdAt: string;
}

export interface AccountWithBalance extends Account {
  balance: number;
}

export interface AccountTransaction {
  id: string;
  accountId: string;
  homeId: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  category?: string;
  description: string;
  date: string;
  transferToAccountId?: string;
  budgetEntryId?: string;
  salaryRecordId?: string;
  createdAt: string;
}

export interface AccountsSummary {
  totalBalance: number;
  accounts: AccountWithBalance[];
}

// Monthly Budgets
export interface MonthlyBudget {
  id: string;
  homeId: string;
  category: string;
  amount: number;
  yearMonth: string;
}

export interface BudgetVsActual {
  category: string;
  budgetAmount: number;
  actualAmount: number;
  remaining: number;
  usageRate: number;
  overBudget: boolean;
}

// Savings Goals
export interface SavingsGoal {
  id: string;
  homeId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
  accountId?: string;
  note?: string;
  createdAt: string;
}

export interface SavingsGoalWithProgress extends SavingsGoal {
  progressRate: number;
  monthlyRequired?: number;
}

// Subscriptions
export interface Subscription {
  id: string;
  homeId: string;
  name: string;
  amount: number;
  category: string;
  paidBy: string;
  accountId?: string;
  billingCycle: 'monthly' | 'yearly' | 'weekly';
  billingDay: number;
  nextBillingDate: string;
  isActive: boolean;
  note?: string;
  googleEventId?: string;
  syncToCalendar: boolean;
  createdAt: string;
}

// Employment
export interface Employment {
  id: string;
  userId: string;
  homeId: string;
  name: string;
  type: 'part_time' | 'full_time';
  hourlyRate?: number;
  nightStartHour?: number;
  nightEndHour?: number;
  nightRateMultiplier?: number;
  holidayRateMultiplier?: number;
  overtimeThresholdMinutes?: number;
  overtimeRateMultiplier?: number;
  monthlySalary?: number;
  transportAllowance?: number;
  payDay?: number;
  socialInsuranceRate?: number;
  incomeTaxRate?: number;
  color?: string;
  note?: string;
  depositAccountId?: string;
  createdAt: string;
}

// Shifts
export interface Shift {
  id: string;
  employmentId: string;
  userId: string;
  homeId: string;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  isHoliday: boolean;
  note?: string;
  createdAt: string;
}

// Salary
export interface SalaryRecord {
  id: string;
  userId: string;
  homeId: string;
  employmentId: string;
  yearMonth: string;
  basePay: number;
  overtimePay: number;
  nightPay: number;
  holidayPay: number;
  transportAllowance: number;
  otherAllowances: number;
  grossAmount: number;
  socialInsurance: number;
  incomeTax: number;
  otherDeductions: number;
  netAmount: number;
  paidDate?: string;
  depositAccountId?: string;
  note?: string;
  createdAt: string;
}

export interface SalaryPrediction {
  employmentId: string;
  employmentName: string;
  yearMonth: string;
  totalShifts: number;
  totalWorkMinutes: number;
  basePay: number;
  overtimePay: number;
  nightPay: number;
  holidayPay: number;
  transportAllowance: number;
  grossAmount: number;
  socialInsurance: number;
  incomeTax: number;
  totalDeductions: number;
  netAmount: number;
  shiftDetails: ShiftPayDetail[];
}

export interface ShiftPayDetail {
  shiftId: string;
  date: string;
  workMinutes: number;
  normalMinutes: number;
  overtimeMinutes: number;
  nightMinutes: number;
  isHoliday: boolean;
  pay: number;
}

// Background Jobs
export interface BackgroundJob {
  id: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  input?: string;
  result?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
}
