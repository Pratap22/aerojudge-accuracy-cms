/**
 * Object URL that an `<img>` can paint.
 * HEIC/HEIF is decoded to JPEG for the preview only — the original file is still uploaded.
 */
export async function createPhotoPreviewUrl(file: File): Promise<string> {
  if (!isHeicPhoto(file)) return URL.createObjectURL(file);

  const nativeUrl = URL.createObjectURL(file);
  if (await imageDecodes(nativeUrl)) return nativeUrl;
  URL.revokeObjectURL(nativeUrl);

  const converted = await convertHeicToJpeg(file);
  return URL.createObjectURL(converted);
}

/** iPhone photos often arrive with an empty MIME type and only a .HEIC name. */
export function isHeicPhoto(file: File): boolean {
  const type = file.type.toLowerCase();
  return (
    type.startsWith('image/heic') ||
    type.startsWith('image/heif') ||
    /\.hei[cf]$/i.test(file.name)
  );
}

function imageDecodes(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(ok);
    };
    const timer = window.setTimeout(() => finish(false), 2000);
    img.onload = () => finish(img.naturalWidth > 0);
    img.onerror = () => finish(false);
    img.src = url;
  });
}

interface Heic2AnyWindow {
  heic2any?: (options: {
    blob: Blob;
    toType?: string;
    quality?: number;
  }) => Promise<Blob | Blob[]>;
}

async function convertHeicToJpeg(file: File): Promise<Blob> {
  // UMD build: Vite serves the script, which assigns `window.heic2any`.
  await import('heic2any');
  const heic2any = (window as Window & Heic2AnyWindow).heic2any;
  if (!heic2any) {
    throw new Error('Could not preview that HEIC photo.');
  }
  const converted = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.85,
  });
  const blob = Array.isArray(converted) ? converted[0] : converted;
  if (!(blob instanceof Blob)) {
    throw new Error('Could not preview that HEIC photo.');
  }
  return blob;
}
