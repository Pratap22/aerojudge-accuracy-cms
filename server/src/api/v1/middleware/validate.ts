import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
import { AppError } from '../../../utils/errors.js';

type RequestPart = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, part: RequestPart = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      next(
        AppError.badRequest('Validation failed', 'VALIDATION_ERROR', result.error.flatten()),
      );
      return;
    }
    req[part] = result.data;
    next();
  };
}

export function validateBody<T extends ZodSchema>(schema: T) {
  return validate(schema, 'body');
}

export function validateQuery<T extends ZodSchema>(schema: T) {
  return validate(schema, 'query');
}

export function validateParams<T extends ZodSchema>(schema: T) {
  return validate(schema, 'params');
}
