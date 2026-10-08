import { api } from '../../lib/apiClient';
import { toData } from '../../lib/envelope';

/** The signed-in account: identity, role, profile and (students) current enrollment. */
export const getMe = () => api.get('/auth/me').then(toData);

/** Public student self-registration; no token is sent because nobody is signed in yet. */
export const register = (payload) => api.post('/auth/register', payload, { auth: false }).then(toData);

/** Self-service contact fields (phone for everyone; address and guardian details for students). */
export const updateMe = (patch) => api.patch('/auth/me', patch).then(toData);
