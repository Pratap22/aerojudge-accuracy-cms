import { motion, useReducedMotion } from 'framer-motion';
import { easeOut } from '@/lib/motion';

export function OrganizationSection() {
  const reduce = useReducedMotion();

  return (
    <section id="organizations" className="section-pad bg-navy text-white" aria-labelledby="org-heading">
      <div className="content-width grid items-center gap-10 lg:grid-cols-2">
        <motion.div
          className="max-w-2xl"
          initial={reduce ? { opacity: 0 } : { opacity: 0, x: -28 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.55, ease: easeOut }}
        >
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
          initial={reduce ? { opacity: 0 } : { opacity: 0, x: 28 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.55, delay: 0.12, ease: easeOut }}
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
              initial={{ opacity: 0, x: 10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 + i * 0.09, duration: 0.35 }}
            >
              {line.text}
            </motion.p>
          ))}
          <p className="mt-6 text-xs text-white/55">
            Manage users, competitions, officials, pilots, teams, branding, reports and results — with
            organization data kept isolated.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
