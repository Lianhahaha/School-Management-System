import { useState } from 'react';
import { Badge } from '../../../components/ui/Badge';
import { cx } from '../../../utils/cx';
import { formatDateTime, relativeTime } from '../../../utils/date';
import { fullName } from '../../../utils/names';
import { roleLabel } from '../../../utils/roles';
import { AnnouncementStatusBadge } from './AnnouncementStatusBadge';
import { AudienceBadge } from './AudienceBadge';

/** Bodies longer than this (or with several line breaks) get a "Read more" toggle. */
const CLAMP_CHARACTERS = 200;
const CLAMP_LINES = 3;

const needsToggle = (body) => body.length > CLAMP_CHARACTERS || body.split('\n').length > CLAMP_LINES;

/**
 * One announcement. The full list payload shows author and a body clamped to three lines with
 * "Read more"; the dashboard's brief payload (no body, no author) renders the same card without them.
 * Pass `actions` (edit / delete buttons) only for the people who may use them.
 *
 * @param {object} props
 * @param {object} props.announcement list item (`Announcement`) or dashboard item (`AnnouncementBrief`)
 * @param {import('react').ReactNode} [props.actions] right-aligned buttons
 * @param {boolean} [props.bare] drop the border and padding, for use inside another card
 */
export function AnnouncementCard({ announcement, actions, bare = false }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { title, body, audience, className, author, publishedAt, expiresAt, status } = announcement;
  const isScheduled = status === 'scheduled';

  return (
    <article className={cx(!bare && 'sheet p-5')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold break-words text-gray-900">{title}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <AudienceBadge audience={audience} />
            {className && <Badge tone="gray">{className}</Badge>}
            {status && status !== 'active' && <AnnouncementStatusBadge status={status} />}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </div>

      <p className="mt-2 text-xs text-gray-600">
        {author && (
          <>
            {fullName(author)} ({roleLabel(author.role)}) ·{' '}
          </>
        )}
        {isScheduled ? 'publishes ' : 'published '}
        <time dateTime={publishedAt} title={formatDateTime(publishedAt)}>
          {relativeTime(publishedAt)}
        </time>
        {expiresAt && (
          <>
            {' · '}
            {status === 'expired' ? 'expired ' : 'expires '}
            <time dateTime={expiresAt} title={formatDateTime(expiresAt)}>
              {formatDateTime(expiresAt)}
            </time>
          </>
        )}
      </p>

      {body !== undefined && (
        <div className="mt-3">
          <p
            className={cx(
              'text-sm leading-relaxed break-words whitespace-pre-line text-gray-700',
              !isExpanded && 'line-clamp-3',
            )}
          >
            {body}
          </p>
          {needsToggle(body) && (
            <button
              type="button"
              onClick={() => setIsExpanded((current) => !current)}
              aria-expanded={isExpanded}
              className="link mt-1 inline-block text-sm"
            >
              {isExpanded ? 'Show less' : 'Read more'}
              <span className="sr-only"> of {title}</span>
            </button>
          )}
        </div>
      )}
    </article>
  );
}
