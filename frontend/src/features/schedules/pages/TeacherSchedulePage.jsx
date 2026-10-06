import { PageHeader } from '../../../components/layout/PageHeader';
import { PAGINATION } from '../../../constants/shared';
import { currentAcademicYear } from '../../../utils/date';
import { SchedulePanel } from '../components/SchedulePanel';
import { useSchedules } from '../hooks';

export default function TeacherSchedulePage() {
  const academicYear = currentAcademicYear();
  const query = useSchedules({ teacherId: 'me', academicYear, limit: PAGINATION.MAX_LIMIT });

  return (
    <>
      <PageHeader
        title="Schedule"
        description={`Your weekly schedule for ${academicYear}. Today is highlighted.`}
      />
      <SchedulePanel
        query={query}
        label="My weekly schedule"
        emptyTitle="No periods on your schedule"
        emptyDescription="Once an administrator schedules your subjects, they appear here."
      />
    </>
  );
}
