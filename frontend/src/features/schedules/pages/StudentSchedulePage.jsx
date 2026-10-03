import { PageHeader } from '../../../components/layout/PageHeader';
import { PAGINATION } from '../../../constants/shared';
import { fullName } from '../../../utils/names';
import { NotEnrolledState } from '../../attendance/components/NotEnrolledState';
import { useAuth } from '../../auth/hooks';
import { SchedulePanel } from '../components/SchedulePanel';
import { useSchedules } from '../hooks';

/** A period of the class timetable: the subject, then its teacher and room. */
const renderStudentSlot = (slot) => {
  const detail = [fullName(slot.classSubject.teacher), slot.room].filter(Boolean).join(' · ');
  return (
    <>
      <span className="block font-medium">{slot.classSubject.subjectName}</span>
      {detail && <span className="block text-xs opacity-90">{detail}</span>}
    </>
  );
};

export default function StudentSchedulePage() {
  const { me } = useAuth();
  const isEnrolled = Boolean(me.currentEnrollment);
  // A student sends no filter: the backend scopes the timetable to their class.
  const query = useSchedules({ limit: PAGINATION.MAX_LIMIT }, { enabled: isEnrolled });

  return (
    <>
      <PageHeader title="Schedule" description="Your class timetable for the week. Today is highlighted." />
      {isEnrolled ? (
        <SchedulePanel
          query={query}
          label="My class timetable"
          renderSlot={renderStudentSlot}
          emptyTitle="No periods scheduled yet"
          emptyDescription="Your class timetable has not been set up. Check back soon."
        />
      ) : (
        <div className="sheet">
          <NotEnrolledState />
        </div>
      )}
    </>
  );
}
