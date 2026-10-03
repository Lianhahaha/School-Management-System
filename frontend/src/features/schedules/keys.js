import { createKeys } from '../../lib/queryKeys';

/** Query keys for schedule slots: GET /schedules, GET /schedules/:id. See lib/queryKeys.js for the shape. */
export const scheduleKeys = createKeys('schedules');
