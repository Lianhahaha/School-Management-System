import { AnnouncementCard } from './AnnouncementCard';

/**
 * A stack of AnnouncementCards: the admin and teacher list, the student feed.
 * @param {object} props
 * @param {object[]} props.announcements
 * @param {(announcement: object) => import('react').ReactNode} [props.renderActions] buttons per card; return null for none
 * @param {string} [props.label] accessible name of the list
 * @param {(announcement: object) => boolean} [props.isNew] tags the cards not marked read yet
 * @param {(announcement: object) => void} [props.onMarkRead] "Mark as read" on the new cards
 */
export function AnnouncementList({
  announcements,
  renderActions,
  label = 'Announcements',
  isNew,
  onMarkRead,
}) {
  return (
    <ul aria-label={label} className="space-y-4">
      {announcements.map((announcement) => (
        <li key={announcement.id}>
          <AnnouncementCard
            announcement={announcement}
            actions={renderActions?.(announcement)}
            isNew={isNew?.(announcement)}
            onMarkRead={onMarkRead && (() => onMarkRead(announcement))}
          />
        </li>
      ))}
    </ul>
  );
}
