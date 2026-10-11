import { api } from '../../lib/apiClient';
import { toData } from '../../lib/envelope';

/**
 * The signed-in account: identity, role, profile, (students) current enrollment and (student assistants)
 * `assistantRequest`, where their sign-up stands. The only call a student assistant who is not approved may make
 * (with updateMe); every other one answers 403 `assistant_not_approved`.
 */
export const getMe = () => api.get('/auth/me').then(toData);

/**
 * Public self-registration, `accountType` 'student' (with the application) or 'assistant' (account fields
 * only, waits for approval); no token is sent because nobody is signed in yet.
 */
export const register = (payload) => api.post('/auth/register', payload, { auth: false }).then(toData);

/** Self-service contact fields (phone for everyone; address and guardian details for students). */
export const updateMe = (patch) => api.patch('/auth/me', patch).then(toData);
