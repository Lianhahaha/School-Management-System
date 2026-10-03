import { Megaphone } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { TextLink } from '../../../components/ui/TextLink';
import { AnnouncementCard } from '../../announcements/components/AnnouncementCard';

/**
 * The latest announcements (dashboard payload `recentAnnouncements`, at most five) in the same
 * card the announcement pages use, with a link to the full list of the role.
 *
 * @param {object} props
 * @param {object[]} props.announcements
 * @param {string} props.to the role's announcements page
 */
export function RecentAnnouncementsCard({ announcements, to }) {
  return (
    <Card title="Recent announcements" actions={<TextLink to={to}>View all</TextLink>}>
      {announcements.length === 0 ? (
        <EmptyState icon={Megaphone} title="No announcements right now" className="py-6" />
      ) : (
        <ul className="divide-y divide-gray-100">
          {announcements.map((announcement) => (
            <li key={announcement.id}>
              <AnnouncementCard announcement={announcement} bare />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
