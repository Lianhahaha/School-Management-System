import { api } from '../../lib/apiClient';
import { toData } from '../../lib/envelope';

/** The caller's dashboard: `{ role: 'admin' | 'teacher' | 'student', ... }`, one shape per role. */
export const getDashboard = () => api.get('/dashboard').then(toData);
