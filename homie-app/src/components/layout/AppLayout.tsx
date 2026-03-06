import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Home,
  Wallet,
  CalendarDays,
  MoreHorizontal,
  Trash2,
  FileText,
  Landmark,
  Briefcase,
  Settings,
} from 'lucide-react';

const MAIN_NAV_ITEMS = [
  { to: '/', icon: Home, label: 'ホーム' },
  { to: '/budget', icon: Wallet, label: '家計簿' },
  { to: '/calendar', icon: CalendarDays, label: 'カレンダー' },
] as const;

const MORE_NAV_ITEMS = [
  { to: '/garbage', icon: Trash2, label: 'ゴミ出し' },
  { to: '/documents', icon: FileText, label: '書類' },
  { to: '/accounts', icon: Landmark, label: '口座管理' },
  { to: '/employment', icon: Briefcase, label: '就業・給料' },
  { to: '/settings', icon: Settings, label: '設定' },
] as const;

const MORE_PATHS = MORE_NAV_ITEMS.map((item) => item.to);

export function AppLayout() {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();

  const isMoreActive = MORE_PATHS.some((path) =>
    location.pathname.startsWith(path),
  );

  return (
    <div className="min-h-screen pb-20">
      <header className="bg-surface border-b border-outline sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <h1 className="text-lg font-bold text-primary">homie</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <Outlet />
      </main>

      <AnimatePresence>
        {moreOpen && (
          <>
            {/* Overlay */}
            <motion.div
              className="fixed inset-0 bg-black/30 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMoreOpen(false)}
            />

            {/* Slide-up more panel */}
            <motion.div
              className="fixed left-0 right-0 bottom-[calc(3.5rem+1px)] z-50"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <div className="max-w-4xl mx-auto bg-surface border border-outline rounded-t-2xl shadow-lg px-4 py-4">
                <div className="grid grid-cols-2 gap-3">
                  {MORE_NAV_ITEMS.map(({ to, icon: Icon, label }) => (
                    <NavLink
                      key={to}
                      to={to}
                      onClick={() => setMoreOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-on-surface hover:bg-surface-container'
                        }`
                      }
                    >
                      <Icon size={20} />
                      <span>{label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-outline z-50">
        <div className="max-w-4xl mx-auto flex">
          {MAIN_NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center py-2 text-xs transition-colors
                ${isActive ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'}`
              }
            >
              <Icon size={20} />
              <span className="mt-0.5">{label}</span>
            </NavLink>
          ))}

          {/* More button */}
          <button
            type="button"
            onClick={() => setMoreOpen((prev) => !prev)}
            className={`flex-1 flex flex-col items-center py-2 text-xs transition-colors cursor-pointer
              ${isMoreActive || moreOpen ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            <MoreHorizontal size={20} />
            <span className="mt-0.5">その他</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
