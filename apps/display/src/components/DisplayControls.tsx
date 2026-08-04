import { useState } from 'react';
import { motion } from 'framer-motion';
import { Maximize, Minimize, Eye, EyeOff } from 'lucide-react';
import type { DisplayLayoutType } from '../lib/types';

export type OptionalDisplayLayout = 'women' | 'teams' | 'country' | 'sponsors';

interface DisplayControlsProps {
  layout: DisplayLayoutType;
  onLayoutChange: (layout: DisplayLayoutType) => void;
  kioskMode: boolean;
  onKioskToggle: () => void;
  /** Competition partners label — Sponsors / Supporters */
  partnersLabel?: string;
  /** When false, the matching tab is hidden (empty list). */
  tabVisibility?: Partial<Record<OptionalDisplayLayout, boolean>>;
}

export function DisplayControls({
  layout,
  onLayoutChange,
  kioskMode,
  onKioskToggle,
  partnersLabel = 'Sponsors',
  tabVisibility = {},
}: DisplayControlsProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [visible, setVisible] = useState(!kioskMode);

  const allLayouts: { id: DisplayLayoutType; label: string }[] = [
    { id: 'current', label: 'Current' },
    { id: 'top10', label: 'Top 10' },
    { id: 'women', label: 'Women' },
    { id: 'teams', label: 'Teams' },
    { id: 'country', label: 'Country' },
    { id: 'next', label: 'Next' },
    { id: 'sponsors', label: partnersLabel },
    { id: 'auto', label: 'Auto' },
  ];

  const layouts = allLayouts.filter((item) => {
    if (
      item.id === 'women' ||
      item.id === 'teams' ||
      item.id === 'country' ||
      item.id === 'sponsors'
    ) {
      return tabVisibility[item.id] !== false;
    }
    return true;
  });

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  if (kioskMode && !visible) {
    return (
      <button
        type="button"
        onClick={() => setVisible(true)}
        className="fixed bottom-4 right-4 z-50 rounded-full bg-sky-500/20 p-2 text-sky-300 opacity-0 transition-opacity hover:opacity-100 focus:opacity-100"
        aria-label="Show controls"
      >
        <Eye className="h-5 w-5" />
      </button>
    );
  }

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-sky-500/20 bg-broadcast-navy/95 backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-3">
        <div className="flex flex-wrap gap-2">
          {layouts.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => onLayoutChange(id)}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                layout === id
                  ? 'bg-sky-500 text-broadcast-navy'
                  : 'bg-broadcast-navy-light text-sky-300 hover:bg-sky-500/20'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onKioskToggle}
            className="rounded p-2 text-sky-300 hover:bg-sky-500/20"
            title={kioskMode ? 'Show cursor' : 'Kiosk mode (hide cursor)'}
          >
            {kioskMode ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded p-2 text-sky-300 hover:bg-sky-500/20"
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </button>
          {kioskMode && (
            <button
              type="button"
              onClick={() => setVisible(false)}
              className="rounded px-3 py-1.5 text-sm text-sky-400 hover:bg-sky-500/20"
            >
              Hide
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
