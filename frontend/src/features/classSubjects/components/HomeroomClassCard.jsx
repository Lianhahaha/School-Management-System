import { Link } from 'react-router';
import { Card } from '../../../components/ui/Card';
import { countOf } from '../../../utils/format';
import { fullName } from '../../../utils/names';

/**
 * A class the teacher is homeroom teacher of: its subjects with their teachers, read-only.
 * Each subject links to its roster (the teacher can see it, not change it).
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
            <li
              key={classSubject.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
            >
              <span>
                <span className="font-medium text-gray-900">{classSubject.subjectName}</span>
                <span className="text-gray-600"> · {fullName(classSubject.teacher)}</span>
              </span>
              <Link to={`/teacher/classes/${classSubject.id}`} className="link">
                Roster
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
