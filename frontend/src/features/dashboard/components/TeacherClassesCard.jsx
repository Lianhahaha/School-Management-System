import { School } from 'lucide-react';
import { Link } from 'react-router';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { TextLink } from '../../../components/ui/TextLink';
import { countOf } from '../../../utils/format';

const CHIP = 'block rounded-[1.25rem] bg-gray-100 px-4 py-2.5 text-sm transition-colors hover:bg-gray-200';

/** Class-subjects a teacher teaches (chips open the class page) and the classes they lead as homeroom teacher. */
export function TeacherClassesCard({ classSubjects, homeroomClasses }) {
  const isEmpty = classSubjects.length === 0 && homeroomClasses.length === 0;

  return (
    <Card
      icon={School}
      mark="plum"
      title="My classes"
      actions={<TextLink to="/teacher/classes">View all</TextLink>}
    >
      {isEmpty ? (
        <EmptyState
          icon={School}
          title="No classes yet"
          description="You haven't been assigned to any class yet. Ask an administrator."
          compact
        />
      ) : (
        <div className="space-y-5">
          {classSubjects.length > 0 && (
            <section aria-labelledby="teaching-heading">
              <h3 id="teaching-heading" className="text-sm text-gray-500">
                Teaching
              </h3>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {classSubjects.map((classSubject) => (
                  <li key={classSubject.id}>
                    <Link to={`/teacher/classes/${classSubject.id}`} className={CHIP}>
                      <span className="font-medium text-gray-900">
                        {classSubject.className} · {classSubject.subjectName}
                      </span>
                      <span className="block text-xs text-gray-600">
                        {countOf(classSubject.studentCount, 'student')}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {homeroomClasses.length > 0 && (
            <section aria-labelledby="homeroom-heading">
              <h3 id="homeroom-heading" className="text-sm text-gray-500">
                Homeroom
              </h3>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {homeroomClasses.map((schoolClass) => (
                  <li key={schoolClass.id}>
                    <Link to="/teacher/classes" className={CHIP}>
                      <span className="font-medium text-gray-900">{schoolClass.name}</span>
                      <span className="block text-xs text-gray-600">
                        {countOf(schoolClass.studentCount, 'student')} · {schoolClass.academicYear}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Card>
  );
}
