import { formatTime } from '../../../utils/date';

/** '08:00–09:00' for a timetable period. */
export function PeriodTime({ startTime, endTime, className }) {
  return (
    <span className={className}>
      <span className="tabular-nums">{formatTime(startTime)}</span>
      <span aria-hidden="true">–</span>
      <span className="sr-only"> to </span>
      <span className="tabular-nums">{formatTime(endTime)}</span>
    </span>
  );
}
