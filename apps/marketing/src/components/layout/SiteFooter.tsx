import { Link } from 'react-router-dom';
import { aeroJudgeApps, getApp } from '@/config/apps';
import { siteConfig } from '@/config/site';
import { AeroJudgeMark } from '../ui/AeroJudgeMark';

const productLinks = [
  { href: '/#features', label: 'Features' },
  { href: '/#testimonials', label: 'Completed events' },
  { href: '/#pricing', label: 'Pricing' },
  { href: siteConfig.docsUrl, label: 'Documentation', external: true },
  { href: `mailto:${siteConfig.contactEmail}`, label: 'Contact', external: true },
];

const legalLinks = [
  { to: '/privacy', label: 'Privacy Policy' },
  { to: '/terms', label: 'Terms' },
];

export function SiteFooter() {
  const admin = getApp('admin');

  return (
    <footer className="border-t border-border bg-navy text-white">
      <div className="content-width section-pad !py-12 sm:!py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
              <AeroJudgeMark className="h-8 w-8" variant="onDark" />
              {siteConfig.productName}
            </div>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/70">
              Developed by {siteConfig.companyName}. {siteConfig.tagline}.
            </p>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-sky">Product</h2>
            <ul className="mt-4 space-y-2.5">
              {productLinks.map((link) => (
                <li key={link.label}>
                  {'external' in link && link.external ? (
                    <a
                      href={link.href}
                      className="text-sm text-white/75 transition-colors hover:text-white"
                      {...(link.href.startsWith('http')
                        ? { target: '_blank', rel: 'noopener noreferrer' }
                        : {})}
                    >
                      {link.label}
                    </a>
                  ) : (
                    <a href={link.href} className="text-sm text-white/75 transition-colors hover:text-white">
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-sky">Applications</h2>
            <ul className="mt-4 space-y-2.5">
              {aeroJudgeApps.map((app) => (
                <li key={app.id}>
                  <a href={app.href} className="text-sm text-white/75 transition-colors hover:text-white">
                    {app.shortName}
                  </a>
                </li>
              ))}
              <li>
                <a href={admin.href} className="text-sm text-white/75 transition-colors hover:text-white">
                  Application Login
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-sky">Legal</h2>
            <ul className="mt-4 space-y-2.5">
              {legalLinks.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-sm text-white/75 transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {siteConfig.companyName}. {siteConfig.productName}.
          </p>
          <p>Designed for FAI-style Paragliding Accuracy competition workflows.</p>
        </div>
      </div>
    </footer>
  );
}
