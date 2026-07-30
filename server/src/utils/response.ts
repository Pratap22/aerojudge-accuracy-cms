import type { Response } from 'express';
import type { ApiResponse } from '@npha/shared';

function meta(extra?: Partial<NonNullable<ApiResponse<unknown>['meta']>>) {
  return {
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  pagination?: { page: number; pageSize: number; total: number },
): void {
  const body: ApiResponse<T> = {
    success: true,
    data,
    meta: meta(pagination),
  };
  res.status(statusCode).json(body);
}

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
): void {
  const body: ApiResponse<never> = {
    success: false,
    error: { code, message, details },
    meta: meta(),
  };
  res.status(statusCode).json(body);
}
