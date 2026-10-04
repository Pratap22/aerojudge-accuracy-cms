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
  },
): Promise<{ url: string; publicId: string }> {
  ensureConfigured();

  const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  if (!allowed.includes(file.mimetype)) {
    throw AppError.badRequest('Image must be PNG, JPEG, WebP, or GIF');
  }

  const folder = `${env.CLOUDINARY_FOLDER.replace(/\/+$/, '')}/${options.folder}`.replace(
    /\/{2,}/g,
    '/',
  );
  const maxEdge = options.maxEdge ?? 800;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: options.publicId,
        overwrite: true,
        resource_type: 'image',
        transformation: [
          { width: maxEdge, height: maxEdge, crop: 'limit', quality: 'auto', fetch_format: 'auto' },
        ],
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

function cloudinaryPublicId(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const marker = '/image/upload/';
    const index = pathname.indexOf(marker);
    if (index < 0) return null;
    const parts = pathname.slice(index + marker.length).split('/').filter(Boolean);
    const versionIndex = parts.findIndex((part) => /^v\d+$/.test(part));
    const idParts = (versionIndex >= 0 ? parts.slice(versionIndex + 1) : parts).filter(
      (part) => !part.includes(','),
    );
    if (idParts.length === 0) return null;
    const last = idParts[idParts.length - 1]!.replace(/\.[a-z0-9]+$/i, '');
    return [...idParts.slice(0, -1), last].join('/');
  } catch {
    return null;
  }
}
