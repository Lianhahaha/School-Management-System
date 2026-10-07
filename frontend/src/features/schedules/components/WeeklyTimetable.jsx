import { useState } from 'react';
import {
  CALENDAR_EVENT_TYPE_LABELS,
  CALENDAR_EVENT_TYPE_TONES,
  SUBJECT_TAG_CLASSES,
  TONE_SOFT_CLASSES,
} from '../../../constants/ui';
import { cx } from '../../../utils/cx';
import { formatTimeRange, todayIsoWeekday } from '../../../utils/date';
import { dayLabel, slotsToGrid } from '../../../utils/schedule';
import { Checkbox } from '../../../components/ui/Checkbox';
import { LiveTag } from '../../../components/ui/LiveTag';

const WEEKDAYS = [1, 2, 3, 4, 5];

/**
 * Tag colour per subject for one schedule: the subjects shown take the colours in order (by subject id),
 * so up to four subjects never share one, and a subject keeps its colour all week.
 */
function subjectTagsOf(slots) {
  const subjectIds = [...new Set(slots.map((slot) => slot.classSubject.subjectId))].sort((a, b) => a - b);
  return new Map(
    subjectIds.map((id, index) => [id, SUBJECT_TAG_CLASSES[index % SUBJECT_TAG_CLASSES.length]]),
  );
}

/** Default slot content: the subject, then class and room. */
function DefaultSlotContent({ slot }) {
  const detail = [slot.classSubject.className, slot.room].filter(Boolean).join(' · ');
  return (
    <>
      <span className="block font-medium">{slot.classSubject.subjectName}</span>
      {detail && <span className="block text-xs text-gray-600">{detail}</span>}
    </>
  );
}

/**
 * One period: a calm grey box (the same row as the dashboard's periods) with the time, the subject's
 * code tag in its colour, then what the page wants to say about it.
 */
function Slot({ slot, tagClasses, renderSlot, onSlotClick }) {
  const { subjectCode } = slot.classSubject;
  const classes = cx(
    'block w-full rounded-2xl bg-gray-100 px-3 py-2.5 text-left text-sm text-gray-900',
    onSlotClick && 'cursor-pointer transition-colors hover:bg-gray-200',
  );
  const content = (
    <>
      <span className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
        <span className="text-xs font-semibold whitespace-nowrap text-gray-700 tabular-nums">
          {formatTimeRange(slot.startTime, slot.endTime)}
        </span>
        {subjectCode && (
          <span
            className={cx(
              'rounded-md px-1.5 text-xs leading-5 font-semibold ring-1 ring-subject-edge ring-inset',
              tagClasses,
            )}
          >
            {subjectCode}
          </span>
        )}
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
 * each with its subject's code tag in that subject's colour. It only draws what it is given, so the same grid serves a class, a teacher
 * and a student; the page decides which slots to fetch (useSchedules) and what a slot says.
 *
 * Monday to Friday are shown; the weekend appears when a slot falls on Saturday or Sunday, or when
 * the user ticks "Show weekend".
 *
 * @param {object} props
 * @param {Array<object>} props.slots schedule rows: { id, classSubjectId, classSubject: { classId, className,
 *   subjectId, subjectName, subjectCode, teacher }, dayOfWeek (1 = Monday), startTime, endTime, room }
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
  const subjectTags = subjectTagsOf(slots);
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
                      <Slot
                        slot={slot}
                        tagClasses={subjectTags.get(slot.classSubject.subjectId)}
                        renderSlot={renderSlot}
                        onSlotClick={onSlotClick}
                      />
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
