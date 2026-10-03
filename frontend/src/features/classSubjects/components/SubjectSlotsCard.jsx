import { Card } from '../../../components/ui/Card';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { PAGINATION } from '../../../constants/shared';
import { formatTime } from '../../../utils/date';
import { dayLabel, slotsToGrid } from '../../../utils/schedule';
import { useSchedules } from '../../schedules/hooks';

/**
 * The weekly periods of one class-subject as a short list ("Monday 08:00-09:00 · Room B-204").
 * Fetches its own data.
 *
 * @param {object} props
 * @param {number} props.classSubjectId
 */
export function SubjectSlotsCard({ classSubjectId }) {
  const { data, isPending, error, refetch } = useSchedules({ classSubjectId, limit: PAGINATION.MAX_LIMIT });
  const days = slotsToGrid(data?.items ?? []).filter(({ slots }) => slots.length > 0);

  let body;
  if (isPending && !error) {
    body = (
      <div role="status" aria-label="Loading periods" className="space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  } else if (error) {
    body = <ErrorState title="Couldn't load the periods" message={error.message} onRetry={refetch} compact />;
  } else if (days.length === 0) {
    body = <p className="text-sm text-gray-600">No periods are scheduled for this subject yet.</p>;
  } else {
    body = (
      <ul className="space-y-1.5 text-sm">
        {days.flatMap(({ day, slots }) =>
          slots.map((slot) => (
            <li key={slot.id} className="flex flex-wrap gap-x-3 text-gray-700">
              <span className="w-24 font-medium text-gray-900">{dayLabel(day)}</span>
              <span className="tabular-nums">
                {formatTime(slot.startTime)}–{formatTime(slot.endTime)}
              </span>
              {slot.room && <span className="text-gray-600">{slot.room}</span>}
            </li>
          )),
        )}
      </ul>
    );
  }

  return (
    <Card title="Weekly periods" description="When this subject meets.">
      {body}
    </Card>
  );
}
