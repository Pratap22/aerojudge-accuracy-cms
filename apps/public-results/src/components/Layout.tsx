import type { ReactNode } from 'react';
import { Navigation } from './Navigation';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-[#050d1a] text-white">
      <Navigation />
      <main className="pt-20">{children}</main>
    </div>
  );
}
