import { ArrowRight, Mail, Rocket } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { getApp } from '@/config/apps';
import { mailtoContact, siteConfig } from '@/config/site';
import { easeOut } from '@/lib/motion';
import { MarketingButton } from '../ui/MarketingButton';

export function CtaSection() {
  const reduce = useReducedMotion();
  const admin = getApp('admin');
  const contactHref = mailtoContact(
    'Contact Nepalabs — AeroJudge',
    'Hi Nepalabs,\n\nI would like to learn more about AeroJudge for our competitions.\n\n',
  );

  return (
    <section id="get-started" className="section-pad" aria-labelledby="cta-heading">
      <div className="content-width">
        <motion.div
          className="relative overflow-hidden rounded-2xl bg-navy px-6 py-12 sm:px-10 sm:py-16 lg:px-14"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 36, scale: 0.97 }}
          whileInView={
            reduce
              ? { opacity: 1 }
              : { opacity: 1, y: 0, scale: 1, transition: { duration: 0.65, ease: easeOut } }
          }
          viewport={{ once: true, amount: 0.35 }}
        >
          <div
            className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full border border-sky/20"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full border border-white/10"
            aria-hidden
          />
          <motion.div
            className="pointer-events-none absolute inset-0 bg-target-ring"
            style={{ opacity: 0.35 }}
            aria-hidden
            animate={reduce ? undefined : { scale: [1, 1.06, 1], opacity: [0.25, 0.4, 0.25] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
          />

          <div className="relative mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky">Next step</p>
            <h2 id="cta-heading" className="mt-3 font-display text-3xl font-bold text-white sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
              Ready to run your next competition differently?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">
              Set up your organization, invite officials, and score the meet from one system — from the
              first landing to the printed results sheet.
            </p>

            <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <MarketingButton href={mailtoContact('AeroJudge demo request')} variant="onDark" size="lg">
                Request a Demo
                <ArrowRight className="h-4 w-4" aria-hidden />
              </MarketingButton>
              <MarketingButton href={admin.href} variant="onDarkOutline" size="lg">
                <Rocket className="h-4 w-4" aria-hidden />
                Get Started
              </MarketingButton>
              <MarketingButton href={contactHref} variant="onDarkOutline" size="lg">
                <Mail className="h-4 w-4" aria-hidden />
                Contact Nepalabs
              </MarketingButton>
            </div>

            <p className="mt-6 text-sm text-white/55">
              Prefer email?{' '}
              <a
                href={contactHref}
                className="font-medium text-sky underline-offset-2 hover:text-sky/90 hover:underline"
              >
                {siteConfig.contactEmail}
              </a>
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
