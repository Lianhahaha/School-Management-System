import { Megaphone, UserPlus } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '../../../components/ui/Button';
import { AdminAttendanceCard } from '../components/AdminAttendanceCard';
import { AdminCountTiles } from '../components/AdminCountTiles';
import { DashboardView } from '../components/DashboardView';
import { EnrollmentByGradeCard } from '../components/EnrollmentByGradeCard';
import { RecentAnnouncementsCard } from '../components/RecentAnnouncementsCard';
import { UpcomingAssessmentsCard } from '../components/UpcomingAssessmentsCard';

/** /admin: "Is the school running?" Counts, today's attendance, enrollment by grade, what is next. */
export default function AdminDashboardPage() {
  return (
    <DashboardView
      role="admin"
      title="Dashboard"
      description="How the school is doing right now."
      actions={
        <>
          <Button as={Link} to="/admin/announcements" variant="secondary" icon={Megaphone}>
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
          <AdminCountTiles counts={data.counts} />
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <AdminAttendanceCard attendance={data.attendanceToday} />
            <EnrollmentByGradeCard grades={data.enrollmentsByGrade} />
          </div>
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <UpcomingAssessmentsCard assessments={data.upcomingAssessments} />
            <RecentAnnouncementsCard announcements={data.recentAnnouncements} to="/admin/announcements" />
          </div>
        </div>
      )}
    </DashboardView>
  );
}
