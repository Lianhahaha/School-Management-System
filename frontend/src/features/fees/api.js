import { api } from '../../lib/apiClient';
import { toData, toPage } from '../../lib/envelope';

/**
 * Admin only. params: page, limit, sortBy (name, amount, gradeLevel), sortOrder, academicYear, gradeLevel
 * (what a student of that grade pays: its fees and the every-grade ones).
 */
export const listFees = (params) => api.get('/fees', { params }).then(toPage);

/**
 * Admin only. Body: { academicYear, gradeLevel (null = every grade), name, amount }. 409 when the name is
 * already used for that year and grade.
 */
export const createFee = (body) => api.post('/fees', body).then(toData);

/** Admin only. Any of academicYear, gradeLevel, name, amount. */
export const updateFee = (id, body) => api.patch(`/fees/${id}`, body).then(toData);

/** Admin only. */
export const deleteFee = (id) => api.delete(`/fees/${id}`).then(toData);

/**
 * params: { studentId, academicYear }; a student passes studentId 'me'. Returns
 * { studentId, academicYear, class, fees, payments, totalFees, totalPaid, balance } (balance < 0: overpaid).
 */
export const getFeeStatement = (params) => api.get('/fees/statement', { params }).then(toData);

/**
 * Admin only. Body: { studentId, academicYear, amount, paidOn, method, receiptNumber, note? }. 409 when the OR
 * number is already recorded.
 */
export const recordPayment = (body) => api.post('/payments', body).then(toData);

/** Admin only. A payment is never edited: remove it and record it again. */
export const deletePayment = (id) => api.delete(`/payments/${id}`).then(toData);
