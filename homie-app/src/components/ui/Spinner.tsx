import { Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

interface SpinnerProps {
  size?: number;
  className?: string;
}

export function Spinner({ size = 24, className = 'text-on-surface-variant' }: SpinnerProps) {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
      className="inline-flex"
    >
      <Loader2 size={size} className={className} />
    </motion.div>
  );
}
