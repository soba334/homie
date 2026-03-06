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
  layoutId?: string;
}

export function Tabs({ tabs, activeKey, onChange, layoutId = 'tab-indicator' }: TabsProps) {
  return (
    <div className="flex border-b border-outline">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          className={`relative flex-1 py-2 text-sm font-medium cursor-pointer transition-colors
            ${activeKey === tab.key ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
          {activeKey === tab.key && (
            <motion.div
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
              layoutId={layoutId}
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            />
          )}
        </button>
      ))}
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
