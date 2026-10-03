import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useSchedules } from '../../schedules/hooks';
import { WeeklyTimetable } from '../../schedules/components/WeeklyTimetable';

/** Weekly timetable of one teacher (read-only; slots show subject, class and room). Fetches its own data. */
export function TeacherTimetable({ teacherId }) {
  const { data, isPending, error, refetch } = useSchedules({ teacherId, limit: 100 });

  if (error) return <ErrorState title="Couldn't load timetable" message={error.message} onRetry={refetch} />;
  if (isPending) return <Skeleton className="h-48 w-full" />;
  if (data.items.length === 0) {
    return <EmptyState title="No periods scheduled" description="This teacher has no timetable slots yet." />;
  }
  return <WeeklyTimetable slots={data.items} label="Teacher timetable" />;
}
