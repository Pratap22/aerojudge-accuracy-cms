import { motion, useReducedMotion } from 'framer-motion';
import { fadeLeft, fadeRight, inView, motionSafe } from '@/lib/motion';

export function OrganizationSection() {
  const reduce = useReducedMotion();
  const copy = motionSafe(reduce, fadeLeft);
  const tree = motionSafe(reduce, fadeRight);

  return (
    <section id="organizations" className="section-pad bg-navy text-white" aria-labelledby="org-heading">
      <div className="content-width grid items-center gap-10 lg:grid-cols-2">
        <motion.div className="max-w-2xl" {...copy} viewport={inView}>
          <p className="eyebrow mb-3 text-sky">Organizations</p>
          <h2
            id="org-heading"
            className="font-display text-3xl font-bold tracking-tight text-white text-balance sm:text-4xl lg:text-5xl"
          >
            Your competitions. Your officials. Your data.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/70 sm:text-lg">
            Federations, clubs and event companies operate as organizations. Users authenticate once, then
            work inside the organization context they belong to — with roles that can differ per tenant.
          </p>
        </motion.div>
        <motion.div
          className="rounded-xl border border-white/15 bg-white/5 p-6 font-mono text-sm leading-relaxed text-sky/90"
          {...tree}
          viewport={inView}
        >
          {[
            { text: 'User', className: 'text-white' },
            { text: '├── Organization A', className: 'mt-2 pl-3' },
            { text: '└── Chief Judge', className: 'pl-8 text-white/80' },
            { text: '└── Organization B', className: 'mt-2 pl-3' },
            { text: '└── Announcer', className: 'pl-8 text-white/80' },
          ].map((line, i) => (
            <motion.p
              key={line.text + i}
              className={line.className}
              initial={reduce ? false : { opacity: 0, x: 8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={inView}
              transition={{ delay: 0.15 + i * 0.08, duration: 0.35 }}
            >
              {line.text}
            </motion.p>
          ))}
          <motion.p
            className="mt-6 text-xs text-white/55"
            initial={reduce ? false : { opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={inView}
            transition={{ delay: 0.6, duration: 0.4 }}
          >
            Manage users, competitions, officials, pilots, teams, branding, reports and results — with
            organization data kept isolated.
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
