import type { RequestHandler } from 'express';
import multer from 'multer';
import { AppError } from './errors.js';

function formatMaxSize(maxBytes: number): string {
  if (maxBytes >= 1024 * 1024) {
    const mb = maxBytes / (1024 * 1024);
    return Number.isInteger(mb) ? `${mb} MB` : `${mb.toFixed(1)} MB`;
  }
  return `${Math.round(maxBytes / 1024)} KB`;
}

/** Map Multer errors to AppError (used by wrappers and the global error handler). */
export function multerErrorToAppError(
  err: multer.MulterError,
  maxBytes?: number,
  label = 'File',
): AppError {
  if (err.code === 'LIMIT_FILE_SIZE') {
    const sizeHint = maxBytes
      ? ` Maximum size is ${formatMaxSize(maxBytes)}.`
      : ' Please upload a smaller file.';
    return AppError.payloadTooLarge(`${label} is too large.${sizeHint}`, 'FILE_TOO_LARGE', {
      maxBytes,
      field: err.field,
      code: err.code,
    });
  }

  const messages: Record<string, string> = {
    LIMIT_FILE_COUNT: 'Too many files uploaded.',
    LIMIT_UNEXPECTED_FILE: `Unexpected file field${err.field ? ` "${err.field}"` : ''}.`,
    LIMIT_PART_COUNT: 'Upload has too many parts.',
    LIMIT_FIELD_KEY: 'Upload field name is too long.',
    LIMIT_FIELD_VALUE: 'Upload field value is too long.',
    LIMIT_FIELD_COUNT: 'Upload has too many fields.',
  };

  return AppError.badRequest(
    messages[err.code] ?? err.message ?? 'Upload failed',
    'UPLOAD_ERROR',
    { code: err.code, field: err.field },
  );
}

export function isMulterError(err: unknown): err is multer.MulterError {
  return (
    err instanceof multer.MulterError ||
    (typeof err === 'object' &&
      err !== null &&
      (err as { name?: string }).name === 'MulterError')
  );
}

/**
 * Multer single-file middleware that converts size/limit errors into AppError
 * so clients receive a clear 4xx response instead of a 500.
 */
export function singleFileUpload(
  field: string,
  options: { maxBytes: number; label?: string },
): RequestHandler {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: options.maxBytes },
  }).single(field);

  const label = options.label ?? 'File';

  return (req, res, next) => {
    upload(req, res, (err: unknown) => {
      if (!err) {
        next();
        return;
      }
      if (isMulterError(err)) {
        next(multerErrorToAppError(err, options.maxBytes, label));
        return;
      }
      next(err);
    });
  };
}
