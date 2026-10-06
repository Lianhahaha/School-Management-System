import { useState } from 'react';
import {
  CALENDAR_EVENT_TYPE_LABELS,
  CALENDAR_EVENT_TYPE_TONES,
  TONE_SOFT_CLASSES,
} from '../../../constants/ui';
import { cx } from '../../../utils/cx';
import { formatTimeRange, todayIsoWeekday } from '../../../utils/date';
import { dayLabel, slotsToGrid } from '../../../utils/schedule';
import { Checkbox } from '../../../components/ui/Checkbox';
import { LiveTag } from '../../../components/ui/LiveTag';

const WEEKDAYS = [1, 2, 3, 4, 5];
const SUBJECT_TONES = ['blue', 'green', 'violet', 'amber', 'red'];

/** The same subject always gets the same colour, in every timetable. */
const subjectTone = (slot) => SUBJECT_TONES[slot.classSubject.subjectId % SUBJECT_TONES.length];

/** Default slot content: the subject, then class and room. */
function DefaultSlotContent({ slot }) {
  const detail = [slot.classSubject.className, slot.room].filter(Boolean).join(' · ');
  return (
    <>
      <span className="block font-medium">{slot.classSubject.subjectName}</span>
      {detail && <span className="block text-xs opacity-90">{detail}</span>}
    </>
  );
}

function Slot({ slot, renderSlot, onSlotClick }) {
  const classes = cx(
    'block w-full rounded-2xl px-3 py-2.5 text-left text-sm',
    TONE_SOFT_CLASSES[subjectTone(slot)],
    onSlotClick && 'cursor-pointer transition-[filter] hover:brightness-95',
  );
  const content = (
    <>
      <span className="block text-xs font-semibold tabular-nums">
        {formatTimeRange(slot.startTime, slot.endTime)}
      </span>
      {renderSlot ? renderSlot(slot) : <DefaultSlotContent slot={slot} />}
    </>
  );

  return onSlotClick ? (
    <button type="button" onClick={() => onSlotClick(slot)} className={classes}>
      {content}
    </button>
  ) : (
    <div className={classes}>{content}</div>
  );
}

/**
 * A week of timetable slots: one column per weekday (stacked on phones), slots in time order,
 * a colour per subject. It only draws what it is given, so the same grid serves a class, a teacher
 * and a student; the page decides which slots to fetch (useSchedules) and what a slot says.
 *
 * Monday to Friday are shown; the weekend appears when a slot falls on Saturday or Sunday, or when
 * the user ticks "Show weekend".
 *
 * @param {object} props
 * @param {Array<object>} props.slots schedule rows: { id, classSubjectId, classSubject: { classId, className,
 *   subjectId, subjectName, teacher }, dayOfWeek (1 = Monday), startTime, endTime, room }
 * @param {(slot: object) => import('react').ReactNode} [props.renderSlot] content below the time of a slot
 *   (default: subject name, then class and room); for example a teacher page shows class and room only
 * @param {(slot: object) => void} [props.onSlotClick] makes every slot a button (admin editing)
 * @param {boolean} [props.highlightToday] emphasise today's column (default true)
 * @param {Map<number, Array<{ id: number, title: string, type: string }>>} [props.dayNotes] this week's
 *   calendar entries by weekday, shown at the top of the day; a holiday ("No classes") fades its periods
 * @param {string} [props.label] accessible name of the timetable (default "Weekly timetable")
 */
export function WeeklyTimetable({
  slots,
  renderSlot,
  onSlotClick,
  highlightToday = true,
  label = 'Weekly schedule',
  dayNotes,
}) {
  const [isWeekendRequested, setWeekendRequested] = useState(false);
  const hasWeekendSlots = slots.some((slot) => slot.dayOfWeek > 5);
  const isWeekendShown = hasWeekendSlots || isWeekendRequested;
  const today = todayIsoWeekday();
  const columns = slotsToGrid(slots).filter(({ day }) => isWeekendShown || WEEKDAYS.includes(day));

  return (
    <div>
      {!hasWeekendSlots && (
        <Checkbox
          label="Show weekend"
          checked={isWeekendRequested}
          onChange={(event) => setWeekendRequested(event.target.checked)}
          className="mb-3 print:hidden"
        />
      )}
      <div
        role="group"
        aria-label={label}
        className={cx(
          'grid gap-3 sm:grid-cols-2',
          isWeekendShown ? 'lg:grid-cols-7 print:grid-cols-7' : 'lg:grid-cols-5 print:grid-cols-5',
        )}
      >
        {columns.map(({ day, slots: daySlots }) => {
          const isToday = highlightToday && day === today;
          const notes = dayNotes?.get(day) ?? [];
          const isHoliday = notes.some((note) => note.type === 'holiday');
          return (
            <section
              key={day}
              aria-label={dayLabel(day)}
              className={cx('rounded-card bg-surface p-3', isToday && 'ring-2 ring-accent ring-inset')}
            >
              <h3 className="mb-2 flex items-center justify-between text-sm font-semibold text-gray-900">
                {dayLabel(day)}
                {isToday && <LiveTag>Today</LiveTag>}
              </h3>
              {notes.map((note) => (
                <p
                  key={note.id}
                  className={cx(
                    'mb-2 rounded-xl px-2.5 py-1.5 text-xs font-medium',
                    TONE_SOFT_CLASSES[CALENDAR_EVENT_TYPE_TONES[note.type]],
                  )}
                >
                  {note.type === 'holiday'
                    ? `${CALENDAR_EVENT_TYPE_LABELS.holiday} · ${note.title}`
                    : note.title}
                </p>
              ))}
              {daySlots.length === 0 ? (
                <p className="text-xs text-gray-500">No periods</p>
              ) : (
                <ul className={cx('space-y-2', isHoliday && 'opacity-50')}>
                  {daySlots.map((slot) => (
                    <li key={slot.id}>
                      <Slot slot={slot} renderSlot={renderSlot} onSlotClick={onSlotClick} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
