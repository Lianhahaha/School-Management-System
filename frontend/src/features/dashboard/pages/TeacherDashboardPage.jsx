import { ClipboardCheck } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '../../../components/ui/Button';
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
    <DashboardView
      role="teacher"
      title="Today"
      description={todayLabel()}
      actions={
        <Button as={Link} to="/teacher/attendance" icon={ClipboardCheck}>
          Mark attendance
        </Button>
      }
    >
      {(data) => (
        <div className="grid items-start gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <TodayTimeline periods={data.todaySchedule} />
            <TeacherClassesCard classSubjects={data.classSubjects} homeroomClasses={data.homeroomClasses} />
          </div>
          <div className="space-y-6">
            <SessionsProgressCard attendance={data.attendanceToday} />
            <PendingGradingCard assessments={data.pendingGrading} />
            <RecentAnnouncementsCard announcements={data.recentAnnouncements} to="/teacher/announcements" />
          </div>
        </div>
      )}
    </DashboardView>
  );
}
