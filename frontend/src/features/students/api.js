import { api } from '../../lib/apiClient';
import { toData, toPage } from '../../lib/envelope';

/**
 * Admin and teachers (teachers see their visible classes). params: page, limit, search, sortBy,
 * sortOrder, classId, gradeLevel, gender, isActive, hasActiveEnrollment (false leaves out pending and
 * declined applicants), admissionStatus.
 */
export const listStudents = (params) => api.get('/students', { params }).then(toPage);

/** `id` may be 'me' for a student reading their own record. */
export const getStudent = (id) => api.get(`/students/${id}`).then(toData);

/**
 * Admin only. Creates student accounts from spreadsheet rows (POST /imports/students).
 * Body: { dryRun?, rows: [{ line, email, firstName, lastName, ... }] }. Each created row's result carries
 * that student's own `temporaryPassword` (returned once).
 * Resolves { dryRun, total, valid, problems: [{ line, errors: [{ field, message }] }], results? }.
 */
export const importStudents = (body) => api.post('/imports/students', body).then(toData);

/** Admin only. Updates the account and the student profile in one call; there is no delete. */
export const updateStudent = (id, body) => api.patch(`/students/${id}`, body).then(toData);
