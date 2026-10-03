import { z } from 'zod';
import { nullableField, optionalField, requiredId, timeHM } from '../../lib/validators';

/** Both forms share these fields; only the meaning of a blank room differs (see `blank`). */
const scheduleShape = (blank) => ({
  classSubjectId: requiredId('Choose a subject'),
  dayOfWeek: z.string().min(1, 'Choose a day').pipe(z.coerce.number().int().min(1).max(7)),
  startTime: timeHM,
  endTime: timeHM,
  room: blank(z.string().max(50, 'Use 50 characters or fewer')),
});

const endsAfterStart = [
  (slot) => slot.endTime > slot.startTime, // zero-padded 'HH:MM' strings compare correctly
  { error: 'End time must be after start time', path: ['endTime'] },
];

/** POST /schedules: a blank room is left out. */
export const createScheduleSchema = z.object(scheduleShape(optionalField)).refine(...endsAfterStart);

/** PATCH /schedules/:id from the edit form: a blank room clears it (null). */
export const updateScheduleSchema = z.object(scheduleShape(nullableField)).refine(...endsAfterStart);

/** Form values; with a slot it is the edit form. `classSubjectId` and `dayOfWeek` presets help the "Add slot" button of a day. */
export const scheduleDefaults = (slot, { classSubjectId = '', dayOfWeek = '' } = {}) => ({
  classSubjectId: slot ? String(slot.classSubjectId) : String(classSubjectId),
  dayOfWeek: slot ? String(slot.dayOfWeek) : String(dayOfWeek),
  startTime: slot ? slot.startTime.slice(0, 5) : '',
  endTime: slot ? slot.endTime.slice(0, 5) : '',
  room: slot?.room ?? '',
});
