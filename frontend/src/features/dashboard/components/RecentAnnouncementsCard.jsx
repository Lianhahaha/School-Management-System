import { MegaphoneIcon } from '@phosphor-icons/react';
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
    <Card
      icon={MegaphoneIcon}
      mark="maroon"
      title="Recent announcements"
      total={announcements.length > 0 ? announcements.length : undefined}
      actions={<TextLink to={to}>View all</TextLink>}
    >
      {announcements.length === 0 ? (
        <EmptyState icon={Megaphone} title="No announcements right now" compact />
      ) : (
        <ul className="divide-y divide-gray-200">
          {announcements.map((announcement) => (
            <li key={announcement.id} className="py-4 first:pt-0 last:pb-0">
              <AnnouncementCard announcement={announcement} bare />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
