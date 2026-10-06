import { useNewAnnouncements } from '../../features/announcements/hooks';
import { useAuth } from '../../features/auth/hooks';
import { UNENROLLED_STUDENTS_PARAMS, useStudents } from '../../features/students/hooks';
import { countOf } from '../../utils/format';

/**
 * Counts shown beside navigation entries, keyed by the `badge` name in navConfig. Each count is an
 * ordinary query, so the live refresh keeps it current; a role only fetches its own counts.
 *
 * @returns {Record<string, { count: number, label: string }>}
 */
export function useNavBadges() {
  const { role } = useAuth();
  const unenrolled = useStudents(UNENROLLED_STUDENTS_PARAMS, { enabled: role === 'admin' });
  const unenrolledCount = unenrolled.data?.meta?.total ?? 0;
  const newAnnouncements = useNewAnnouncements();

  return {
    unenrolledStudents: {
      count: unenrolledCount,
      label: `${countOf(unenrolledCount, 'student')} without a class`,
    },
    newAnnouncements: {
      count: newAnnouncements,
      label: countOf(newAnnouncements, 'new announcement'),
    },
  };
}
