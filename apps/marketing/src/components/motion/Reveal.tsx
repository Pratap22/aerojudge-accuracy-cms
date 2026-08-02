import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { easeOut, inView } from '@/lib/motion';

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  /** Animate on mount (hero) instead of scroll */
  onMount?: boolean;
};

/** Reliable scroll/mount reveal using explicit initial/animate objects. */
export function Reveal({ children, className, delay = 0, y = 28, onMount = false }: RevealProps) {
  const reduce = useReducedMotion();

  const initial = reduce ? { opacity: 0 } : { opacity: 0, y };
  const visible = reduce
    ? { opacity: 1, transition: { duration: 0.25, delay } }
    : { opacity: 1, y: 0, transition: { duration: 0.65, delay, ease: easeOut } };

  if (onMount) {
    return (
      <motion.div className={className} initial={initial} animate={visible}>
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div className={className} initial={initial} whileInView={visible} viewport={inView}>
      {children}
    </motion.div>
  );
}

type StaggerProps = {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
  onMount?: boolean;
  as?: 'div' | 'ul' | 'ol';
};

export function Stagger({
  children,
  className,
  stagger = 0.08,
  delay = 0.05,
  onMount = false,
  as = 'div',
}: StaggerProps) {
  const reduce = useReducedMotion();
  const Comp = as === 'ul' ? motion.ul : as === 'ol' ? motion.ol : motion.div;

  const container = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: reduce ? 0.04 : stagger,
        delayChildren: delay,
      },
    },
  };

  if (onMount) {
    return (
      <Comp className={className} variants={container} initial="hidden" animate="visible">
        {children}
      </Comp>
    );
  }

  return (
    <Comp
      className={className}
      variants={container}
      initial="hidden"
      whileInView="visible"
      viewport={inView}
    >
      {children}
    </Comp>
  );
}

type StaggerItemProps = {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'li' | 'span' | 'p';
};

export function StaggerItem({ children, className, as = 'div' }: StaggerItemProps) {
  const reduce = useReducedMotion();
  const Comp = as === 'li' ? motion.li : as === 'span' ? motion.span : as === 'p' ? motion.p : motion.div;

  const item = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: reduce ? 0.22 : 0.5, ease: easeOut },
    },
  };

  return (
    <Comp className={className} variants={item}>
      {children}
    </Comp>
  );
}
