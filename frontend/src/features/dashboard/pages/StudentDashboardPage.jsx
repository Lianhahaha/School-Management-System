import { DashboardView } from '../components/DashboardView';
import { RecentAnnouncementsCard } from '../components/RecentAnnouncementsCard';
import { RecentGradesCard } from '../components/RecentGradesCard';
import { StudentAttendanceCard } from '../components/StudentAttendanceCard';
import { StudentGradeSummaryCard } from '../components/StudentGradeSummaryCard';
import { StudentHero } from '../components/StudentHero';
import { StudentTimetableCard } from '../components/StudentTimetableCard';
import { StudentWaitingCard } from '../components/StudentWaitingCard';
import { UpcomingAssessmentsCard } from '../components/UpcomingAssessmentsCard';

/**
 * /student: "How am I doing?" Read-only. Without an active enrollment the identity hero, what to do
 * while waiting for a class, and the announcements are shown, because every other block is class based.
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
          {!data.currentEnrollment && <StudentWaitingCard />}
          {data.currentEnrollment && (
            <>
              <div className="grid items-start gap-6 lg:grid-cols-2">
                <div className="space-y-6">
                  <StudentTimetableCard periods={data.todaySchedule} />
                  <StudentAttendanceCard summary={data.attendanceSummary} />
                  <UpcomingAssessmentsCard assessments={data.upcomingAssessments} />
                </div>
                <div className="space-y-6">
                  <StudentGradeSummaryCard subjects={data.gradeSummary} />
                  <RecentGradesCard grades={data.recentGrades} />
                </div>
              </div>
            </>
          )}
          <RecentAnnouncementsCard announcements={data.recentAnnouncements} to="/student/announcements" />
        </div>
      )}
    </DashboardView>
  );
}
