'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';

import { cn } from '../lib/utils';
import { Button } from './button';

export interface ThemeToggleProps extends React.ComponentPropsWithoutRef<typeof Button> {
  /** localStorage key for persisting theme preference */
  storageKey?: string;
}

type Theme = 'light' | 'dark';

function getStoredTheme(storageKey: string): Theme | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(storageKey);
  if (stored === 'light' || stored === 'dark') return stored;
  return null;
}

function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
}

export function ThemeToggle({
  storageKey = 'npha-theme',
  className,
  variant = 'outline',
  size = 'icon',
  ...props
}: ThemeToggleProps) {
  const [theme, setTheme] = React.useState<Theme>('light');
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    const initial = getStoredTheme(storageKey) ?? getSystemTheme();
    setTheme(initial);
    applyTheme(initial);
    setMounted(true);
  }, [storageKey]);

  const toggleTheme = React.useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      localStorage.setItem(storageKey, next);
      return next;
    });
  }, [storageKey]);

  if (!mounted) {
    return (
      <Button variant={variant} size={size} className={cn(className)} disabled aria-hidden {...props}>
        <Sun className="h-4 w-4" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={cn(className)}
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      {...props}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
