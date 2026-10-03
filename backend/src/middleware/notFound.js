/** 404 envelope for every unmatched route (mounted after all routers, no path pattern). */
import { ApiError } from '../utils/ApiError.js';

export function notFound(req, _res, next) {
  next(ApiError.notFound('route', `${req.method} ${req.originalUrl}`));
}
