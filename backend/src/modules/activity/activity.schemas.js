import { z } from 'zod';
import { ACTIVITY_AREAS } from '../../constants/shared.js';
import { dateRangeRefinement, dateStr, id, listQuery } from '../../utils/zod/common.js';
import { ACTIVITY_SORT_MAP } from './activity.repository.js';

export const listActivityQuery = listQuery(Object.keys(ACTIVITY_SORT_MAP), {
  area: z.enum(ACTIVITY_AREAS).optional(),
  actorId: id.optional(),
  dateFrom: dateStr.optional(),
  dateTo: dateStr.optional(),
}).refine(...dateRangeRefinement);
