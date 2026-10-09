import { describe, expect, it } from 'vitest';
import { AppError } from '../utils/errors.js';
import { isHeicPhoto, prepareFeedPhoto } from '../utils/feed-photo.js';

function file(partial: {
  mimetype: string;
  originalname: string;
  buffer: Buffer;
}): Express.Multer.File {
  return {
    fieldname: 'photo',
    encoding: '7bit',
    size: partial.buffer.length,
    stream: undefined as unknown as Express.Multer.File['stream'],
    destination: '',
    filename: '',
    path: '',
    ...partial,
  };
}

describe('event feed photos', () => {
  it('recognizes an iPhone HEIC even when the browser sends no image type', () => {
    const buffer = Buffer.alloc(16);
    buffer.write('ftyp', 4, 'ascii');
    buffer.write('heic', 8, 'ascii');
    expect(
      isHeicPhoto({
        mimetype: 'application/octet-stream',
        originalname: 'IMG_1554.HEIC',
        buffer,
      }),
    ).toBe(true);
    expect(
      isHeicPhoto({
        mimetype: '',
        originalname: 'IMG_1554.HEIC',
        buffer: Buffer.from('not-an-image'),
      }),
    ).toBe(true);
  });

  it('leaves JPEG, PNG, and WebP uploads unchanged', async () => {
    const jpeg = file({
      mimetype: 'image/jpeg',
      originalname: 'target.jpg',
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    });
    await expect(prepareFeedPhoto(jpeg)).resolves.toBe(jpeg);

    const png = file({
      mimetype: 'image/png',
      originalname: 'target.png',
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    });
    await expect(prepareFeedPhoto(png)).resolves.toBe(png);
  });

  it('rejects files that are not a photo Cloudinary can store', async () => {
    const pdf = file({
      mimetype: 'application/pdf',
      originalname: 'form.pdf',
      buffer: Buffer.from('%PDF-1.4'),
    });
    await expect(prepareFeedPhoto(pdf)).rejects.toBeInstanceOf(AppError);
  });
});
