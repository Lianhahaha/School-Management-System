import { describe, expect, it } from 'vitest';
import { timeToMinutes, unmarkedPeriodsNow } from '../src/utils/schedule';

/** A sheet still to mark as the admin dashboard sends it: its first period, then all its periods of today. */
const sheet = (classSubjectId, ...times) => ({
  classSubjectId,
  startTime: times[0][0],
  endTime: times[0][1],
  periods: times.map(([startTime, endTime]) => ({ startTime, endTime })),
});

describe("the admin dashboard's periods still to mark", () => {
  // 08:00 double period, 09:00, 10:00, 13:00 and 14:00 + 15:00 (one sheet each).
  const sheets = [
    sheet(1, ['08:00', '09:00'], ['09:00', '10:00']),
    sheet(2, ['09:00', '10:00']),
    sheet(3, ['10:00', '11:00'], ['14:00', '15:00']),
    sheet(4, ['13:00', '14:00']),
  ];

  it('lists the sheets that have started and counts the periods still to come', () => {
    const { listed, morePeriods, laterPeriods } = unmarkedPeriodsNow(sheets, timeToMinutes('10:30'), 5);
    expect(listed.map((lesson) => lesson.classSubjectId)).toEqual([1, 2, 3]);
    expect(morePeriods).toBe(0);
    // Sheet 4's period and sheet 3's 14:00 period, which the same sheet marks: periods, not sheets.
    expect(laterPeriods).toBe(2);
  });

  it('counts the started periods of the sheets beyond the list, a double period as two', () => {
    const { listed, morePeriods, laterPeriods } = unmarkedPeriodsNow(sheets, timeToMinutes('13:30'), 1);
    expect(listed.map((lesson) => lesson.classSubjectId)).toEqual([1]);
    // Sheet 2 (one period), sheet 3's 10:00 and sheet 4's 13:00; sheet 3's 14:00 is still to come.
    expect(morePeriods).toBe(3);
    expect(laterPeriods).toBe(1);
  });

  it('adds up to every unmarked period, whatever the time', () => {
    const unmarked = sheets.reduce((sum, lesson) => sum + lesson.periods.length, 0);
    for (const time of ['07:00', '08:00', '09:30', '12:00', '14:00', '18:00']) {
      const { listed, morePeriods, laterPeriods } = unmarkedPeriodsNow(sheets, timeToMinutes(time), 2);
      const listedStarted = listed
        .flatMap((lesson) => lesson.periods)
        .filter((period) => timeToMinutes(period.startTime) <= timeToMinutes(time)).length;
      expect(listedStarted + morePeriods + laterPeriods, time).toBe(unmarked);
    }
  });
});
