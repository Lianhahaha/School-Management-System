/**
 * HTTP access log (morgan). One line per response: request id, method, URL,
 * status, duration and the authenticated user (id:role) when known.
 */
import morgan from 'morgan';
import { env } from '../config/env.js';

morgan.token('id', (req) => req.id ?? '-');
morgan.token('user', (req) => (req.user ? `${req.user.id}:${req.user.role}` : '-'));

const devFormat = ':id :method :url :status :response-time ms :user';
const prodFormat = JSON.stringify({
  t: ':date[iso]',
  reqId: ':id',
  method: ':method',
  url: ':url',
  status: ':status',
  ms: ':response-time',
  len: ':res[content-length]',
  user: ':user',
  ip: ':remote-addr',
});

export const httpLogger = morgan(env.isProd ? prodFormat : devFormat, {
  skip: (req) => env.isTest || (env.isProd && req.originalUrl.endsWith('/health')),
});
