import { AdminAttendanceCard } from '../components/AdminAttendanceCard';
import { AdminCountTiles } from '../components/AdminCountTiles';
import { AdminQuickActionsCard } from '../components/AdminQuickActionsCard';
import { DashboardView } from '../components/DashboardView';
import { EnrollmentByGradeCard } from '../components/EnrollmentByGradeCard';
import { RecentAnnouncementsCard } from '../components/RecentAnnouncementsCard';
import { UpcomingAssessmentsCard } from '../components/UpcomingAssessmentsCard';

/** /admin: "Is the school running?" Counts, today's attendance, enrollment by grade, what is next. */
export default function AdminDashboardPage() {
  return (
    <DashboardView role="admin" title="Dashboard" description="How the school is doing right now.">
      {(data) => (
        <div className="space-y-6">
          <AdminCountTiles counts={data.counts} />
          <div className="grid gap-6 lg:grid-cols-2">
            <AdminAttendanceCard attendance={data.attendanceToday} />
            <EnrollmentByGradeCard grades={data.enrollmentsByGrade} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <UpcomingAssessmentsCard assessments={data.upcomingAssessments} />
            <RecentAnnouncementsCard announcements={data.recentAnnouncements} to="/admin/announcements" />
          </div>
          <AdminQuickActionsCard />
        </div>
      )}
    </DashboardView>
  );
}
