import { Megaphone, UserPlus } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '../../../components/ui/Button';
import { can } from '../../../utils/roles';
import { useAuth } from '../../auth/hooks';
import { AdminAttendanceCard } from '../components/AdminAttendanceCard';
import { AdminCountTiles } from '../components/AdminCountTiles';
import { AtRiskCard } from '../components/AtRiskCard';
import { DashboardColumns } from '../components/DashboardColumns';
import { DashboardView } from '../components/DashboardView';
import { EnrollmentByGradeCard } from '../components/EnrollmentByGradeCard';
import { RecentAnnouncementsCard } from '../components/RecentAnnouncementsCard';
import { SetupChecklistCard } from '../components/SetupChecklistCard';
import { UpcomingAssessmentsCard } from '../components/UpcomingAssessmentsCard';
import { UpcomingEventsCard } from '../components/UpcomingEventsCard';

/** How many upcoming assessments and announcements the dashboard lists; their pages hold the rest. */
const ASSESSMENTS_SHOWN = 5;
const ANNOUNCEMENTS_SHOWN = 3;

/**
 * /admin: "Is the school running?" The setup checklist while the school is still being set up (the admin's),
 * then the counts, then the students who need attention as a full-width table read across, then two roomy
 * columns: today's attendance and the next assessments; what is coming on the calendar, enrollment by grade
 * and the latest announcements. A student assistant gets the same page (the API sends them the admin's
 * payload), with "Add student" in place of "Create user".
 */
export default function AdminDashboardPage() {
  const { role } = useAuth();
  // The Users page is the admin's; a student assistant creates student accounts on the Students page.
  const create = can(role, 'users.list')
    ? { to: '/admin/users?new=1', label: 'Create user' }
    : { to: '/admin/students?new=1', label: 'Add student' };

  return (
    <DashboardView
      role="admin"
      title="Dashboard"
      description="How the school is doing right now."
      actions={
        <>
          <Button
            as={Link}
            to="/admin/announcements?new=1"
            variant="secondary"
            icon={Megaphone}
            className="max-sm:hidden"
          >
            New announcement
          </Button>
          <Button as={Link} to={create.to} icon={UserPlus}>
            {create.label}
          </Button>
        </>
      }
    >
      {(data) => (
        <div className="space-y-8">
          {can(role, 'school.setUp') && <SetupChecklistCard counts={data.counts} />}
          <AdminCountTiles counts={data.counts} />
          <AtRiskCard atRisk={data.atRisk} studentPath={(id) => `/admin/students/${id}`} layout="table" />
          <DashboardColumns
            first={
              <>
                <AdminAttendanceCard attendance={data.attendanceToday} holiday={data.holidayToday} />
                <UpcomingAssessmentsCard assessments={data.upcomingAssessments} limit={ASSESSMENTS_SHOWN} />
              </>
            }
            second={
              <>
                <UpcomingEventsCard events={data.upcomingEvents} to="/admin/calendar" />
                <EnrollmentByGradeCard grades={data.enrollmentsByGrade} />
                <RecentAnnouncementsCard
                  announcements={data.recentAnnouncements.slice(0, ANNOUNCEMENTS_SHOWN)}
                  to="/admin/announcements"
                />
              </>
            }
          />
        </div>
      )}
    </DashboardView>
  );
}
