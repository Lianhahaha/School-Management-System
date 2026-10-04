import { createKeys } from '../../lib/queryKeys';

/** Query keys for the API status: GET /health (one payload, so only `all` is used). */
export const healthKeys = createKeys('health');
