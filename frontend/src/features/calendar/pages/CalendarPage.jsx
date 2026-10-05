import { CalendarRange, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { PAGINATION } from '../../../constants/shared';
import { useConfirm } from '../../../hooks/useConfirm';
import { todayYmd } from '../../../utils/date';
import { useAuth } from '../../auth/hooks';
import { EventFormModal } from '../components/EventFormModal';
import { EventTypeBadge } from '../components/EventTypeBadge';
import { MonthGrid } from '../components/MonthGrid';
import { formatEventDates, monthGridDays, monthLabel, shiftMonth } from '../dates';
import { useCalendarEvents, useDeleteCalendarEvent } from '../hooks';

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * /admin/calendar, /teacher/calendar and /student/calendar: the school calendar one month at a time
 * (`?month=YYYY-MM`, this month by default) as a grid from `sm` up, and the month's entries as a list
 * (the whole view on phones). Admins add an entry with the button or on a day of the grid, and edit or
 * remove one from the grid or the list.
 */
export default function CalendarPage() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const confirm = useConfirm();
  const deleteEvent = useDeleteCalendarEvent();
  const [searchParams, setSearchParams] = useSearchParams();
  // undefined = closed; { event } edits it; { startsOn } adds one (startsOn may be '')
  const [form, setForm] = useState(undefined);

  const thisMonth = todayYmd().slice(0, 7);
  const requested = searchParams.get('month');
  const month = requested && MONTH_PATTERN.test(requested) ? requested : thisMonth;
  const goTo = (target) =>
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (target === thisMonth) next.delete('month');
        else next.set('month', target);
        return next;
      },
      { replace: true },
    );

  const days = monthGridDays(month);
  const { data, error, isPending, refetch } = useCalendarEvents({
    dateFrom: days[0],
    dateTo: days.at(-1),
    limit: PAGINATION.MAX_LIMIT,
  });
  const events = data?.items ?? [];
  const monthEvents = events.filter(
    (event) => event.startsOn.slice(0, 7) <= month && event.endsOn.slice(0, 7) >= month,
  );

  const onDelete = async (event) => {
    const ok = await confirm({
      title: `Remove "${event.title}"?`,
      description: "It disappears from everyone's calendar. On a holiday, attendance can be marked again.",
      confirmLabel: 'Remove entry',
    });
    if (ok) deleteEvent.mutate(event.id);
  };

  const label = monthLabel(month);

  let body;
  if (error && !data) {
    body = <ErrorState title="Couldn't load the calendar" message={error.message} onRetry={refetch} />;
  } else if (isPending) {
    body = <Skeleton className="h-96 w-full" />;
  } else {
    body = (
      <div className="space-y-6">
        <Card padded={false} className="max-sm:hidden">
          <div className="p-3">
            <MonthGrid
              month={month}
              caption={label}
              events={events}
              onAddOn={isAdmin ? (day) => setForm({ startsOn: day }) : undefined}
              onSelect={isAdmin ? (event) => setForm({ event }) : undefined}
            />
          </div>
        </Card>
        <Card title={`In ${label}`} total={monthEvents.length > 0 ? monthEvents.length : undefined}>
          {monthEvents.length === 0 ? (
            <EmptyState
              icon={CalendarRange}
              title="Nothing on the calendar this month"
              description="Holidays and school events appear here."
              compact
            />
          ) : (
            <ul className="divide-y divide-gray-200">
              {monthEvents.map((event) => (
                <li
                  key={event.id}
                  className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{event.title}</p>
                    <p className="mt-0.5 text-xs text-gray-600">{formatEventDates(event)}</p>
                    {event.description && <p className="mt-1 text-sm text-gray-700">{event.description}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <EventTypeBadge type={event.type} />
                    {isAdmin && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Pencil}
                          onClick={() => setForm({ event })}
                          aria-label={`Edit ${event.title}`}
                        />
                        <Button
                          variant="dangerGhost"
                          size="sm"
                          icon={Trash2}
                          onClick={() => onDelete(event)}
                          aria-label={`Remove ${event.title}`}
                        />
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Calendar"
        description="School holidays (no classes) and events."
        actions={
          isAdmin && (
            <Button icon={Plus} onClick={() => setForm({ startsOn: '' })}>
              Add entry
            </Button>
          )
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          icon={ChevronLeft}
          onClick={() => goTo(shiftMonth(month, -1))}
          aria-label="Previous month"
        />
        <h2 className="min-w-40 text-center text-base font-semibold text-gray-900" aria-live="polite">
          {label}
        </h2>
        <Button
          variant="secondary"
          size="sm"
          icon={ChevronRight}
          onClick={() => goTo(shiftMonth(month, 1))}
          aria-label="Next month"
        />
        {month !== thisMonth && (
          <Button variant="ghost" size="sm" onClick={() => goTo(thisMonth)}>
            This month
          </Button>
        )}
      </div>
      {body}
      {isAdmin && (
        <EventFormModal
          open={form !== undefined}
          onClose={() => setForm(undefined)}
          event={form?.event ?? null}
          startsOn={form?.startsOn ?? ''}
        />
      )}
    </>
  );
}
