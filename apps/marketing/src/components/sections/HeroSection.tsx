import { aeroJudgeApps } from '@/config/apps';
import { mailtoContact, siteConfig } from '@/config/site';
import { HeroProductMock } from '../diagrams/HeroProductMock';
import { MarketingButton } from '../ui/MarketingButton';

export function HeroSection() {
  const admin = aeroJudgeApps.find((a) => a.id === 'admin')!;
  const results = aeroJudgeApps.find((a) => a.id === 'results')!;

  return (
    <section className="relative overflow-hidden bg-hero-sky" aria-labelledby="hero-heading">
      <div className="pointer-events-none absolute inset-0 bg-target-ring opacity-70" aria-hidden />
      <div className="content-width relative grid items-center gap-12 section-pad lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div>
          <p className="font-display text-4xl font-extrabold tracking-tight text-navy sm:text-5xl lg:text-6xl">
            {siteConfig.productName}
          </p>
          <p className="mt-3 text-lg font-medium text-sky sm:text-xl">{siteConfig.tagline}</p>
          <h1 id="hero-heading" className="sr-only">
            {siteConfig.productName} — {siteConfig.tagline}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Run your {siteConfig.discipline} competition from registration to official results — without
            managing scores across spreadsheets, displays and printed reports manually.
          </p>
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
        </div>
        <HeroProductMock />
      </div>
    </section>
  );
}
