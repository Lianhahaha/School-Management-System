import { z } from 'zod';
import { CALENDAR_EVENT_TYPES } from '../../constants/shared.js';
import {
  dateRangeRefinement,
  dateStr,
  idParams,
  listQuery,
  patchOf,
  shortText,
} from '../../utils/zod/common.js';
import { CALENDAR_SORT_MAP } from './calendar.repository.js';

const title = shortText(150).min(1, { error: 'required' });
const description = shortText(500);
const type = z.enum(CALENDAR_EVENT_TYPES);

/** dateFrom / dateTo select the events that overlap the range (a month view asks for its first and last day). */
export const listEventsQuery = listQuery(Object.keys(CALENDAR_SORT_MAP), {
  type: type.optional(),
  dateFrom: dateStr.optional(),
  dateTo: dateStr.optional(),
}).refine(...dateRangeRefinement);

/** `endsOn` defaults to `startsOn` (a one-day entry); the service checks the order and the length. */
export const createEventBody = z.strictObject({
  title,
  description: description.nullable().optional(),
  type,
  startsOn: dateStr,
  endsOn: dateStr.optional(),
});

/** The order and length of the dates are checked in the service against the merged values. */
export const updateEventBody = patchOf({
  title,
  description: description.nullable(),
  type,
  startsOn: dateStr,
  endsOn: dateStr,
});

export { idParams };
