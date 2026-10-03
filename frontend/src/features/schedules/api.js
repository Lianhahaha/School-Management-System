import { api } from '../../lib/apiClient';
import { toData, toPage } from '../../lib/envelope';

/**
 * Timetable slots. params: page, limit, search, sortBy (dayOfWeek, startTime), sortOrder, classId,
 * teacherId ('me' allowed), classSubjectId, dayOfWeek, room, academicYear. Without a scope filter a
 * student gets their class timetable and a teacher their visible classes. A whole week is a few dozen
 * slots, but the default page size is 20: pass limit: 100.
 */
export const listSchedules = (params) => api.get('/schedules', { params }).then(toPage);

export const getSchedule = (id) => api.get(`/schedules/${id}`).then(toData);

/**
 * Admin only. Body: { classSubjectId, dayOfWeek (1 = Monday), startTime, endTime ('HH:MM'), room? }.
 * 409 SCHEDULE_CONFLICT with `details.conflicts` when the class, the teacher or the room is busy.
 */
export const createSchedule = (body) => api.post('/schedules', body).then(toData);

/** Admin only. Any of classSubjectId, dayOfWeek, startTime, endTime, room (null clears it). */
export const updateSchedule = (id, body) => api.patch(`/schedules/${id}`, body).then(toData);

/** Admin only. */
export const deleteSchedule = (id) => api.delete(`/schedules/${id}`).then(toData);
