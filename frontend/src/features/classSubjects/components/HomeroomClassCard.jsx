import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { Card } from '../../../components/ui/Card';
import { countOf } from '../../../utils/format';
import { fullName } from '../../../utils/names';

/**
 * A class the teacher is homeroom teacher of: its subjects with their teachers, read-only.
 * Each subject links to its students (the teacher can see them, not change them).
 *
 * @param {object} props
 * @param {{ id: number, name: string, academicYear: string, studentCount: number }} props.schoolClass
 * @param {Array<{ id: number, subjectName: string, teacher: { firstName: string, lastName: string } }>} props.classSubjects
 */
export function HomeroomClassCard({ schoolClass, classSubjects }) {
  const { name, academicYear, studentCount } = schoolClass;
  return (
    <Card title={name} description={`${academicYear} · ${countOf(studentCount, 'student')}`}>
      {classSubjects.length === 0 ? (
        <p className="text-sm text-gray-600">This class has no subjects yet.</p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {classSubjects.map((classSubject) => (
            <li key={classSubject.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="font-medium text-gray-900">{classSubject.subjectName}</span>
                <span className="text-gray-600"> · {fullName(classSubject.teacher)}</span>
              </span>
              <Link
                to={`/teacher/classes/${classSubject.id}`}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-secondary py-1 pr-1.5 pl-2.5 font-medium text-gray-900 ring-1 ring-secondary-edge transition-colors ring-inset hover:bg-secondary-hover"
              >
                Students
                <ChevronRight className="size-4 text-gray-600" aria-hidden="true" />
                <span className="sr-only">
                  {' '}
                  of {classSubject.subjectName} in {name}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
