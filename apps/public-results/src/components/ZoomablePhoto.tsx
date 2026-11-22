import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

const MIN_SCALE = 1;
const MAX_SCALE = 5;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function pointerDistance(points: { x: number; y: number }[]) {
  const [a, b] = points;
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function PhotoStage({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  function applyScale(next: number) {
    const clamped = clamp(next, MIN_SCALE, MAX_SCALE);
    scaleRef.current = clamped;
    setScale(clamped);
    if (clamped === MIN_SCALE) {
      offsetRef.current = { x: 0, y: 0 };
      setOffset({ x: 0, y: 0 });
    }
  }

  function applyOffset(next: { x: number; y: number }) {
    offsetRef.current = next;
    setOffset(next);
  }

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const stage = stageRef.current;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.12 : 0.9;
      applyScale(scaleRef.current * factor);
    };
    stage?.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
      stage?.removeEventListener('wheel', onWheel);
    };
  }, [onClose]);

  return (
    <div
      ref={stageRef}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest('button')) return;
        stageRef.current?.setPointerCapture(event.pointerId);
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.current.size === 1) {
          dragRef.current = {
            x: event.clientX,
            y: event.clientY,
            ox: offsetRef.current.x,
            oy: offsetRef.current.y,
          };
        }
        if (pointers.current.size === 2) {
          pinchRef.current = {
            distance: pointerDistance([...pointers.current.values()]),
            scale: scaleRef.current,
          };
        }
      }}
      onPointerMove={(event) => {
        if (!pointers.current.has(event.pointerId)) return;
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.current.size >= 2 && pinchRef.current && pinchRef.current.distance > 0) {
          const nextDistance = pointerDistance([...pointers.current.values()]);
          applyScale(pinchRef.current.scale * (nextDistance / pinchRef.current.distance));
          return;
        }
        if (scaleRef.current > 1 && dragRef.current) {
          applyOffset({
            x: dragRef.current.ox + (event.clientX - dragRef.current.x),
            y: dragRef.current.oy + (event.clientY - dragRef.current.y),
          });
        }
      }}
      onPointerUp={(event) => {
        pointers.current.delete(event.pointerId);
        if (pointers.current.size < 2) pinchRef.current = null;
        if (pointers.current.size === 0) dragRef.current = null;
      }}
      onPointerCancel={(event) => {
        pointers.current.delete(event.pointerId);
        pinchRef.current = null;
        dragRef.current = null;
      }}
      onDoubleClick={() => applyScale(scaleRef.current > 1 ? 1 : 2.5)}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
        aria-label="Close photo"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <X className="h-5 w-5" />
      </button>
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="max-h-[100dvh] max-w-[100vw] select-none object-contain"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          touchAction: 'none',
          cursor: scale > 1 ? 'grab' : 'zoom-in',
        }}
      />
    </div>
  );
}

/** Thumbnail that opens the original photo full screen. Pinch, scroll, or double-click to zoom. */
export function ZoomablePhoto({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`View photo of ${alt}`}
        className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
      >
        <img src={src} alt="" className={className} />
      </button>
      {open ? <PhotoStage src={src} alt={alt} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
