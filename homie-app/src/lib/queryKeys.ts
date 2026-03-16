export const queryKeys = {
  budget: {
    all: ['budget'] as const,
    entries: (yearMonth?: string) =>
      ['budget', 'entries', yearMonth ?? 'current'] as const,
    summary: (yearMonth?: string) =>
      ['budget', 'summary', yearMonth ?? 'current'] as const,
  },

  subscriptions: {
    all: ['subscriptions'] as const,
    list: () => ['subscriptions', 'list'] as const,
  },

  garbage: {
    all: ['garbage'] as const,
    categories: () => ['garbage', 'categories'] as const,
    schedules: () => ['garbage', 'schedules'] as const,
  },

  calendar: {
    all: ['calendar'] as const,
    events: (start?: string, end?: string) =>
      ['calendar', 'events', start, end] as const,
    googleStatus: () => ['calendar', 'google', 'status'] as const,
    googleCalendars: () => ['calendar', 'google', 'calendars'] as const,
  },

  auth: {
    me: () => ['auth', 'me'] as const,
  },

  accounts: {
    all: ['accounts'] as const,
    list: () => ['accounts', 'list'] as const,
    transactions: (accountId: string, yearMonth?: string) =>
      ['accounts', 'transactions', accountId, yearMonth ?? 'all'] as const,
  },

  monthlyBudgets: {
    all: ['monthly-budgets'] as const,
    list: (yearMonth?: string) =>
      ['monthly-budgets', 'list', yearMonth ?? 'all'] as const,
  },

  savings: {
    all: ['savings'] as const,
    list: () => ['savings', 'list'] as const,
  },

  employment: {
    all: ['employment'] as const,
    list: () => ['employment', 'list'] as const,
    shifts: (yearMonth?: string, userId?: string) =>
      ['employment', 'shifts', yearMonth ?? 'all', userId ?? 'all'] as const,
    salary: (yearMonth?: string) =>
      ['employment', 'salary', yearMonth ?? 'all'] as const,
    salaryPredict: (yearMonth?: string) =>
      ['employment', 'salary', 'predict', yearMonth ?? 'current'] as const,
  },

  documents: {
    all: ['documents'] as const,
    list: () => ['documents', 'list'] as const,
  },

  notifications: {
    preferences: () => ['notifications', 'preferences'] as const,
  },

  jobs: {
    detail: (jobId: string) => ['jobs', jobId] as const,
  },
} as const;
