import { motion, AnimatePresence } from 'motion/react';
import type { ReactNode } from 'react';

interface Tab {
  key: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeKey: string;
  onChange: (key: string) => void;
}

export function Tabs({ tabs, activeKey, onChange }: TabsProps) {
  const activeIndex = tabs.findIndex((t) => t.key === activeKey);
  const tabCount = tabs.length;

  return (
    <div className="relative flex border-b border-outline">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          className={`flex-1 py-2 text-sm font-medium cursor-pointer transition-colors
            ${activeKey === tab.key ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
      <motion.div
        className="absolute bottom-0 h-0.5 bg-primary"
        initial={false}
        animate={{
          left: `${(activeIndex / tabCount) * 100}%`,
          width: `${100 / tabCount}%`,
        }}
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      />
    </div>
  );
}

interface TabContentProps {
  activeKey: string;
  children: ReactNode;
}

export function TabContent({ activeKey, children }: TabContentProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeKey}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
