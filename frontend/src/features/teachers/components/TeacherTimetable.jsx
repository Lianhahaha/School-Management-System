import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { PAGINATION } from '../../../constants/shared';
import { currentAcademicYear } from '../../../utils/date';
import { useSchedules } from '../../schedules/hooks';
import { WeeklyTimetable } from '../../schedules/components/WeeklyTimetable';

/**
 * Weekly timetable of one teacher in the current academic year (read-only; slots show subject, class
 * and room). Fetches its own data.
 */
export function TeacherTimetable({ teacherId }) {
  const academicYear = currentAcademicYear();
  const { data, isPending, error, refetch } = useSchedules({
    teacherId,
    academicYear,
    limit: PAGINATION.MAX_LIMIT,
  });

  if (error) return <ErrorState title="Couldn't load timetable" message={error.message} onRetry={refetch} />;
  if (isPending) return <Skeleton className="h-48 w-full" />;
  if (data.items.length === 0) {
    return (
      <EmptyState
        title="No periods scheduled"
        description={`This teacher has no periods in ${academicYear}.`}
      />
    );
  }
  return <WeeklyTimetable slots={data.items} label="Teacher timetable" />;
}
