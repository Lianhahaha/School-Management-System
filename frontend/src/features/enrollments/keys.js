import { createKeys } from '../../lib/queryKeys';

/** Query keys for enrollments: GET /enrollments, GET /enrollments/:id. See lib/queryKeys.js for the shape. */
export const enrollmentKeys = createKeys('enrollments');
