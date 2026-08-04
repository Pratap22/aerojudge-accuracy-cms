import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getApp } from '@/config/apps';
import { mailtoContact, siteConfig } from '@/config/site';
import { easeOut } from '@/lib/motion';
import { AeroJudgeMark } from '../ui/AeroJudgeMark';
import { MarketingButton } from '../ui/MarketingButton';

const navLinks = [
  { href: '/#problem', label: 'Why AeroJudge' },
  { href: '/#testimonials', label: 'Events' },
  { href: '/#solution', label: 'How it works' },
  { href: '/#roles', label: 'Roles' },
  { href: '/#features', label: 'Features' },
  { href: '/#apps', label: 'Apps' },
  { href: '/#pricing', label: 'Pricing' },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const location = useLocation();
  const reduce = useReducedMotion();
  const adminHref = getApp('admin').href;

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-md">
      <div className="content-width flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-primary"
        >
          <AeroJudgeMark className="h-8 w-8" />
          <span>{siteConfig.productName}</span>
        </Link>

        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Primary">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <MarketingButton href={adminHref} variant="ghost" size="md">
            Sign in
          </MarketingButton>
          <MarketingButton href={mailtoContact('AeroJudge demo request')} variant="primary" size="md">
            Request a Demo
          </MarketingButton>
        </div>

        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border lg:hidden"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            id={menuId}
            className="overflow-hidden border-t border-border bg-background px-4 lg:hidden"
            role="dialog"
            aria-label="Mobile navigation"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduce ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: easeOut }}
          >
            <div className="py-4">
              <nav className="flex flex-col gap-1" aria-label="Mobile primary">
                {navLinks.map((link, i) => (
                  <motion.a
                    key={link.href}
                    href={link.href}
                    className="rounded-md px-3 py-3 text-base font-medium text-navy"
                    onClick={() => setOpen(false)}
                    initial={reduce ? false : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.04 * i, duration: 0.25 }}
                  >
                    {link.label}
                  </motion.a>
                ))}
              </nav>
              <div className="mt-4 flex flex-col gap-2">
                <MarketingButton href={adminHref} variant="secondary" size="lg" className="w-full">
                  Sign in
                </MarketingButton>
                <MarketingButton
                  href={mailtoContact('AeroJudge demo request')}
                  variant="primary"
                  size="lg"
                  className="w-full"
                >
                  Request a Demo
                </MarketingButton>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
