import { useState } from 'react';
import { TONE_CLASSES } from '../../../constants/ui';
import { cx } from '../../../utils/cx';
import { formatTime, todayIsoWeekday } from '../../../utils/date';
import { dayLabel, slotsToGrid } from '../../../utils/schedule';
import { Checkbox } from '../../../components/ui/Checkbox';

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
    'block w-full rounded-lg px-3 py-2 text-left text-sm ring-1 ring-inset',
    TONE_CLASSES[subjectTone(slot)],
    onSlotClick && 'cursor-pointer transition-shadow hover:shadow-md',
  );
  const content = (
    <>
      <span className="block text-xs font-semibold tabular-nums">
        {formatTime(slot.startTime)}–{formatTime(slot.endTime)}
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
 * @param {string} [props.label] accessible name of the timetable (default "Weekly timetable")
 */
export function WeeklyTimetable({
  slots,
  renderSlot,
  onSlotClick,
  highlightToday = true,
  label = 'Weekly timetable',
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
          className="mb-3"
        />
      )}
      <div
        role="group"
        aria-label={label}
        className={cx('grid gap-3 sm:grid-cols-2', isWeekendShown ? 'lg:grid-cols-7' : 'lg:grid-cols-5')}
      >
        {columns.map(({ day, slots: daySlots }) => {
          const isToday = highlightToday && day === today;
          return (
            <section
              key={day}
              aria-label={dayLabel(day)}
              className={cx(
                'rounded-card border p-3',
                isToday ? 'border-brand-300 bg-brand-50' : 'border-gray-200 bg-white',
              )}
            >
              <h3 className="mb-2 flex items-center justify-between text-sm font-semibold text-gray-900">
                {dayLabel(day)}
                {isToday && <span className="text-xs font-medium text-brand-700">Today</span>}
              </h3>
              {daySlots.length === 0 ? (
                <p className="text-xs text-gray-500">No periods</p>
              ) : (
                <ul className="space-y-2">
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
