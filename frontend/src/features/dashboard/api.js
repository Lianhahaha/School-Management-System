import { api } from '../../lib/apiClient';

/** The caller's dashboard: `{ role: 'admin' | 'teacher' | 'student', ... }`, one shape per role. */
export const getDashboard = () => api.get('/dashboard').then((response) => response.data);
