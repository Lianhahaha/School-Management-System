import { timeRangeParts } from '../../../utils/date';

/** '8:00–8:50 AM' for a period, read aloud as '8:00 to 8:50 AM'. */
export function PeriodTime({ startTime, endTime, className }) {
  const [start, end] = timeRangeParts(startTime, endTime);
  return (
    <span className={className}>
      <span className="tabular-nums">{start}</span>
      <span aria-hidden="true">–</span>
      <span className="sr-only"> to </span>
      <span className="tabular-nums">{end}</span>
    </span>
  );
}
