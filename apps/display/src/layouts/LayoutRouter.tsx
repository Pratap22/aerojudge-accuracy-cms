import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface LayoutRouterProps {
  layoutKey: string;
  children: ReactNode;
}

export function LayoutRouter({ layoutKey, children }: LayoutRouterProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={layoutKey}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="h-full w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
