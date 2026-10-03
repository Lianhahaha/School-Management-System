import { DashboardView } from '../components/DashboardView';
import { PendingGradingCard } from '../components/PendingGradingCard';
import { RecentAnnouncementsCard } from '../components/RecentAnnouncementsCard';
import { SessionsProgressCard } from '../components/SessionsProgressCard';
import { TeacherClassesCard } from '../components/TeacherClassesCard';
import { TodayTimeline } from '../components/TodayTimeline';

const todayLabel = () =>
  new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

/** /teacher: "What do I do today?" Today's periods first, then grading, classes and announcements. */
export default function TeacherDashboardPage() {
  return (
    <DashboardView role="teacher" title="Today" description={todayLabel()}>
      {(data) => (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <TodayTimeline periods={data.todaySchedule} />
            </div>
            <div className="space-y-6">
              <SessionsProgressCard attendance={data.attendanceToday} />
              <PendingGradingCard assessments={data.pendingGrading} />
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <TeacherClassesCard classSubjects={data.classSubjects} homeroomClasses={data.homeroomClasses} />
            <RecentAnnouncementsCard announcements={data.recentAnnouncements} to="/teacher/announcements" />
          </div>
        </div>
      )}
    </DashboardView>
  );
}
