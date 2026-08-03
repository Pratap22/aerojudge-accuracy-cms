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
  options: { folder: string; publicId?: string },
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

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: options.publicId,
        overwrite: true,
        resource_type: 'image',
        transformation: [
          { width: 800, height: 800, crop: 'limit', quality: 'auto', fetch_format: 'auto' },
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
