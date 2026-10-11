import { PENDING_APPLICATIONS_PARAMS } from '../../features/admissions/hooks';
import { useNewAnnouncements } from '../../features/announcements/hooks';
import {
  PENDING_ASSISTANT_REQUESTS_PARAMS,
  useAssistantRequests,
} from '../../features/assistantRequests/hooks';
import { useAuth } from '../../features/auth/hooks';
import { UNENROLLED_STUDENTS_PARAMS, useStudents } from '../../features/students/hooks';
import { countOf } from '../../utils/format';
import { can } from '../../utils/roles';

/**
 * Counts shown beside navigation entries, keyed by the `badge` name in navConfig. Each count is an
 * ordinary query, so the live refresh keeps it current; a role only fetches its own counts (the
 * school-wide student counts and the student assistant requests: the office, that is the admin and the
 * approved student assistant; one who is not approved never gets the app shell).
 *
 * @returns {Record<string, { count: number, label: string }>}
 */
export function useNavBadges() {
  const { role } = useAuth();
  const readsSchool = can(role, 'school.readAll');
  const unenrolled = useStudents(UNENROLLED_STUDENTS_PARAMS, { enabled: readsSchool });
  const unenrolledCount = unenrolled.data?.meta?.total ?? 0;
  const applications = useStudents(PENDING_APPLICATIONS_PARAMS, { enabled: readsSchool });
  const applicationCount = applications.data?.meta?.total ?? 0;
  const assistantRequests = useAssistantRequests(PENDING_ASSISTANT_REQUESTS_PARAMS, {
    enabled: can(role, 'assistantRequests.review'),
  });
  const assistantRequestCount = assistantRequests.data?.meta?.total ?? 0;
  const newAnnouncements = useNewAnnouncements();

  return {
    unenrolledStudents: {
      count: unenrolledCount,
      label: `${countOf(unenrolledCount, 'student')} without a class`,
    },
    pendingApplications: {
      count: applicationCount,
      label: `${countOf(applicationCount, 'applicant')} waiting to pick a class`,
    },
    pendingAssistantRequests: {
      count: assistantRequestCount,
      label: `${countOf(assistantRequestCount, 'student assistant request')} waiting`,
    },
    newAnnouncements: {
      count: newAnnouncements,
      label: countOf(newAnnouncements, 'new announcement'),
    },
  };
}
