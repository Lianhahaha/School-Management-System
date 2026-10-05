import { Award, Bell, BookOpen, ClipboardCheck, Megaphone, School, UserPlus } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Button } from '../../../components/ui/Button';
import { ROLE_HOME } from '../../../constants/ui';
import { cx } from '../../../utils/cx';
import { relativeTime } from '../../../utils/date';
import { countOf } from '../../../utils/format';
import { useNewAnnouncements } from '../../announcements/hooks';
import { useAuth } from '../../auth/hooks';
import { useMarkNotificationsRead, useNotifications, useUnreadCount } from '../hooks';

/** Notifications listed in the panel; older ones are rarely what anyone opens the bell for. */
const PANEL_SIZE = 15;

const TYPE_ICONS = {
  grade: Award,
  attendance: ClipboardCheck,
  enrollment: School,
  teaching: BookOpen,
  signup: UserPlus,
};

/** One notification: its icon, title, text and age; unread ones are bold with a red dot. Opens its link. */
function NotificationItem({ notification, onOpen }) {
  const Icon = TYPE_ICONS[notification.type] ?? Bell;
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(notification)}
        className="flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-gray-100"
      >
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cx('block text-sm text-gray-900', !notification.isRead && 'font-semibold')}>
            {notification.title}
          </span>
          {notification.body && <span className="block text-xs text-gray-600">{notification.body}</span>}
          <span className="mt-0.5 block text-xs text-gray-500">{relativeTime(notification.createdAt)}</span>
        </span>
        {!notification.isRead && (
          <span className="mt-2 size-2 shrink-0 rounded-full bg-red-600">
            <span className="sr-only">Unread</span>
          </span>
        )}
      </button>
    </li>
  );
}

/**
 * The bell in the top bar: a red count of unread notifications plus new announcements, and a panel with the
 * newest notifications (and a line for new announcements). Opening a notification marks it read and follows
 * its link; "Mark all read" clears the count. The panel closes on Escape (focus returns to the bell), a
 * click outside it and navigation. The count follows the live refresh, so new notifications appear by
 * themselves.
 */
export function NotificationBell() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const panelId = useId();
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const [openedOn, setOpenedOn] = useState(null);
  // Navigating anywhere closes the panel.
  if (openedOn !== null && openedOn !== pathname) setOpenedOn(null);
  const isOpen = openedOn !== null;

  const unread = useUnreadCount();
  const newAnnouncements = useNewAnnouncements();
  const total = unread + newAnnouncements;
  const list = useNotifications({ limit: PANEL_SIZE }, { enabled: isOpen });
  const markRead = useMarkNotificationsRead();

  useEffect(() => {
    if (!isOpen) return undefined;
    const closeOnOutside = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpenedOn(null);
    };
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      setOpenedOn(null);
      buttonRef.current?.focus();
    };
    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  const open = (notification) => {
    if (!notification.isRead) markRead.mutate([notification.id]);
    setOpenedOn(null);
    if (notification.link) navigate(notification.link);
  };

  const label = total > 0 ? `Notifications, ${countOf(total, 'new item')}` : 'Notifications';
  const items = list.data?.items ?? [];

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setOpenedOn(isOpen ? null : pathname)}
        className="relative flex size-10 items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 pointer-coarse:size-11"
      >
        <Bell className="size-5" aria-hidden="true" />
        {total > 0 && (
          <span
            aria-hidden="true"
            className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[0.625rem] leading-none font-semibold text-on-danger tabular-nums ring-2 ring-canvas"
          >
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          id={panelId}
          role="region"
          aria-label="Notifications"
          className="fixed inset-x-3 top-16 z-40 max-h-[70dvh] overflow-y-auto rounded-[1.25rem] bg-surface p-2 shadow-pop sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-96"
        >
          <div className="flex items-center justify-between gap-2 px-3 pt-2 pb-1">
            <h2 className="text-sm font-semibold text-gray-900">Notifications</h2>
            {unread > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markRead.mutate()}
                isLoading={markRead.isPending}
              >
                Mark all read
              </Button>
            )}
          </div>
          {newAnnouncements > 0 && (
            <Link
              to={`${ROLE_HOME[role]}/announcements`}
              className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-100"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink">
                <Megaphone className="size-4" aria-hidden="true" />
              </span>
              {countOf(newAnnouncements, 'new announcement')}
            </Link>
          )}
          {list.isPending ? (
            <p className="px-3 py-4 text-sm text-gray-600">Loading…</p>
          ) : items.length === 0 ? (
            newAnnouncements === 0 && (
              <p className="px-3 py-6 text-center text-sm text-gray-600">You&apos;re all caught up.</p>
            )
          ) : (
            <ul>
              {items.map((notification) => (
                <NotificationItem key={notification.id} notification={notification} onOpen={open} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
