import { createKeys } from '../../lib/queryKeys';

/** Query keys for accounts: GET /users, GET /users/:id. See lib/queryKeys.js for the shape. */
export const userKeys = createKeys('users');
