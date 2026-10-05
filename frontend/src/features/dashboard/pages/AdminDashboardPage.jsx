import { Megaphone, UserPlus } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '../../../components/ui/Button';
import { AdminAttendanceCard } from '../components/AdminAttendanceCard';
import { AdminCountTiles } from '../components/AdminCountTiles';
import { DashboardView } from '../components/DashboardView';
import { EnrollmentByGradeCard } from '../components/EnrollmentByGradeCard';
import { RecentAnnouncementsCard } from '../components/RecentAnnouncementsCard';
import { SetupChecklistCard } from '../components/SetupChecklistCard';
import { UpcomingAssessmentsCard } from '../components/UpcomingAssessmentsCard';

/**
 * /admin: "Is the school running?" The setup checklist while the school is still being set up, then
 * counts, today's attendance, enrollment by grade, what is next.
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
            to="/admin/announcements"
            variant="secondary"
            icon={Megaphone}
            className="max-sm:hidden"
          >
            New announcement
          </Button>
          <Button as={Link} to="/admin/users" icon={UserPlus}>
            Create user
          </Button>
        </>
      }
    >
      {(data) => (
        <div className="space-y-6">
          <SetupChecklistCard counts={data.counts} />
          <AdminCountTiles counts={data.counts} />
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              <AdminAttendanceCard attendance={data.attendanceToday} />
              <UpcomingAssessmentsCard assessments={data.upcomingAssessments} />
            </div>
            <div className="space-y-6">
              <EnrollmentByGradeCard grades={data.enrollmentsByGrade} />
              <RecentAnnouncementsCard announcements={data.recentAnnouncements} to="/admin/announcements" />
            </div>
          </div>
        </div>
      )}
    </DashboardView>
  );
}
