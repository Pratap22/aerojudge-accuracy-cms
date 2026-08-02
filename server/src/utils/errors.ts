import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { sendError } from './response.js';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(message: string, code = 'BAD_REQUEST', details?: unknown): AppError {
    return new AppError(400, code, message, details);
  }

  static unauthorized(message = 'Unauthorized', code = 'UNAUTHORIZED'): AppError {
    return new AppError(401, code, message);
  }

  static forbidden(message = 'Forbidden', code = 'FORBIDDEN'): AppError {
    return new AppError(403, code, message);
  }

  static notFound(message = 'Not found', code = 'NOT_FOUND'): AppError {
    return new AppError(404, code, message);
  }

  static conflict(message: string, code = 'CONFLICT'): AppError {
    return new AppError(409, code, message);
  }

  static payloadTooLarge(
    message: string,
    code = 'PAYLOAD_TOO_LARGE',
    details?: unknown,
  ): AppError {
    return new AppError(413, code, message, details);
  }

  static internal(message = 'Internal server error', code = 'INTERNAL_ERROR'): AppError {
    return new AppError(500, code, message);
  }
}

export type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void>;

export function asyncHandler(fn: AsyncRequestHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void fn(req, res, next).catch(next);
  };
}

function isMulterError(err: unknown): err is multer.MulterError {
  return (
    err instanceof multer.MulterError ||
    (typeof err === 'object' &&
      err !== null &&
      (err as { name?: string }).name === 'MulterError')
  );
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  if (isMulterError(err)) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      sendError(res, 413, 'FILE_TOO_LARGE', 'File is too large. Please upload a smaller file.', {
        code: err.code,
        field: err.field,
      });
      return;
    }
    sendError(res, 400, 'UPLOAD_ERROR', err.message || 'Upload failed', {
      code: err.code,
      field: err.field,
    });
    return;
  }

  if (err instanceof Error && err.name === 'ZodError') {
    sendError(res, 400, 'VALIDATION_ERROR', 'Validation failed', err);
    return;
  }

  console.error('Unhandled error:', err);

  // Prisma unique constraint — surface as 409 instead of opaque 500
  if (
    err &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code?: string }).code === 'P2002'
  ) {
    const target = (err as { meta?: { target?: string[] } }).meta?.target;
    sendError(
      res,
      409,
      'CONFLICT',
      target?.length
        ? `A record with this ${target.join(', ')} already exists`
        : 'A conflicting record already exists',
    );
    return;
  }

  sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
}
