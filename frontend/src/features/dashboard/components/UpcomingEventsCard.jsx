import { CalendarDays, CalendarRange } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { TextLink } from '../../../components/ui/TextLink';
import { EventTypeBadge } from '../../calendar/components/EventTypeBadge';
import { formatEventDates } from '../../calendar/dates';

/**
 * Holidays and school events running today or in the next 30 days (dashboard payload `upcomingEvents`,
 * at most five), with a link to the role's calendar.
 *
 * @param {object} props
 * @param {object[]} props.events
 * @param {string} props.to the role's calendar page
 */
export function UpcomingEventsCard({ events, to }) {
  return (
    <Card
      icon={CalendarDays}
      mark="cream"
      title="Coming up"
      description="Days with no classes and school events, next 30 days"
      actions={<TextLink to={to}>Calendar</TextLink>}
    >
      {events.length === 0 ? (
        <EmptyState icon={CalendarRange} title="Nothing on the calendar" compact />
      ) : (
        <ul className="divide-y divide-gray-200">
          {events.map((event) => (
            <li key={event.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{event.title}</p>
                <p className="mt-0.5 text-xs text-gray-600">{formatEventDates(event)}</p>
              </div>
              <EventTypeBadge type={event.type} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
