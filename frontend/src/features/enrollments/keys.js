import { createKeys } from '../../lib/queryKeys';

/** Query keys for enrollments: GET /enrollments, GET /enrollments/:id. See lib/queryKeys.js for the shape. */
export const enrollmentKeys = createKeys('enrollments');

/** GET /enrollments/next-class, the signed-in student's standing for next year. */
export const nextClassKey = [...enrollmentKeys.all, 'next-class'];
