import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useId, useState } from 'react';
import { formatPrice, pricingConfig, pricingFaqs } from '@/config/pricing';
import { easeOut } from '@/lib/motion';
import { Reveal, Stagger, StaggerItem } from '../motion/Reveal';
import { MarketingButton } from '../ui/MarketingButton';
import { SectionHeading } from '../ui/SectionHeading';

export function PricingSection() {
  const reduce = useReducedMotion();

  return (
    <section id="pricing" className="section-pad bg-secondary/40" aria-labelledby="pricing-heading">
      <div className="content-width">
        <SectionHeading
          eyebrow="Pricing"
          title="Plans that scale with your organization."
          id="pricing-heading"
          align="center"
          description={pricingConfig.billingNote}
        />

        <Stagger as="ul" className="mt-12 grid gap-5 lg:grid-cols-3" stagger={0.12}>
          {pricingConfig.tiers.map((tier) => (
            <StaggerItem key={tier.id} as="li">
              <motion.div
                className={`relative flex h-full flex-col rounded-xl border bg-white p-6 shadow-sm ${
                  tier.popular ? 'border-sky ring-2 ring-sky/30' : 'border-border'
                }`}
                whileHover={reduce ? undefined : { y: -5 }}
              >
                {tier.popular ? (
                  <span className="absolute -top-3 left-6 rounded-full bg-sky px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                    Most Popular
                  </span>
                ) : null}
                <h3 className="font-display text-2xl font-bold text-navy">{tier.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{tier.tagline}</p>
                <p className="mt-6 font-display text-3xl font-bold text-navy">{formatPrice(tier.price)}</p>
                <ul className="mt-6 flex-1 space-y-2.5">
                  {tier.features.map((feature) => (
                    <li key={feature} className="text-sm text-foreground">
                      <span className="mr-2 text-bullseye" aria-hidden>
                        ✓
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <MarketingButton
                  href={tier.cta.href}
                  variant={tier.popular ? 'primary' : 'secondary'}
                  size="lg"
                  className="mt-8 w-full"
                >
                  {tier.cta.label}
                </MarketingButton>
              </motion.div>
            </StaggerItem>
          ))}
        </Stagger>

        <PricingFaq />
      </div>
    </section>
  );
}

function PricingFaq() {
  const [open, setOpen] = useState<number | null>(0);
  const baseId = useId();
  const reduce = useReducedMotion();

  return (
    <Reveal className="mx-auto mt-16 max-w-3xl" y={20}>
      <h3 className="text-center font-display text-2xl font-bold text-navy">Pricing FAQ</h3>
      <div className="mt-8 divide-y divide-border rounded-xl border border-border bg-white">
        {pricingFaqs.map((faq, index) => {
          const isOpen = open === index;
          const panelId = `${baseId}-panel-${index}`;
          const buttonId = `${baseId}-button-${index}`;
          return (
            <div key={faq.question}>
              <h4>
                <button
                  type="button"
                  id={buttonId}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  className="flex min-h-14 w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-navy"
                  onClick={() => setOpen(isOpen ? null : index)}
                >
                  {faq.question}
                  <span className="text-lg text-sky" aria-hidden>
                    {isOpen ? '−' : '+'}
                  </span>
                </button>
              </h4>
              <AnimatePresence initial={false}>
                {isOpen ? (
                  <motion.div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    className="overflow-hidden px-5 text-sm leading-relaxed text-muted-foreground"
                    initial={reduce ? false : { height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={reduce ? undefined : { height: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: easeOut }}
                  >
                    <p className="pb-4">{faq.answer}</p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </Reveal>
  );
}
