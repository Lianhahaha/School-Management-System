import { PageHeader } from '../../../components/layout/PageHeader';
import { PAGINATION } from '../../../constants/shared';
import { SchedulePanel } from '../components/SchedulePanel';
import { useSchedules } from '../hooks';

export default function TeacherSchedulePage() {
  const query = useSchedules({ teacherId: 'me', limit: PAGINATION.MAX_LIMIT });

  return (
    <>
      <PageHeader title="Schedule" description="Your weekly timetable. Today is highlighted." />
      <SchedulePanel
        query={query}
        label="My weekly timetable"
        emptyTitle="No periods on your timetable"
        emptyDescription="Once an administrator schedules your subjects, they appear here."
      />
    </>
  );
}
