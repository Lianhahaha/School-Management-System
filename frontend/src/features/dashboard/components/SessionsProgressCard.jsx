import { ClipboardTextIcon } from '@phosphor-icons/react';
import { CalendarOff } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { countOf } from '../../../utils/format';

/**
 * "2 of 4 sessions marked" with a progress bar (payload `attendanceToday` of a teacher). On a school holiday
 * (`holiday`) nothing is scheduled and the card says why.
 */
export function SessionsProgressCard({ attendance, holiday }) {
  const { sessionsMarked, sessionsScheduled } = attendance;
  const isDone = sessionsScheduled > 0 && sessionsMarked >= sessionsScheduled;

  return (
    <Card icon={ClipboardTextIcon} mark="sage" title="Attendance today">
      {holiday ? (
        <EmptyState
          icon={CalendarOff}
          title="Nothing to mark today"
          description={`School holiday: ${holiday.title}.`}
          compact
        />
      ) : sessionsScheduled === 0 ? (
        <EmptyState icon={CalendarOff} title="No sessions today" compact />
      ) : (
        <>
          <p className="text-sm text-gray-700">
            <span className="text-2xl font-semibold text-gray-900">{sessionsMarked}</span> of{' '}
            {countOf(sessionsScheduled, 'session')} marked
          </p>
          <div
            role="progressbar"
            aria-label="Sessions marked today"
            aria-valuemin={0}
            aria-valuemax={sessionsScheduled}
            aria-valuenow={sessionsMarked}
            className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100"
          >
            <div
              className={isDone ? 'h-full rounded-full bg-green-600' : 'h-full rounded-full bg-gray-900'}
              style={{ width: `${Math.min(100, (sessionsMarked / sessionsScheduled) * 100)}%` }}
            />
          </div>
          {isDone && <p className="mt-2 text-xs text-green-700">All of today's attendance is marked.</p>}
        </>
      )}
    </Card>
  );
}
