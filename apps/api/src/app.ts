import { resolve } from 'node:path';
import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { requestId, notFoundHandler, errorHandler } from './http.js';
import { attachSession, requireSameOrigin } from './auth/middleware.js';
import { mongoHealthy } from './db.js';
import { getKv } from './stores/kv.js';
import { authRouter } from './modules/auth/routes.js';
import orgRouter from './modules/org/routes.js';
import crewsRouter from './modules/crews/routes.js';
import workersRouter from './modules/workers/routes.js';
import { instructionsRouter } from './modules/instructions/routes.js';
import { variantsRouter } from './modules/variants/routes.js';
import { sharingRouter } from './modules/sharing/routes.js';
import { workerRouter } from './modules/worker/routes.js';
import { boardRouter } from './modules/board/routes.js';
import { exportsRouter } from './modules/exports/routes.js';

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  });

  app.use(requestId);
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());

  app.get('/healthz', async (_req, res) => {
    const redis = await getKv().ping().catch(() => false);
    const ok = mongoHealthy() && redis;
    res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'unavailable' });
  });

  app.use('/api/v1', requireSameOrigin);
  app.use('/api/v1', attachSession);

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1', workerRouter);
  app.use('/api/v1/org', orgRouter);
  app.use('/api/v1', crewsRouter);
  app.use('/api/v1', workersRouter);
  app.use('/api/v1', instructionsRouter);
  app.use('/api/v1', variantsRouter);
  app.use('/api/v1', sharingRouter);
  app.use('/api/v1', boardRouter);
  app.use('/api/v1', exportsRouter);

  if (config.MEDIA_DRIVER === 'local') {
    app.use('/media', express.static(resolve(process.cwd(), config.MEDIA_LOCAL_DIR), { fallthrough: true, index: false }));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
