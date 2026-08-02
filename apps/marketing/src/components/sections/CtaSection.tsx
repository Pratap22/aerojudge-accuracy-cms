import { aeroJudgeApps } from '@/config/apps';
import { mailtoContact, siteConfig } from '@/config/site';
import { MarketingButton } from '../ui/MarketingButton';

export function CtaSection() {
  const admin = aeroJudgeApps.find((a) => a.id === 'admin')!;

  return (
    <section id="get-started" className="section-pad" aria-labelledby="cta-heading">
      <div className="content-width">
        <div className="relative overflow-hidden rounded-2xl bg-navy px-6 py-12 text-center sm:px-10 sm:py-16">
          <div className="pointer-events-none absolute inset-0 bg-target-ring opacity-40" aria-hidden />
          <div className="relative">
            <h2 id="cta-heading" className="font-display text-3xl font-bold text-white sm:text-4xl">
              Ready to run your next competition differently?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-white/70">
              Set up your organization, invite officials, and score the meet from one system — from the
              first landing to the printed results sheet.
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <MarketingButton
                href={mailtoContact('AeroJudge demo request')}
                size="lg"
                className="bg-sky text-navy hover:bg-sky/90"
              >
                Request a Demo
              </MarketingButton>
              <MarketingButton
                href={admin.href}
                variant="secondary"
                size="lg"
                className="border-white/20 bg-transparent text-white hover:border-sky hover:text-sky"
              >
                Get Started
              </MarketingButton>
              <MarketingButton
                href={`mailto:${siteConfig.contactEmail}?subject=${encodeURIComponent('Contact Nepalabs — AeroJudge')}`}
                variant="ghost"
                size="lg"
                className="text-white hover:bg-white/10"
              >
                Contact Nepalabs
              </MarketingButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
