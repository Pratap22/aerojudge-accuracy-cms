import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import { additionalRoles, competitionRoles } from '@/config/roles';
import { easeOut, inView } from '@/lib/motion';
import { SectionHeading } from '../ui/SectionHeading';

export function RolesSection() {
  const [activeId, setActiveId] = useState(competitionRoles[0]!.id);
  const active = competitionRoles.find((r) => r.id === activeId) ?? competitionRoles[0]!;
  const reduce = useReducedMotion();

  return (
    <section id="roles" className="section-pad" aria-labelledby="roles-heading">
      <div className="content-width">
        <SectionHeading
          eyebrow="People on the hill"
          title="One competition. Different responsibilities."
          id="roles-heading"
          description="AeroJudge gives each official the tools for their job — without handing everyone administrative control."
        />

        <div className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div
            role="tablist"
            aria-label="Competition roles"
            className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible"
          >
            {competitionRoles.map((role, i) => {
              const selected = role.id === active.id;
              return (
                <motion.button
                  key={role.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  id={`role-tab-${role.id}`}
                  aria-controls={`role-panel-${role.id}`}
                  className={`min-h-11 shrink-0 rounded-md border px-4 py-3 text-left text-sm font-semibold transition-colors lg:w-full ${
                    selected
                      ? 'border-navy bg-navy text-white'
                      : 'border-border bg-white text-navy hover:border-sky'
                  }`}
                  onClick={() => setActiveId(role.id)}
                  initial={reduce ? false : { opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={inView}
                  transition={{ delay: i * 0.04, duration: 0.35, ease: easeOut }}
                  whileTap={reduce ? undefined : { scale: 0.98 }}
                >
                  {role.title}
                </motion.button>
              );
            })}
          </div>

          <div className="relative min-h-[280px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={active.id}
                role="tabpanel"
                id={`role-panel-${active.id}`}
                aria-labelledby={`role-tab-${active.id}`}
                className="rounded-xl border border-border bg-white p-6 shadow-sm sm:p-8"
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease: easeOut }}
              >
                <h3 className="font-display text-2xl font-bold text-navy">{active.title}</h3>
                <p className="mt-2 text-muted-foreground">{active.summary}</p>
                <h4 className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-sky">Can</h4>
                <ul className="mt-3 space-y-2">
                  {active.can.map((item, i) => (
                    <motion.li
                      key={item}
                      className="text-sm leading-relaxed text-foreground"
                      initial={reduce ? false : { opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 + i * 0.03, duration: 0.25 }}
                    >
                      <span className="mr-2 text-bullseye" aria-hidden>
                        ✓
                      </span>
                      {item}
                    </motion.li>
                  ))}
                </ul>
                {active.cannot?.length ? (
                  <>
                    <h4 className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Boundaries
                    </h4>
                    <ul className="mt-3 space-y-2">
                      {active.cannot.map((item) => (
                        <li key={item} className="text-sm leading-relaxed text-muted-foreground">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          Also supported: {additionalRoles.join(' · ')}. Exact permissions follow each organization&apos;s
          configured roles.
        </p>
      </div>
    </section>
  );
}
