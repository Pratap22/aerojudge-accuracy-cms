import type { Variants } from 'framer-motion';

/** Shared viewport trigger — fire once, slightly before fully in view */
export const inView = {
  once: true,
  amount: 0.15,
  margin: '0px 0px -8% 0px',
} as const;

export const easeOut = [0.22, 1, 0.36, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: easeOut },
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.45, ease: easeOut },
  },
};

export const fadeLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: easeOut },
  },
};

export const fadeRight: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: easeOut },
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: easeOut },
  },
};

/** Parent for staggered children */
export function staggerContainer(stagger = 0.07, delayChildren = 0.05): Variants {
  return {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: stagger,
        delayChildren,
      },
    },
  };
}

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: easeOut },
  },
};

/** Instant visible state when prefers-reduced-motion is on */
export function motionSafe(
  reduce: boolean | null,
  variants: Variants,
): { initial: string | false; animate?: string; whileInView?: string; variants: Variants } {
  if (reduce) {
    return {
      initial: false,
      variants: {
        hidden: { opacity: 1, y: 0, x: 0, scale: 1 },
        visible: { opacity: 1, y: 0, x: 0, scale: 1 },
      },
    };
  }
  return {
    initial: 'hidden',
    whileInView: 'visible',
    variants,
  };
}
