import { CalendarDays, Printer } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { WeeklyTimetable } from './WeeklyTimetable';

/**
 * A read-only weekly timetable with its loading, error and empty states, for the teacher's and the
 * student's schedule pages. The page runs the query (useSchedules) and passes it in.
 *
 * @param {object} props
 * @param {{ data?: { items: object[] }, isPending: boolean, error: Error|null, refetch: () => void }} props.query
 *   the useSchedules result (pass `limit: 100` so the whole week is loaded)
 * @param {string} props.label accessible name of the timetable
 * @param {string} props.emptyTitle
 * @param {string} [props.emptyDescription]
 * @param {(slot: object) => import('react').ReactNode} [props.renderSlot] see WeeklyTimetable
 */
export function SchedulePanel({ query, label, emptyTitle, emptyDescription, renderSlot }) {
  const { data, isPending, error, refetch } = query;

  if (isPending && !error) {
    return (
      <div role="status" aria-label="Loading timetable" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-48" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div className="sheet">
        <ErrorState title="Couldn't load the timetable" message={error.message} onRetry={refetch} />
      </div>
    );
  }
  if (data.items.length === 0) {
    return (
      <div className="sheet">
        <EmptyState icon={CalendarDays} title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex justify-end print:hidden">
        <Button variant="secondary" size="sm" icon={Printer} onClick={() => window.print()}>
          Print timetable
        </Button>
      </div>
      <WeeklyTimetable slots={data.items} renderSlot={renderSlot} label={label} />
    </div>
  );
}
