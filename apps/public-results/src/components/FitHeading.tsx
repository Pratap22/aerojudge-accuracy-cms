import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

interface FitHeadingProps {
  children: ReactNode;
  className?: string;
  /** Smallest allowed font size in px */
  minPx?: number;
  /** Largest allowed font size in px (short titles) */
  maxPx?: number;
  /** Cap title block height as a fraction of the viewport */
  maxHeightVh?: number;
}

/**
 * Scales a heading down so the full text fits the container width and a
 * viewport-relative max height — long competition names stay readable.
 */
export function FitHeading({
  children,
  className,
  minPx = 28,
  maxPx = 112,
  maxHeightVh = 40,
}: FitHeadingProps) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [fontSize, setFontSize] = useState(maxPx);

  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    const maxHeight = Math.max(minPx * 2, window.innerHeight * (maxHeightVh / 100));
    let lo = minPx;
    let hi = maxPx;
    let best = minPx;

    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      el.style.fontSize = `${mid}px`;
      const overflows = el.scrollHeight > maxHeight + 1 || el.scrollWidth > el.clientWidth + 1;
      if (overflows) {
        hi = mid;
      } else {
        best = mid;
        lo = mid;
      }
    }

    el.style.fontSize = `${best}px`;
    setFontSize(best);
  }, [maxHeightVh, maxPx, minPx]);

  useLayoutEffect(() => {
    fit();
    const parent = ref.current?.parentElement;
    const ro = new ResizeObserver(() => fit());
    if (parent) ro.observe(parent);
    window.addEventListener('resize', fit);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, [children, fit]);

  return (
    <h1 ref={ref} className={className} style={{ fontSize }}>
      {children}
    </h1>
  );
}
