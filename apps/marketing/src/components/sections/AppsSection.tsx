import { ArrowUpRight } from 'lucide-react';
import { aeroJudgeApps } from '@/config/apps';
import { siteConfig } from '@/config/site';
import { SectionHeading } from '../ui/SectionHeading';

export function AppsSection() {
  return (
    <section id="apps" className="section-pad" aria-labelledby="apps-heading">
      <div className="content-width">
        <SectionHeading
          eyebrow="AeroJudge Apps"
          title="Quick access to the tools you run on site."
          id="apps-heading"
          description="Jump into the application that matches your role. Authenticated apps redirect to sign-in when required."
        />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {aeroJudgeApps.map((app) => (
            <li key={app.id}>
              <a
                href={app.href}
                className="group flex h-full flex-col rounded-xl border border-border bg-white p-5 shadow-sm transition-colors hover:border-sky"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-xl font-bold text-navy">{app.name}</h3>
                  <ArrowUpRight className="h-5 w-5 shrink-0 text-muted-foreground transition-colors group-hover:text-sky" aria-hidden />
                </div>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{app.description}</p>
                <p className="mt-4 text-xs font-medium uppercase tracking-[0.14em] text-sky">
                  {app.requiresAuth ? 'Requires sign-in' : 'Public access'}
                </p>
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-muted-foreground">
          Product documentation:{' '}
          <a
            href={siteConfig.docsUrl}
            className="font-medium text-navy underline-offset-2 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            docs on GitHub
          </a>
          .
        </p>
      </div>
    </section>
  );
}
