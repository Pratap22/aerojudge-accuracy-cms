import { ArrowUpRight } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { aeroJudgeApps } from '@/config/apps';
import { siteConfig } from '@/config/site';
import { Stagger, StaggerItem } from '../motion/Reveal';
import { SectionHeading } from '../ui/SectionHeading';

export function AppsSection() {
  const reduce = useReducedMotion();

  return (
    <section id="apps" className="section-pad" aria-labelledby="apps-heading">
      <div className="content-width">
        <SectionHeading
          eyebrow="AeroJudge Apps"
          title="Quick access to the tools you run on site."
          id="apps-heading"
          description="Jump into the application that matches your role. Authenticated apps redirect to sign-in when required."
        />
        <Stagger as="ul" className="mt-10 grid gap-4 sm:grid-cols-2" stagger={0.1}>
          {aeroJudgeApps.map((app) => (
            <StaggerItem key={app.id} as="li">
              <motion.a
                href={app.href}
                className="group flex h-full flex-col rounded-lg border border-border bg-card p-5 shadow-sm transition-colors hover:border-sky/40 hover:bg-secondary/30"
                whileHover={reduce ? undefined : { y: -5, transition: { duration: 0.2 } }}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-xl font-semibold tracking-tight text-primary">{app.name}</h3>
                  <ArrowUpRight
                    className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-sky"
                    aria-hidden
                  />
                </div>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{app.description}</p>
                <p className="mt-4 text-xs font-medium uppercase tracking-[0.14em] text-sky">
                  {app.requiresAuth ? 'Requires sign-in' : 'Public access'}
                </p>
              </motion.a>
            </StaggerItem>
          ))}
        </Stagger>
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
