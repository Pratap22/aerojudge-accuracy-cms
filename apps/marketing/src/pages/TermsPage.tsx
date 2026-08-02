import { Link } from 'react-router-dom';
import { siteConfig } from '@/config/site';

export default function TermsPage() {
  return (
    <article className="content-width section-pad max-w-3xl">
      <p className="eyebrow">Legal</p>
      <h1 className="mt-2 font-display text-4xl font-bold text-navy">Terms of Use</h1>
      <p className="mt-4 text-sm text-muted-foreground">Last updated: August 2026</p>
      <div className="mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          By accessing the {siteConfig.productName} marketing website or applications operated by{' '}
          {siteConfig.companyName}, you agree to use the service lawfully and in accordance with your
          organization&apos;s competition rules and applicable regulations.
        </p>
        <p>
          {siteConfig.productName} provides competition management software. It is independently developed and
          is not official FAI software. Competition outcomes remain the responsibility of the organizing
          authority and appointed officials.
        </p>
        <p>
          Plan features, support levels and commercial terms are defined by your agreement with{' '}
          {siteConfig.companyName}. Community / free usage remains subject to fair-use and configured plan
          limits.
        </p>
        <p>
          Questions:{' '}
          <a className="font-medium text-navy underline-offset-2 hover:underline" href={`mailto:${siteConfig.contactEmail}`}>
            {siteConfig.contactEmail}
          </a>
          .
        </p>
        <p>
          <Link to="/" className="font-medium text-navy underline-offset-2 hover:underline">
            ← Back to AeroJudge
          </Link>
        </p>
      </div>
    </article>
  );
}
