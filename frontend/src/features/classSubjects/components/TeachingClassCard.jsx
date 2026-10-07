import { Award, CalendarClock, ClipboardCheck, Users } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '../../../components/ui/Button';
import { formatPeriod } from '../../../utils/schedule';

/**
 * One subject the teacher teaches: class, subject, the next period and shortcuts to its students,
 * attendance and grades.
 *
 * @param {object} props
 * @param {{ id: number, className: string, subjectName: string, academicYear: string }} props.classSubject
 * @param {object|null} props.nextSlot the next timetable slot of this class-subject, or null
 */
export function TeachingClassCard({ classSubject, nextSlot }) {
  const { id, className, subjectName, academicYear } = classSubject;
  return (
    <article aria-label={`${subjectName}, ${className}`} className="sheet flex flex-col p-5">
      <h3 className="text-base font-semibold text-gray-900">{className}</h3>
      <p className="text-sm text-gray-700">{subjectName}</p>
      <p className="mt-0.5 text-xs text-gray-500">{academicYear}</p>
      <p className="mt-3 flex items-center gap-1.5 text-sm text-gray-600">
        <CalendarClock className="size-4 shrink-0 text-gray-400" aria-hidden="true" />
        {nextSlot ? <>Next: {formatPeriod(nextSlot)}</> : 'No periods scheduled'}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button as={Link} to={`/teacher/classes/${id}`} size="sm" variant="secondary" icon={Users}>
          Students
        </Button>
        <Button
          as={Link}
          to={`/teacher/attendance?classSubjectId=${id}`}
          size="sm"
          variant="secondary"
          icon={ClipboardCheck}
        >
          Attendance
        </Button>
        <Button
          as={Link}
          to={`/teacher/grades?classSubjectId=${id}`}
          size="sm"
          variant="secondary"
          icon={Award}
        >
          Grades
        </Button>
      </div>
    </article>
  );
}
