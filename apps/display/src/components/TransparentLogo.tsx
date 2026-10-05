import { useEffect, useState } from 'react';

function isNearWhite(px: Uint8ClampedArray, index: number): boolean {
  const min = Math.min(px[index] ?? 0, px[index + 1] ?? 0, px[index + 2] ?? 0);
  return min > 235 && (px[index + 3] ?? 0) > 16;
}

/**
 * Remove only the white that touches the edge of the file, so a white
 * mat disappears and white inside the logo stays.
 */
function knockOutWhite(img: HTMLImageElement): string | null {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || canvas.width === 0 || canvas.height === 0) return null;
  ctx.drawImage(img, 0, 0);
  let image: ImageData;
  try {
    image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  } catch {
    return null;
  }

  const { width, height } = canvas;
  const px = image.data;
  const seen = new Uint8Array(width * height);
  const stack: number[] = [];

  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const pixel = y * width + x;
    if (seen[pixel]) return;
    if (!isNearWhite(px, pixel * 4)) return;
    seen[pixel] = 1;
    stack.push(pixel);
  };

  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y);
    push(width - 1, y);
  }

  while (stack.length > 0) {
    const pixel = stack.pop()!;
    px[pixel * 4 + 3] = 0;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}

export function TransparentLogo({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      setUrl(knockOutWhite(img) ?? src);
    };
    img.onerror = () => {
      if (!cancelled) setUrl(src);
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!url) return <span className={className} aria-hidden />;
  return <img src={url} alt={alt} className={className} />;
}
