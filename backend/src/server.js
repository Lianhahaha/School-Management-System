/**
 * Entry point: validate the environment, check MySQL and Firebase, then listen.
 * A broken setup fails here in under a second with the cause, not on the first request.
 */
import { closePool, ping } from './config/db.js';
import { env } from './config/env.js';
import { assertFirebaseReady, firebase } from './config/firebase.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';

const DB_HINTS = {
  ECONNREFUSED:
    'MySQL is not running or not reachable. Start the "MySQL80" service (services.msc or `net start MySQL80`).',
  ER_ACCESS_DENIED_ERROR: 'Check DB_USER / DB_PASSWORD in backend/.env.',
  ER_BAD_DB_ERROR: 'The database does not exist yet: run `npm run db:migrate` (then `npm run db:seed`).',
};

async function start() {
  try {
    await ping();
  } catch (error) {
    logger.error(`Cannot connect to MySQL at ${env.DB_HOST}:${env.DB_PORT} (${error.code ?? error.message})`);
    if (DB_HINTS[error.code]) logger.error(DB_HINTS[error.code]);
    process.exit(1);
  }

  try {
    assertFirebaseReady();
  } catch (error) {
    logger.error(error.message);
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(
      `API listening on http://localhost:${env.PORT}${env.DOCS_ENABLED ? ' (docs at /api/docs)' : ''}`,
      {
        env: env.NODE_ENV,
        db: `${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`,
        firebaseProject: firebase.projectId,
        timeZone: env.APP_TIMEZONE,
      },
    );
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(
        `Port ${env.PORT} is already in use. Stop the other process or change PORT in backend/.env.`,
      );
    } else {
      logger.error(`Server error: ${error.message}`);
    }
    process.exit(1);
  });

  const shutdown = (signal, exitCode = 0) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await closePool().catch(() => {});
      process.exit(exitCode);
    });
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  // A rejection nobody handled leaves the process in an unknown state: log it and restart cleanly
  // (the host starts the service again), rather than keep serving as if nothing happened.
  process.on('unhandledRejection', (reason) => {
    logger.error('unhandled rejection, shutting down', {
      reason: String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
    shutdown('unhandledRejection', 1);
  });
}

start();
