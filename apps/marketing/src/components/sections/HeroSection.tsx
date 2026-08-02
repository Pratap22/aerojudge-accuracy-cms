import { motion, useReducedMotion } from 'framer-motion';
import { aeroJudgeApps } from '@/config/apps';
import { mailtoContact, siteConfig } from '@/config/site';
import { easeOut } from '@/lib/motion';
import { Reveal, Stagger, StaggerItem } from '../motion/Reveal';
import { HeroProductMock } from '../diagrams/HeroProductMock';
import { MarketingButton } from '../ui/MarketingButton';

export function HeroSection() {
  const reduce = useReducedMotion();
  const admin = aeroJudgeApps.find((a) => a.id === 'admin')!;
  const results = aeroJudgeApps.find((a) => a.id === 'results')!;

  return (
    <section className="relative overflow-hidden bg-hero-sky" aria-labelledby="hero-heading">
      <motion.div
        className="pointer-events-none absolute inset-0 bg-target-ring"
        aria-hidden
        style={{ opacity: 0.7 }}
        initial={reduce ? false : { opacity: 0, scale: 0.9 }}
        animate={{ opacity: 0.7, scale: 1 }}
        transition={{ duration: 1.1, ease: easeOut }}
      />
      <div className="content-width relative grid items-center gap-12 section-pad lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <Stagger onMount stagger={0.14} delay={0.08} className="min-w-0">
          <StaggerItem>
            <p className="font-display text-4xl font-extrabold tracking-tight text-navy sm:text-5xl lg:text-6xl">
              {siteConfig.productName}
            </p>
          </StaggerItem>
          <StaggerItem>
            <p className="mt-3 text-lg font-medium text-sky sm:text-xl">{siteConfig.tagline}</p>
          </StaggerItem>
          <h1 id="hero-heading" className="sr-only">
            {siteConfig.productName} — {siteConfig.tagline}
          </h1>
          <StaggerItem>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Run your {siteConfig.discipline} competition from registration to official results — without
              managing scores across spreadsheets, displays and printed reports manually.
            </p>
          </StaggerItem>
          <StaggerItem>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <MarketingButton href={admin.href} size="lg">
                Get Started
              </MarketingButton>
              <MarketingButton href={mailtoContact('AeroJudge demo request')} variant="secondary" size="lg">
                Request a Demo
              </MarketingButton>
              <MarketingButton href={results.href} variant="ghost" size="lg">
                View Live Demo
              </MarketingButton>
            </div>
          </StaggerItem>
        </Stagger>

        <Reveal onMount delay={0.35} y={36} className="min-w-0">
          <HeroProductMock />
        </Reveal>
      </div>
    </section>
  );
}
