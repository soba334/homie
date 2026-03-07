import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { ToastProvider } from '@/components/ui';
import { BackgroundJobsProvider } from '@/hooks/BackgroundJobsProvider';
import { AppLayout } from '@/components/layout/AppLayout';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { GarbagePage } from '@/features/garbage';
import { BudgetPage } from '@/features/budget';
import { CalendarPage } from '@/features/calendar';
import { DocumentsPage } from '@/features/documents';
import { AccountsPage } from '@/features/accounts';
import { MonthlyBudgetsPage } from '@/features/monthly-budgets';
import { SavingsPage } from '@/features/savings';
import { EmploymentPage } from '@/features/employment';
import { SettingsPage } from '@/features/settings';
import { LoginPage, OnboardingPage, useAuthProvider, AuthContext } from '@/features/auth';

export default function App() {
  const auth = useAuthProvider();

  if (auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        >
          <Loader2 size={32} className="text-primary" />
        </motion.div>
      </div>
    );
  }

  if (!auth.user) {
    return (
      <AuthContext.Provider value={auth}>
        <LoginPage />
      </AuthContext.Provider>
    );
  }

  // Show onboarding if nickname or home not set up yet
  const needsSetup = !auth.user.displayName || !auth.user.home;
  if (needsSetup) {
    return (
      <AuthContext.Provider value={auth}>
        <OnboardingPage />
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={auth}>
      <ToastProvider>
        <BackgroundJobsProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="garbage" element={<GarbagePage />} />
              <Route path="budget" element={<BudgetPage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="accounts" element={<AccountsPage />} />
              <Route path="monthly-budgets" element={<MonthlyBudgetsPage />} />
              <Route path="savings" element={<SavingsPage />} />
              <Route path="employment" element={<EmploymentPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
        </BackgroundJobsProvider>
      </ToastProvider>
    </AuthContext.Provider>
  );
}
