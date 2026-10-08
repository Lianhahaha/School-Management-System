/**
 * Builds the Express application. Middleware order matters (docs/PROJECT_PLAN.md, section 7.3):
 *
 *   requestId -> helmet -> cors -> http log -> json body -> /api/docs -> /api/v1 -> 404 -> error handler
 *
 * The access log comes before the body parser, so a request refused for its body is logged as well.
 */
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { createSwaggerRouter } from './config/swagger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { httpLogger } from './middleware/httpLogger.js';
import { notFound } from './middleware/notFound.js';
import { requestId } from './middleware/requestId.js';
import { apiRouter } from './routes.js';
import { API_BASE_PATH } from './constants/shared.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.isProd ? 1 : false);

  app.use(requestId);
  app.use(helmet({ contentSecurityPolicy: false })); // the only HTML served is Swagger UI, which CSP breaks
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id', 'Retry-After'],
      credentials: false,
      // Browsers may reuse a preflight answer for 2 hours (Chrome caps it there); without this every call
      // from the web app, which sends an Authorization header, would be preceded by an OPTIONS request.
      maxAge: 7200,
    }),
  );
  app.use(httpLogger);
  app.use(express.json({ limit: '1mb' }));

  if (env.DOCS_ENABLED) app.use('/api/docs', createSwaggerRouter());
  app.use(API_BASE_PATH, apiRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
