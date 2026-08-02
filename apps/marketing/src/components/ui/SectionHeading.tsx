import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { easeOut, inView } from '@/lib/motion';

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  align?: 'left' | 'center';
  id?: string;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  id,
}: SectionHeadingProps) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 28 }}
      whileInView={
        reduce
          ? { opacity: 1, transition: { duration: 0.25 } }
          : { opacity: 1, y: 0, transition: { duration: 0.55, ease: easeOut } }
      }
      viewport={inView}
    >
      {eyebrow ? <p className="eyebrow mb-3">{eyebrow}</p> : null}
      <h2 id={id} className="display-title text-balance">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">{description}</p>
      ) : null}
    </motion.div>
  );
}
