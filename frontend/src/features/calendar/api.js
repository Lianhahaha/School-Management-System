import { api } from '../../lib/apiClient';
import { toData, toPage } from '../../lib/envelope';

/**
 * Calendar entries (holidays and school events), readable by everyone. params: page, limit, search (title,
 * description), sortBy (startsOn, title, createdAt), sortOrder, type, dateFrom and dateTo (entries that
 * overlap the range).
 */
export const listCalendarEvents = (params) => api.get('/calendar-events', { params }).then(toPage);

/** Admin only. Body: { title, description?, type, startsOn, endsOn? } (endsOn defaults to startsOn). */
export const createCalendarEvent = (body) => api.post('/calendar-events', body).then(toData);

/** Admin only. Any of title, description, type, startsOn, endsOn. */
export const updateCalendarEvent = (id, body) => api.patch(`/calendar-events/${id}`, body).then(toData);

/** Admin only. */
export const deleteCalendarEvent = (id) => api.delete(`/calendar-events/${id}`).then(toData);
