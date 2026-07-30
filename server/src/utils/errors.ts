import type { NextFunction, Request, Response } from 'express';
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

  if (err instanceof Error && err.name === 'ZodError') {
    sendError(res, 400, 'VALIDATION_ERROR', 'Validation failed', err);
    return;
  }

  console.error('Unhandled error:', err);
  sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
}
