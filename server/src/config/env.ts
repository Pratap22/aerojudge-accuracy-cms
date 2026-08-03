import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv({ path: path.resolve(process.cwd(), '../.env') });
loadDotenv();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  API_PREFIX: z.string().default('/api/v1'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE_MB: z.coerce.number().positive().default(10),
  PRINT_ARCHIVE_DIR: z.string().default('./uploads/documents/prints'),
  PUBLIC_RESULTS_URL: z.string().url().default('http://localhost:3003'),
  /** Public origin for API + /uploads (absolute logo URLs). Falls back to API_URL or localhost:PORT. */
  PUBLIC_API_URL: z.string().url().optional(),
  API_URL: z.string().url().optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(15_000),
  /** Cloudinary — required for competition official photo uploads */
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_FOLDER: z.string().default('aerojudge'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const raw = parsed.data;

export const env = {
  ...raw,
  corsOrigins: raw.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
  uploadDir: path.resolve(raw.UPLOAD_DIR),
  printArchiveDir: path.resolve(raw.PRINT_ARCHIVE_DIR),
  maxFileSizeBytes: raw.MAX_FILE_SIZE_MB * 1024 * 1024,
  isProduction: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  publicApiUrl: (
    raw.PUBLIC_API_URL ??
    raw.API_URL ??
    `http://localhost:${raw.PORT}`
  ).replace(/\/+$/, ''),
  cloudinaryEnabled: Boolean(
    raw.CLOUDINARY_CLOUD_NAME && raw.CLOUDINARY_API_KEY && raw.CLOUDINARY_API_SECRET,
  ),
} as const;

export type Env = typeof env;
