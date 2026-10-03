import { CalendarDays, Plus } from 'lucide-react';
import { useState } from 'react';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { PAGINATION } from '../../../constants/shared';
import { fullName } from '../../../utils/names';
import { useClassSubjects } from '../../classSubjects/hooks';
import { ScheduleSlotModal } from '../../schedules/components/ScheduleSlotModal';
import { WeeklyTimetable } from '../../schedules/components/WeeklyTimetable';
import { useSchedules } from '../../schedules/hooks';

/** What a slot of a class timetable says: the subject, then its teacher and the room. */
const renderClassSlot = (slot) => {
  const detail = [fullName(slot.classSubject.teacher), slot.room].filter(Boolean).join(' · ');
  return (
    <>
      <span className="block font-medium">{slot.classSubject.subjectName}</span>
      {detail && <span className="block text-xs opacity-90">{detail}</span>}
    </>
  );
};

/**
 * "Schedule" tab of a class (admin): the weekly timetable. Click a period to edit or delete it,
 * "Add period" opens the slot modal with the class's subjects. Clashes are shown inside the modal.
 *
 * @param {object} props
 * @param {{ id: number, name: string }} props.schoolClass
 */
export function ClassScheduleTab({ schoolClass }) {
  const schedules = useSchedules({ classId: schoolClass.id, limit: PAGINATION.MAX_LIMIT });
  const classSubjects = useClassSubjects({ classId: schoolClass.id, limit: PAGINATION.MAX_LIMIT });
  const [modal, setModal] = useState(null); // { slot } while open

  const slots = schedules.data?.items ?? [];
  const subjects = classSubjects.data?.items ?? [];
  const hasSubjects = subjects.length > 0;

  if (schedules.isPending || classSubjects.isPending) {
    return (
      <div role="status" aria-label="Loading timetable" className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-40" />
        ))}
      </div>
    );
  }
  const failure = schedules.error ?? classSubjects.error;
  if (failure) {
    return (
      <ErrorState
        title="Couldn't load the timetable"
        message={failure.message}
        onRetry={() => {
          schedules.refetch();
          classSubjects.refetch();
        }}
      />
    );
  }

  const addButton = (
    <Button icon={Plus} onClick={() => setModal({ slot: null })} disabled={!hasSubjects}>
      Add period
    </Button>
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">Select a period to edit or delete it.</p>
        {slots.length > 0 && addButton}
      </div>

      {slots.length === 0 ? (
        <div className="sheet">
          <EmptyState
            icon={CalendarDays}
            title="No timetable yet"
            description={
              hasSubjects
                ? 'Add the first period of the week.'
                : 'Add subjects to the class first (Subjects & Teachers tab), then schedule them.'
            }
            action={addButton}
          />
        </div>
      ) : (
        <WeeklyTimetable
          slots={slots}
          renderSlot={renderClassSlot}
          onSlotClick={(slot) => setModal({ slot })}
          label={`Weekly timetable of ${schoolClass.name}`}
        />
      )}

      <ScheduleSlotModal
        open={Boolean(modal)}
        onClose={() => setModal(null)}
        classSubjects={subjects}
        slot={modal?.slot ?? null}
      />
    </div>
  );
}
