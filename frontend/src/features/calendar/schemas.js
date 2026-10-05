import { z } from 'zod';
import { CALENDAR_EVENT_TYPES } from '../../constants/shared';
import { dateYMD, nullableField, optionalField } from '../../lib/validators';

/** Both forms share these fields; only the meaning of a blank description differs (see `blank`). */
const eventSchema = (blank) =>
  z
    .object({
      title: z.string().trim().min(1, 'This field is required').max(150, 'Use 150 characters or fewer'),
      description: blank(z.string().max(500, 'Use 500 characters or fewer')),
      type: z.enum(CALENDAR_EVENT_TYPES),
      startsOn: dateYMD,
      // Blank means a one-day entry: the same day as the start.
      endsOn: z.union([z.literal(''), dateYMD]),
    })
    .refine((values) => values.endsOn === '' || values.endsOn >= values.startsOn, {
      message: 'The last day cannot be before the first day',
      path: ['endsOn'],
    })
    .transform((values) => ({ ...values, endsOn: values.endsOn || values.startsOn }));

/** POST /calendar-events: a blank description is left out. */
export const createEventSchema = eventSchema(optionalField);

/** PATCH /calendar-events/:id: a blank description clears it (null). */
export const updateEventSchema = eventSchema(nullableField);

/** Form values; `startsOn` pre-fills the first day (a day picked on the calendar). */
export const eventDefaults = (event, startsOn = '') => ({
  title: event?.title ?? '',
  description: event?.description ?? '',
  type: event?.type ?? 'holiday',
  startsOn: event?.startsOn ?? startsOn,
  endsOn: event && event.endsOn !== event.startsOn ? event.endsOn : '',
});
