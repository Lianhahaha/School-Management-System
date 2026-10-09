import { Plus } from 'lucide-react';
import {
  CALENDAR_EVENT_TYPE_LABELS,
  CALENDAR_EVENT_TYPE_MARKS,
  DAY_SHORT_LABELS,
} from '../../../constants/ui';
import { cx } from '../../../utils/cx';
import { formatDate, todayYmd } from '../../../utils/date';
import { coversDay, monthGridDays } from '../dates';

/** Entries shown inside one day; the rest are counted ("+2 more"). */
const MAX_PER_DAY = 2;

/**
 * One entry inside a day: a light box with the title in bold ink and a small solid square for its kind; a
 * button for admins (opens the entry), plain text otherwise.
 */
function EventChip({ event, onSelect }) {
  const classes =
    'flex w-full items-center gap-1.5 rounded-md bg-surface px-1.5 py-0.5 text-left text-xs font-semibold text-gray-900 ring-1 ring-gray-300 ring-inset';
  const name = `${event.title}, ${CALENDAR_EVENT_TYPE_LABELS[event.type]}`;
  const content = (
    <>
      <span
        aria-hidden="true"
        className={cx('size-2 shrink-0 rounded-[2px]', CALENDAR_EVENT_TYPE_MARKS[event.type])}
      />
      <span className="truncate">{event.title}</span>
    </>
  );
  return onSelect ? (
    <button
      type="button"
      onClick={() => onSelect(event)}
      className={cx(classes, 'hover:bg-gray-50')}
      aria-label={`Edit ${name}`}
    >
      {content}
    </button>
  ) : (
    <span className={classes} title={name}>
      {content}
    </span>
  );
}

/**
 * The month as a table of weeks (Monday first) with each day's entries as chips in bold ink, marked by a
 * small square: amber for no classes, ink for events. Days outside the month are faded; today is ringed. Admins get a button per day
 * that adds an entry on it, and every chip opens its entry.
 *
 * @param {object} props
 * @param {string} props.month 'YYYY-MM'
 * @param {string} props.caption accessible name, for example "October 2026"
 * @param {object[]} props.events entries overlapping the grid
 * @param {(day: string) => void} [props.onAddOn] admin: add an entry on this day
 * @param {(event: object) => void} [props.onSelect] admin: open an entry
 */
export function MonthGrid({ month, caption, events, onAddOn, onSelect }) {
  const days = monthGridDays(month);
  const weeks = Array.from({ length: days.length / 7 }, (_, week) => days.slice(week * 7, week * 7 + 7));
  const today = todayYmd();

  return (
    <table className="w-full table-fixed border-separate border-spacing-1">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          {[1, 2, 3, 4, 5, 6, 7].map((weekday) => (
            <th key={weekday} scope="col" className="pb-1 text-xs font-medium text-gray-500">
              {DAY_SHORT_LABELS[weekday]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeks.map((week) => (
          <tr key={week[0]}>
            {week.map((day) => {
              const dayEvents = events.filter((event) => coversDay(event, day));
              const isOtherMonth = !day.startsWith(month);
              const isToday = day === today;
              return (
                <td
                  key={day}
                  className={cx(
                    'h-24 rounded-xl p-1.5 align-top',
                    isOtherMonth ? 'bg-transparent' : 'bg-gray-50',
                    isToday && 'ring-2 ring-accent ring-inset',
                  )}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={cx(
                        'text-xs tabular-nums',
                        isOtherMonth ? 'text-gray-500' : 'font-semibold text-gray-800',
                      )}
                    >
                      <span className="sr-only">{formatDate(day)}</span>
                      <span aria-hidden="true">{Number(day.slice(8))}</span>
                    </span>
                    {onAddOn && !isOtherMonth && (
                      <button
                        type="button"
                        onClick={() => onAddOn(day)}
                        aria-label={`Add an entry on ${formatDate(day)}`}
                        className="flex size-6 items-center justify-center rounded-md text-gray-500 opacity-0 transition-opacity hover:bg-gray-200 hover:text-gray-900 focus-visible:opacity-100 pointer-coarse:opacity-100 [td:hover_&]:opacity-100"
                      >
                        <Plus className="size-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <ul className="space-y-1">
                    {dayEvents.slice(0, MAX_PER_DAY).map((event) => (
                      <li key={event.id}>
                        <EventChip event={event} onSelect={onSelect} />
                      </li>
                    ))}
                    {dayEvents.length > MAX_PER_DAY && (
                      <li className="px-1.5 text-xs text-gray-500">+{dayEvents.length - MAX_PER_DAY} more</li>
                    )}
                  </ul>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
