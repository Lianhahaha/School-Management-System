import { DashboardView } from '../components/DashboardView';
import { RecentAnnouncementsCard } from '../components/RecentAnnouncementsCard';
import { RecentGradesCard } from '../components/RecentGradesCard';
import { StudentAttendanceCard } from '../components/StudentAttendanceCard';
import { StudentGradeSummaryCard } from '../components/StudentGradeSummaryCard';
import { StudentHero } from '../components/StudentHero';
import { StudentTimetableCard } from '../components/StudentTimetableCard';
import { UpcomingAssessmentsCard } from '../components/UpcomingAssessmentsCard';

/**
 * /student: "How am I doing?" Read-only. Without an active enrollment only the identity hero (with
 * the not-enrolled state) and the announcements are shown, because every other block is class based.
 */
export default function StudentDashboardPage() {
  return (
    <DashboardView
      role="student"
      title="My dashboard"
      description="Your class, attendance and grades at a glance."
    >
      {(data) => (
        <div className="space-y-6">
          <StudentHero student={data.student} enrollment={data.currentEnrollment} />
          {data.currentEnrollment && (
            <>
              <div className="grid gap-6 lg:grid-cols-2">
                <StudentAttendanceCard summary={data.attendanceSummary} />
                <StudentGradeSummaryCard subjects={data.gradeSummary} />
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <StudentTimetableCard periods={data.todaySchedule} />
                <RecentGradesCard grades={data.recentGrades} />
              </div>
              <UpcomingAssessmentsCard assessments={data.upcomingAssessments} />
            </>
          )}
          <RecentAnnouncementsCard announcements={data.recentAnnouncements} to="/student/announcements" />
        </div>
      )}
    </DashboardView>
  );
}
