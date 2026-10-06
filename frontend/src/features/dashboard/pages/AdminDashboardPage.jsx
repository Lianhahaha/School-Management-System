import { Megaphone, UserPlus } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '../../../components/ui/Button';
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

/**
 * /admin: "Is the school running?" The setup checklist while the school is still being set up, then
 * counts, then three columns: the students who need attention and today's attendance; what is coming
 * (calendar, assessments); enrollment by grade and the latest announcements.
 */
export default function AdminDashboardPage() {
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
          <Button as={Link} to="/admin/users?new=1" icon={UserPlus}>
            Create user
          </Button>
        </>
      }
    >
      {(data) => (
        <div className="space-y-6">
          <SetupChecklistCard counts={data.counts} />
          <AdminCountTiles counts={data.counts} />
          <DashboardColumns
            first={
              <>
                <AtRiskCard atRisk={data.atRisk} studentPath={(id) => `/admin/students/${id}`} />
                <AdminAttendanceCard attendance={data.attendanceToday} holiday={data.holidayToday} />
              </>
            }
            second={
              <>
                <UpcomingEventsCard events={data.upcomingEvents} to="/admin/calendar" />
                <UpcomingAssessmentsCard assessments={data.upcomingAssessments} />
              </>
            }
            third={
              <>
                <EnrollmentByGradeCard grades={data.enrollmentsByGrade} />
                <RecentAnnouncementsCard announcements={data.recentAnnouncements} to="/admin/announcements" />
              </>
            }
          />
        </div>
      )}
    </DashboardView>
  );
}
