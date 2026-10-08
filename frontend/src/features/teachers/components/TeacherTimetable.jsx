import { PAGINATION } from '../../../constants/shared';
import { currentAcademicYear } from '../../../utils/date';
import { useSchedules } from '../../schedules/hooks';
import { SchedulePanel } from '../../schedules/components/SchedulePanel';

/**
 * Weekly timetable of one teacher in the current academic year (read-only; slots show subject, class and
 * room), on the admin's teacher page. Runs its own query; SchedulePanel draws the states and the week.
 */
export function TeacherTimetable({ teacherId }) {
  const academicYear = currentAcademicYear();
  const query = useSchedules({ teacherId, academicYear, limit: PAGINATION.MAX_LIMIT });
  return (
    <SchedulePanel
      query={query}
      label="Teacher schedule"
      emptyTitle="No periods scheduled"
      emptyDescription={`This teacher has no periods in ${academicYear}.`}
    />
  );
}
