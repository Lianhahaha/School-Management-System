import { AnnouncementCard } from './AnnouncementCard';

/**
 * A stack of AnnouncementCards: the admin and teacher list, the student feed.
 * @param {object} props
 * @param {object[]} props.announcements
 * @param {(announcement: object) => import('react').ReactNode} [props.renderActions] buttons per card; return null for none
 * @param {string} [props.label] accessible name of the list
 */
export function AnnouncementList({ announcements, renderActions, label = 'Announcements' }) {
  return (
    <ul aria-label={label} className="space-y-4">
      {announcements.map((announcement) => (
        <li key={announcement.id}>
          <AnnouncementCard announcement={announcement} actions={renderActions?.(announcement)} />
        </li>
      ))}
    </ul>
  );
}
