import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';
import { fullName, initials } from '../../../utils/names';
import { NotEnrolledState } from '../../attendance/components/NotEnrolledState';

/**
 * Who the student is: initials, name, student number, class, academic year and homeroom teacher
 * (payload `student` and `currentEnrollment`). Without an active enrollment it shows the safe
 * "not enrolled" state instead of the class details.
 */
export function StudentHero({ student, enrollment }) {
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-5">
        <span
          aria-hidden="true"
          className="flex size-16 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xl font-semibold text-brand-800"
        >
          {initials(student)}
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-gray-900">{fullName(student)}</h2>
          <p className="mt-0.5 text-sm text-gray-600">{student.studentNumber}</p>
          {enrollment && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-700">
              <Badge tone="blue">{enrollment.className}</Badge>
              <span>Academic year {enrollment.academicYear}</span>
              <span>
                Homeroom teacher:{' '}
                {enrollment.homeroomTeacher ? fullName(enrollment.homeroomTeacher) : 'not assigned yet'}
              </span>
            </div>
          )}
        </div>
      </div>
      {!enrollment && <NotEnrolledState />}
    </Card>
  );
}
