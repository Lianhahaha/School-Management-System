import { ClipboardCheck } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '../../../components/ui/Button';
import { useMinutesNow } from '../../../hooks/useMinutesNow';
import { todayYmd } from '../../../utils/date';
import { lessonToMark } from '../../../utils/schedule';
import { AtRiskCard } from '../components/AtRiskCard';
import { DashboardColumns } from '../components/DashboardColumns';
import { DashboardView } from '../components/DashboardView';
import { PendingGradingCard } from '../components/PendingGradingCard';
import { RecentAnnouncementsCard } from '../components/RecentAnnouncementsCard';
import { SessionsProgressCard } from '../components/SessionsProgressCard';
import { TeacherClassesCard } from '../components/TeacherClassesCard';
import { TodayTimeline } from '../components/TodayTimeline';
import { UpcomingEventsCard } from '../components/UpcomingEventsCard';

const todayLabel = () =>
  new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

/**
 * The header's one yellow button: straight to the sheet of the lesson to mark now (see lessonToMark), or
 * nothing when today has nothing left to mark.
 */
function MarkAttendanceButton({ periods, minutesNow }) {
  const lesson = lessonToMark(periods, minutesNow);
  if (!lesson) return null;
  return (
    <Button
      as={Link}
      to={`/teacher/attendance?classSubjectId=${lesson.classSubjectId}&date=${todayYmd()}`}
      icon={ClipboardCheck}
      aria-label={`Mark attendance, ${lesson.className} ${lesson.subjectName} at ${lesson.startTime}`}
    >
      Mark attendance
    </Button>
  );
}

/**
 * /teacher: "What do I do today?" Today's periods first (the widest column) with their classes under them;
 * then today's attendance, grading and the students of their classes who need attention; then the calendar
 * and announcements.
 */
export default function TeacherDashboardPage() {
  const minutesNow = useMinutesNow();
  return (
    <DashboardView
      role="teacher"
      title="Today"
      description={todayLabel()}
      actions={(data) => <MarkAttendanceButton periods={data.todaySchedule} minutesNow={minutesNow} />}
    >
      {(data) => (
        <DashboardColumns
          wideFirst
          first={
            <>
              <TodayTimeline periods={data.todaySchedule} holiday={data.holidayToday} />
              <TeacherClassesCard classSubjects={data.classSubjects} homeroomClasses={data.homeroomClasses} />
            </>
          }
          second={
            <>
              <SessionsProgressCard attendance={data.attendanceToday} holiday={data.holidayToday} />
              <PendingGradingCard assessments={data.pendingGrading} />
              <AtRiskCard atRisk={data.atRisk} />
            </>
          }
          third={
            <>
              <UpcomingEventsCard events={data.upcomingEvents} to="/teacher/calendar" />
              <RecentAnnouncementsCard announcements={data.recentAnnouncements} to="/teacher/announcements" />
            </>
          }
        />
      )}
    </DashboardView>
  );
}
