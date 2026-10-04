import { api } from '../../lib/apiClient';
import { toData } from '../../lib/envelope';

/** Public API status, including the Firebase project id the backend verifies tokens against. */
export const getHealth = () => api.get('/health', { auth: false }).then(toData);
