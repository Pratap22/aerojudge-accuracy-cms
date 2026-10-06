import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';
import { AppError } from './errors.js';

let configured = false;

function ensureConfigured() {
  if (!env.cloudinaryEnabled) {
    throw AppError.badRequest(
      'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.',
      'CLOUDINARY_NOT_CONFIGURED',
    );
  }
  if (!configured) {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }
}

/**
 * Upload an image buffer to Cloudinary.
 * Returns the secure HTTPS URL of the stored asset.
 */
export async function uploadImageToCloudinary(
  file: Express.Multer.File,
  options: {
    folder: string;
    publicId?: string;
    /** Max edge length. Portraits stay square-limited; event photos can be larger. */
    maxEdge?: number;
    /** Sponsor logos may be SVG. Stored without a raster resize. */
    allowSvg?: boolean;
  },
): Promise<{ url: string; publicId: string }> {
  ensureConfigured();

  const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  if (options.allowSvg) allowed.push('image/svg+xml');
  if (!allowed.includes(file.mimetype)) {
    throw AppError.badRequest(
      options.allowSvg
        ? 'Image must be PNG, JPEG, WebP, GIF, or SVG'
        : 'Image must be PNG, JPEG, WebP, or GIF',
    );
  }

  const folder = `${env.CLOUDINARY_FOLDER.replace(/\/+$/, '')}/${options.folder}`.replace(
    /\/{2,}/g,
    '/',
  );
  const maxEdge = options.maxEdge ?? 800;
  const isSvg = file.mimetype === 'image/svg+xml';

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: options.publicId,
        overwrite: true,
        resource_type: 'image',
        ...(isSvg
          ? {}
          : {
              transformation: [
                {
                  width: maxEdge,
                  height: maxEdge,
                  crop: 'limit',
                  quality: 'auto',
                  fetch_format: 'auto',
                },
              ],
            }),
      },
      (err, result) => {
        if (err || !result?.secure_url) {
          reject(
            AppError.badRequest(
              err?.message || 'Cloudinary upload failed',
              'CLOUDINARY_UPLOAD_FAILED',
            ),
          );
          return;
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    stream.end(file.buffer);
  });
}

/**
 * Store a signed protest form. PDFs are kept as documents; scans are stored as images.
 */
export async function uploadDocumentToCloudinary(
  file: Express.Multer.File,
  options: { folder: string; publicId?: string },
): Promise<{ url: string; publicId: string }> {
  ensureConfigured();

  const imageTypes = ['image/png', 'image/jpeg', 'image/webp'];
  const isPdf = file.mimetype === 'application/pdf';
  if (!isPdf && !imageTypes.includes(file.mimetype)) {
    throw AppError.badRequest('Signed form must be a PDF, PNG, JPEG, or WebP file');
  }

  const folder = `${env.CLOUDINARY_FOLDER.replace(/\/+$/, '')}/${options.folder}`.replace(
    /\/{2,}/g,
    '/',
  );
  const resourceType = isPdf ? 'raw' : 'image';
  const publicId = isPdf && options.publicId && !options.publicId.endsWith('.pdf')
    ? `${options.publicId}.pdf`
    : options.publicId;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        overwrite: true,
        resource_type: resourceType,
        ...(isPdf
          ? {}
          : {
              transformation: [
                { width: 2000, height: 2000, crop: 'limit', quality: 'auto', fetch_format: 'auto' },
              ],
            }),
      },
      (err, result) => {
        if (err || !result?.secure_url) {
          reject(
            AppError.badRequest(
              err?.message || 'Cloudinary upload failed',
              'CLOUDINARY_UPLOAD_FAILED',
            ),
          );
          return;
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    stream.end(file.buffer);
  });
}

/** Remove a Cloudinary asset when the stored URL points at this account. */
export async function destroyCloudinaryImage(url: string | null | undefined): Promise<void> {
  if (!url || !env.cloudinaryEnabled || !url.includes('res.cloudinary.com')) return;
  const publicId = cloudinaryPublicId(url);
  if (!publicId) return;
  ensureConfigured();
  await cloudinary.uploader.destroy(publicId, { resource_type: 'image' }).catch(() => undefined);
}

/**
 * Load a stored file. Public PDF links are blocked by Cloudinary unless the
 * account allows PDF delivery, so documents are fetched with an API download.
 */
export async function fetchStoredCloudinaryFile(
  url: string,
): Promise<{ body: Buffer; contentType: string }> {
  ensureConfigured();
  const asset = cloudinaryAssetFromUrl(url);
  if (!asset) throw AppError.badRequest('Stored file is not a Cloudinary asset');

  const downloadUrl =
    asset.resourceType === 'raw'
      ? cloudinary.utils.private_download_url(asset.publicId, fileFormat(asset.publicId), {
          resource_type: 'raw',
          type: 'upload',
          expires_at: Math.floor(Date.now() / 1000) + 120,
        })
      : url;

  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw AppError.badRequest('Could not load the signed form');
  }
  const body = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim();
  return {
    body,
    contentType: contentType || (asset.resourceType === 'raw' ? 'application/pdf' : 'application/octet-stream'),
  };
}

function fileFormat(publicId: string): string {
  const match = publicId.match(/\.([a-z0-9]+)$/i);
  return match?.[1]?.toLowerCase() || 'pdf';
}

/** Remove an image or raw (PDF) Cloudinary asset. */
export async function destroyCloudinaryAsset(url: string | null | undefined): Promise<void> {
  if (!url || !env.cloudinaryEnabled || !url.includes('res.cloudinary.com')) return;
  const asset = cloudinaryAssetFromUrl(url);
  if (!asset) return;
  ensureConfigured();
  await cloudinary.uploader
    .destroy(asset.publicId, { resource_type: asset.resourceType })
    .catch(() => undefined);
}

/** Delivery URL that rasterizes the asset as PNG so PDFKit can embed it. */
export function cloudinaryPngDeliveryUrl(url: string): string {
  if (!url.includes('res.cloudinary.com')) return url;
  const marker = '/image/upload/';
  const index = url.indexOf(marker);
  if (index < 0) return url;
  const rest = url.slice(index + marker.length);
  if (rest.startsWith('f_png')) return url;
  return `${url.slice(0, index + marker.length)}f_png/${rest}`;
}

function cloudinaryPublicId(url: string): string | null {
  return cloudinaryAssetFromUrl(url)?.publicId ?? null;
}

function cloudinaryAssetFromUrl(
  url: string,
): { publicId: string; resourceType: 'image' | 'raw' | 'video' } | null {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\/(image|raw|video)\/upload\//);
    if (!match) return null;
    const resourceType = match[1] as 'image' | 'raw' | 'video';
    const marker = `/${resourceType}/upload/`;
    const index = pathname.indexOf(marker);
    const parts = pathname.slice(index + marker.length).split('/').filter(Boolean);
    const versionIndex = parts.findIndex((part) => /^v\d+$/.test(part));
    const idParts = (versionIndex >= 0 ? parts.slice(versionIndex + 1) : parts).filter(
      (part) => !part.includes(','),
    );
    if (idParts.length === 0) return null;
    const lastPart = idParts[idParts.length - 1]!;
    const last = resourceType === 'raw' ? lastPart : lastPart.replace(/\.[a-z0-9]+$/i, '');
    return { resourceType, publicId: [...idParts.slice(0, -1), last].join('/') };
  } catch {
    return null;
  }
}
