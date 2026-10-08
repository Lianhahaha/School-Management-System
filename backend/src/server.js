/**
 * Entry point: validate the environment, check MySQL and Firebase, then listen.
 * A broken setup fails here in under a second with the cause, not on the first request.
 */
import { closePool, ping } from './config/db.js';
import { dbErrorHint } from './config/dbConnection.js';
import { env } from './config/env.js';
import { assertFirebaseReady, firebase } from './config/firebase.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';

/** A wrong setting fails at once; anything else (a network blip, a database still waking) may pass on retry. */
const CONFIG_ERRORS = new Set(['ER_ACCESS_DENIED_ERROR', 'ER_DBACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR']);
/** Pauses between start-up attempts in production, about 45 s in all; locally a failure is reported at once. */
const PING_RETRY_DELAYS_MS = env.isProd ? [1000, 2000, 4000, 8000, 15_000, 15_000] : [];

/** Resolves once MySQL answers; the free hosted database can need a moment after the API itself wakes up. */
async function waitForDatabase() {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await ping();
    } catch (error) {
      const delay = PING_RETRY_DELAYS_MS[attempt];
      if (delay === undefined || CONFIG_ERRORS.has(error.code)) throw error;
      logger.warn(`MySQL not reachable yet (${error.code ?? error.message}), retrying in ${delay / 1000} s`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

async function start() {
  try {
    await waitForDatabase();
  } catch (error) {
    logger.error(`Cannot connect to MySQL at ${env.DB_HOST}:${env.DB_PORT} (${error.code ?? error.message})`);
    const hint = dbErrorHint(error);
    if (hint) logger.error(hint);
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

  // A hosting proxy keeps connections to the API open for about a minute; Node's 5 s default would close a
  // connection the proxy is about to reuse, and that request would fail with a 502.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

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
    // Requests in flight (an import, the end of a school year) get time to finish; hosts wait about 30 s.
    setTimeout(() => process.exit(1), 25_000).unref();
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
