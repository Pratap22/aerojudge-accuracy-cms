import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { env, isDevLanOrigin } from './config/env.js';
import { disconnectPrisma } from './config/prisma.js';
import apiRoutes from './api/v1/routes/index.js';
import { openApiSpec } from './api/openapi.js';
import { errorHandler } from './utils/errors.js';
import { initSocket } from './socket/index.js';

const app = express();

app.set('trust proxy', 1);

app.use(
  helmet({
    // Allow admin/judge/display (other origins) to render /uploads images via <img src>.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);
app.use(
  cors({
    // Live/production keeps the explicit allowlist. LAN hosts are development-only.
    origin:
      env.isProduction || env.isTest
        ? env.corsOrigins
        : (origin, callback) => {
            callback(null, isDevLanOrigin(origin));
          },
    credentials: true,
  }),
);
app.use(morgan(env.isProduction ? 'combined' : 'dev'));
app.use(express.json({ limit: `${env.MAX_FILE_SIZE_MB}mb` }));
app.use(express.urlencoded({ extended: true }));
app.use(
  '/uploads',
  (_req, res, next) => {
    // Explicit for static assets (logos) loaded cross-origin from Vite apps.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(env.uploadDir),
);

app.use(
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => !env.isProduction,
  }),
);

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
app.get('/api/docs.json', (_req, res) => {
  res.json(openApiSpec);
});

app.use(env.API_PREFIX, apiRoutes);

app.use(errorHandler);

const httpServer = createServer(app);
initSocket(httpServer);

export { app, httpServer };

export function startServer(): void {
  const onListening = () => {
    console.log(`AeroJudge API listening on port ${env.PORT}`);
    console.log(`Swagger docs: http://localhost:${env.PORT}/api/docs`);
    console.log(`API base: http://localhost:${env.PORT}${env.API_PREFIX}`);
  };
  // Production keeps Node's default bind (all interfaces, including IPv6).
  // Development binds IPv4 0.0.0.0 so other devices on the LAN can reach the API.
  if (env.isProduction) {
    httpServer.listen(env.PORT, onListening);
  } else {
    httpServer.listen(env.PORT, '0.0.0.0', onListening);
  }
}

async function shutdown(signal: string): Promise<void> {
  console.log(`${signal} received – shutting down`);
  httpServer.close(async () => {
    await disconnectPrisma();
    process.exit(0);
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

if (process.env.NODE_ENV !== 'test' && fileURLToPath(import.meta.url) === process.argv[1]) {
  startServer();
}
