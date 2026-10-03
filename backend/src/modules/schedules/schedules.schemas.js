import { z } from 'zod';
import {
  academicYear,
  dayOfWeek,
  id,
  idOrMe,
  idParams,
  listQuery,
  patchOf,
  shortText,
  timeStr,
} from '../../utils/zod/common.js';
import { SCHEDULE_SORT_MAP } from './schedules.repository.js';

const room = shortText(50);

export const listSchedulesQuery = listQuery(Object.keys(SCHEDULE_SORT_MAP), {
  classId: id.optional(),
  teacherId: idOrMe.optional(),
  classSubjectId: id.optional(),
  dayOfWeek: dayOfWeek.optional(),
  room: room.min(1).optional(),
  academicYear: academicYear.optional(),
});

export const createScheduleBody = z
  .strictObject({
    classSubjectId: id,
    dayOfWeek,
    startTime: timeStr,
    endTime: timeStr,
    room: room.nullable().optional(),
  })
  .refine((slot) => slot.endTime > slot.startTime, { error: 'must be after startTime', path: ['endTime'] });

/** The end > start rule for a partial update is checked in the service against the merged slot. */
export const updateScheduleBody = patchOf({
  classSubjectId: id,
  dayOfWeek,
  startTime: timeStr,
  endTime: timeStr,
  room: room.nullable(),
});

export { idParams };
