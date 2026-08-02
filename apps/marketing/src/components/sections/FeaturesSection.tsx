import { availableFeatures, plannedFeatures } from '@/config/features';
import { SectionHeading } from '../ui/SectionHeading';

export function FeaturesSection() {
  return (
    <section id="features" className="section-pad" aria-labelledby="features-heading">
      <div className="content-width">
        <SectionHeading
          eyebrow="Capabilities"
          title="Built for the pressure of a live accuracy meet."
          id="features-heading"
          description="Everything listed as available ships in AeroJudge today. Upcoming items are labeled clearly — we do not market unfinished work as ready."
        />

        <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {availableFeatures.map((feature) => (
            <li
              key={feature.id}
              className="rounded-lg border border-border bg-white p-4 shadow-sm"
            >
              <p className="font-semibold text-navy">{feature.name}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
            </li>
          ))}
        </ul>

        {plannedFeatures.length > 0 ? (
          <div className="mt-12 rounded-xl border border-dashed border-border bg-secondary/30 p-6">
            <h3 className="font-display text-lg font-bold text-navy">On the roadmap</h3>
            <ul className="mt-4 space-y-2">
              {plannedFeatures.map((feature) => (
                <li key={feature.id} className="text-sm text-muted-foreground">
                  <span className="mr-2 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate">
                    Planned
                  </span>
                  <span className="font-medium text-navy">{feature.name}</span>
                  {' — '}
                  {feature.description}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="mt-8 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          AeroJudge is designed for FAI-style Paragliding Accuracy competition workflows, with scoring
          profiles based on supported FAI Sporting Code rules. It is independently developed by Nepalabs
          and is not presented as official FAI software or FAI-certified.
        </p>
      </div>
    </section>
  );
}
