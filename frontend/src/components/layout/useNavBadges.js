import { useAuth } from '../../features/auth/hooks';
import { useStudents } from '../../features/students/hooks';
import { countOf } from '../../utils/format';

/** Unenrolled, active students: the same filter as the dashboard's "Unenrolled students" tile. */
const UNENROLLED_PARAMS = { hasActiveEnrollment: 'false', isActive: 'true', limit: 1 };

/**
 * Counts shown beside navigation entries, keyed by the `badge` name in navConfig. Each count is an
 * ordinary query, so the live refresh keeps it current; a role only fetches its own counts.
 *
 * @returns {Record<string, { count: number, label: string }>}
 */
export function useNavBadges() {
  const { role } = useAuth();
  const unenrolled = useStudents(UNENROLLED_PARAMS, { enabled: role === 'admin' });
  const unenrolledCount = unenrolled.data?.meta?.total ?? 0;

  return {
    unenrolledStudents: {
      count: unenrolledCount,
      label: `${countOf(unenrolledCount, 'student')} without a class`,
    },
  };
}
