import { Alert } from '../../../components/ui/Alert';
import { Badge } from '../../../components/ui/Badge';
import { formatTime } from '../../../utils/date';
import { dayLabel } from '../../../utils/schedule';

const TYPE_LABELS = { class: 'Class', teacher: 'Teacher', room: 'Room' };
const TYPE_TONES = { class: 'blue', teacher: 'violet', room: 'amber' };

/**
 * The clashes of a rejected timetable slot (409 SCHEDULE_CONFLICT, `error.details.conflicts`): one row
 * per busy resource, for example "Teacher · Grade 8 - B · Mathematics · Tue 08:00-09:00 · Room B-204".
 * Shown inside the slot modal so the admin can fix the day, time or room without losing the form.
 *
 * @param {object} props
 * @param {string} props.message the server's message
 * @param {Array<{ type: 'class'|'teacher'|'room', className: string, subjectName: string, dayOfWeek: number,
 *   startTime: string, endTime: string, room: string|null }>} props.conflicts
 */
export function ScheduleConflictList({ message, conflicts }) {
  return (
    <Alert tone="error" role="alert" title={message || 'This period clashes with the schedule'}>
      {conflicts.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {conflicts.map((conflict) => (
            <li
              key={`${conflict.type}-${conflict.scheduleId ?? conflict.classSubjectId}-${conflict.startTime}`}
              className="flex flex-wrap items-center gap-2"
            >
              <Badge tone={TYPE_TONES[conflict.type] ?? 'gray'}>
                {TYPE_LABELS[conflict.type] ?? conflict.type}
              </Badge>
              <span>
                {[
                  conflict.className,
                  conflict.subjectName,
                  `${dayLabel(conflict.dayOfWeek, { short: true })} ${formatTime(conflict.startTime)}–${formatTime(conflict.endTime)}`,
                  conflict.room,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Alert>
  );
}
