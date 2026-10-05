import { api } from '../../lib/apiClient';
import { toPage } from '../../lib/envelope';

/**
 * Admin only. The activity log, newest first. params: page, limit, search (summary, actor, details),
 * sortBy (createdAt), sortOrder, area, actorId, dateFrom, dateTo (school days).
 */
export const listActivity = (params) => api.get('/activity', { params }).then(toPage);
