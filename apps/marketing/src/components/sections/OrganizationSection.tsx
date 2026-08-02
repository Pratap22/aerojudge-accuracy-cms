export function OrganizationSection() {
  return (
    <section id="organizations" className="section-pad bg-navy text-white" aria-labelledby="org-heading">
      <div className="content-width grid items-center gap-10 lg:grid-cols-2">
        <div className="max-w-2xl">
          <p className="eyebrow mb-3 text-sky">Organizations</p>
          <h2 id="org-heading" className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl text-balance">
            Your competitions. Your officials. Your data.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/70 sm:text-lg">
            Federations, clubs and event companies operate as organizations. Users authenticate once, then
            work inside the organization context they belong to — with roles that can differ per tenant.
          </p>
        </div>
        <div className="rounded-xl border border-white/15 bg-white/5 p-6 font-mono text-sm leading-relaxed text-sky/90">
          <p className="text-white">User</p>
          <p className="mt-2 pl-3">├── Organization A</p>
          <p className="pl-8 text-white/80">└── Chief Judge</p>
          <p className="mt-2 pl-3">└── Organization B</p>
          <p className="pl-8 text-white/80">└── Announcer</p>
          <p className="mt-6 text-xs text-white/55">
            Manage users, competitions, officials, pilots, teams, branding, reports and results — with
            organization data kept isolated.
          </p>
        </div>
      </div>
    </section>
  );
}
