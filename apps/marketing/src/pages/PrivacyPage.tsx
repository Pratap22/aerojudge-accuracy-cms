import { Link } from 'react-router-dom';
import { siteConfig } from '@/config/site';

export default function PrivacyPage() {
  return (
    <article className="content-width section-pad max-w-3xl">
      <p className="eyebrow">Legal</p>
      <h1 className="mt-2 font-display text-4xl font-bold text-navy">Privacy Policy</h1>
      <p className="mt-4 text-sm text-muted-foreground">Last updated: August 2026</p>
      <div className="prose-marketing mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          {siteConfig.productName} is operated by {siteConfig.companyName}. This page describes how we handle
          information when you visit the public marketing website and when organizations use the product.
        </p>
        <p>
          The marketing site itself does not require an account. Contact emails you send to{' '}
          {siteConfig.contactEmail} are used only to respond to your inquiry.
        </p>
        <p>
          When you use AeroJudge applications (Admin, Scoring, Display, Live Results), competition and
          organization data is processed to provide the service — including accounts, roles, pilots, scores,
          rankings and generated reports. Organization data is intended to remain isolated between tenants.
        </p>
        <p>
          For detailed data-processing terms for a production deployment, contact {siteConfig.companyName} at{' '}
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
