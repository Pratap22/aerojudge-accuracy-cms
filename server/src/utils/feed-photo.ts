import convert from 'heic-convert';
import { AppError } from './errors.js';

const RASTER_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

const HEIC_TYPES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);

/** Major and compatible brands used by iPhone HEIC/HEIF stills. */
const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'];

function mediaType(mimetype: string): string {
  return mimetype.toLowerCase().split(';')[0]?.trim() ?? '';
}

function isJpeg(buffer: Buffer): boolean {
  return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

function isPng(buffer: Buffer): boolean {
  return buffer.length >= 8 && buffer[0] === 0x89 && buffer.toString('ascii', 1, 4) === 'PNG';
}

function isWebp(buffer: Buffer): boolean {
  return (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  );
}

function hasHeicMagic(buffer: Buffer): boolean {
  if (buffer.length < 12 || buffer.toString('ascii', 4, 8) !== 'ftyp') return false;
  const brands = buffer.subarray(8, Math.min(buffer.length, 32)).toString('ascii').toLowerCase();
  return HEIC_BRANDS.some((brand) => brands.includes(brand));
}

/** iPhone photos often arrive as IMG_1554.HEIC with an empty or generic MIME type. */
export function isHeicPhoto(file: {
  mimetype: string;
  originalname: string;
  buffer: Buffer;
}): boolean {
  if (isJpeg(file.buffer) || isPng(file.buffer) || isWebp(file.buffer)) return false;
  if (hasHeicMagic(file.buffer)) return true;
  if (HEIC_TYPES.has(mediaType(file.mimetype))) return true;
  return /\.hei[cf]$/i.test(file.originalname);
}

/** Decode an iPhone HEIC/HEIF upload to JPEG. Other files are returned unchanged. */
export async function convertHeicUpload(file: Express.Multer.File): Promise<Express.Multer.File> {
  if (!isHeicPhoto(file)) return file;
  return convertHeicToJpeg(file);
}

/**
 * Turn an event-feed upload into a raster Cloudinary accepts.
 * HEIC/HEIF is decoded and re-encoded as JPEG before the upload.
 */
export async function prepareFeedPhoto(file: Express.Multer.File): Promise<Express.Multer.File> {
  if (isHeicPhoto(file)) return convertHeicUpload(file);

  const mimetype = mediaType(file.mimetype);
  const normalized = mimetype === 'image/jpg' || mimetype === 'image/pjpeg' ? 'image/jpeg' : mimetype;
  if (!RASTER_TYPES.has(normalized)) {
    throw AppError.badRequest('Photo must be PNG, JPEG, WebP, or HEIC');
  }
  if (normalized === file.mimetype) return file;
  return { ...file, mimetype: normalized };
}

async function convertHeicToJpeg(file: Express.Multer.File): Promise<Express.Multer.File> {
  try {
    const jpeg = await convert({
      buffer: Uint8Array.from(file.buffer),
      format: 'JPEG',
      quality: 0.92,
    });
    const buffer = Buffer.from(jpeg);
    const baseName = file.originalname.replace(/\.hei[cf]$/i, '') || 'photo';
    return {
      ...file,
      buffer,
      size: buffer.length,
      mimetype: 'image/jpeg',
      originalname: `${baseName}.jpg`,
    };
  } catch {
    throw AppError.badRequest('Could not read that HEIC photo. Export it as JPEG and try again.');
  }
}
