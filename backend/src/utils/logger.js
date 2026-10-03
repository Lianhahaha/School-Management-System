/**
 * Minimal leveled logger. Human-readable lines in development, one JSON object
 * per line in production (easy to grep or pipe into jq). No dependency.
 */
import { env } from '../config/env.js';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[env.LOG_LEVEL];

function write(level, message, meta) {
  if (LEVELS[level] < threshold) return;
  const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
  if (env.isProd) {
    stream.write(`${JSON.stringify({ t: new Date().toISOString(), level, message, ...meta })}\n`);
    return;
  }
  const extra = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  stream.write(`[${new Date().toISOString()}] ${level.toUpperCase().padEnd(5)} ${message}${extra}\n`);
}

export const logger = {
  debug: (message, meta) => write('debug', message, meta),
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
};
