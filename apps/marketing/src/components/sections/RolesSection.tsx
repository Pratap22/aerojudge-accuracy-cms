import { useState } from 'react';
import { additionalRoles, competitionRoles } from '@/config/roles';
import { SectionHeading } from '../ui/SectionHeading';

export function RolesSection() {
  const [activeId, setActiveId] = useState(competitionRoles[0]!.id);
  const active = competitionRoles.find((r) => r.id === activeId) ?? competitionRoles[0]!;

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
            {competitionRoles.map((role) => {
              const selected = role.id === active.id;
              return (
                <button
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
                >
                  {role.title}
                </button>
              );
            })}
          </div>

          <div
            role="tabpanel"
            id={`role-panel-${active.id}`}
            aria-labelledby={`role-tab-${active.id}`}
            className="rounded-xl border border-border bg-white p-6 shadow-sm sm:p-8"
          >
            <h3 className="font-display text-2xl font-bold text-navy">{active.title}</h3>
            <p className="mt-2 text-muted-foreground">{active.summary}</p>
            <h4 className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-sky">Can</h4>
            <ul className="mt-3 space-y-2">
              {active.can.map((item) => (
                <li key={item} className="text-sm leading-relaxed text-foreground">
                  <span className="mr-2 text-bullseye" aria-hidden>
                    ✓
                  </span>
                  {item}
                </li>
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
