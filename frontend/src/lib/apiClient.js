/**
 * The only module that talks to the backend over HTTP.
 *
 * Every request carries the Firebase ID token. A 401 is retried once with a forcibly
 * refreshed token; a second 401 means the session is dead and the user is signed out.
 * Failures become `ApiError`, successes resolve with the whole envelope `{ data, meta? }`.
 * Feature `api.js` files own the URL paths and unwrap the envelope, so hooks and components
 * never see it:
 *
 *   export const listStudents = (params) =>
 *     api.get('/students', { params }).then((r) => ({ items: r.data, meta: r.meta }));
 *   export const getStudent = (id) => api.get(`/students/${id}`).then((r) => r.data);
 */
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import { env } from '../config/env';
import { ERROR_CODES } from '../constants/shared';
import { SESSION_EXPIRED_MESSAGE } from '../constants/ui';
import { toApiParams } from '../utils/listParams';

/** Error codes raised by this client itself; every other code comes from the backend's ERROR_CODES. */
export const CLIENT_ERROR_CODES = Object.freeze({
  NETWORK_ERROR: 'NETWORK_ERROR', // fetch failed: offline, DNS, CORS, API down
  NO_SESSION: 'NO_SESSION', // a request was made while nobody is signed in (a bug in the caller)
  HTTP_ERROR: 'HTTP_ERROR', // non-2xx answer that is not in the error envelope
  INVALID_RESPONSE: 'INVALID_RESPONSE', // 2xx answer that is not JSON in the success envelope
});

export class ApiError extends Error {
  /**
   * @param {object} init
   * @param {number} init.status HTTP status, 0 when the request never got an answer
   * @param {string} init.code backend `error.code`, or one of CLIENT_ERROR_CODES
   * @param {string} init.message
   * @param {object|null} [init.details] backend `error.details`, always an object when present
   * @param {string|null} [init.requestId] `X-Request-Id` response header, quote it when reporting a bug
   */
  constructor({ status, code, message, details = null, requestId = null }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }

  /** True for failures worth retrying (no answer, or a server-side error); never for 4xx. */
  get isTransient() {
    return this.status === 0 || this.status >= 500;
  }
}

const networkError = () =>
  new ApiError({
    status: 0,
    code: CLIENT_ERROR_CODES.NETWORK_ERROR,
    message: 'Cannot reach the server. Check your connection.',
  });

/** The backend writes lower-case messages; users see them in toasts and alerts. */
const toSentence = (message) => message.charAt(0).toUpperCase() + message.slice(1);

function buildUrl(path, params) {
  const base = `${env.apiBaseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  // The second argument only matters for relative base URLs such as the default '/api/v1'.
  const url = new URL(base, window.location.origin);
  for (const [key, value] of Object.entries(toApiParams(params))) url.searchParams.set(key, String(value));
  return url;
}

async function getToken(forceRefresh) {
  const user = auth.currentUser;
  if (!user) {
    throw new ApiError({
      status: 401,
      code: CLIENT_ERROR_CODES.NO_SESSION,
      message: 'You are not signed in.',
    });
  }
  try {
    return await user.getIdToken(forceRefresh);
  } catch (error) {
    if (error?.code === 'auth/network-request-failed') throw networkError();
    // The refresh token was rejected (revoked, user disabled or deleted): the session is over.
    await signOut(auth);
    throw new ApiError({
      status: 401,
      code: ERROR_CODES.UNAUTHORIZED,
      message: SESSION_EXPIRED_MESSAGE,
    });
  }
}

async function send(path, { method, body, params, needsAuth }, forceRefresh) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (needsAuth) headers.Authorization = `Bearer ${await getToken(forceRefresh)}`;
  try {
    return await fetch(buildUrl(path, params), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw networkError();
  }
}

async function readEnvelope(response) {
  const json = await response.json().catch(() => null);
  if (response.ok && json?.success === true) return json;

  const failure = json?.error;
  throw new ApiError({
    status: response.status,
    code: failure?.code ?? (json ? CLIENT_ERROR_CODES.HTTP_ERROR : CLIENT_ERROR_CODES.INVALID_RESPONSE),
    message: failure?.message ? toSentence(failure.message) : `Request failed (${response.status})`,
    details: failure?.details ?? null,
    requestId: response.headers.get('X-Request-Id'),
  });
}

/**
 * @param {string} path path below the API base URL, for example '/students'
 * @param {object} [options]
 * @param {string} [options.method]
 * @param {*} [options.body] JSON-serialisable request body
 * @param {object} [options.params] query-string parameters; empty values are dropped
 * @param {boolean} [options.auth] send the Firebase token (default true; false for public endpoints)
 * @returns {Promise<{ data: *, meta?: object }>}
 * @throws {ApiError}
 */
async function request(path, { method = 'GET', body, params, auth: needsAuth = true } = {}) {
  const options = { method, body, params, needsAuth };
  let response = await send(path, options, false);
  if (response.status === 401 && needsAuth) {
    response = await send(path, options, true);
    if (response.status === 401) await signOut(auth);
  }
  return readEnvelope(response);
}

export const api = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
};
