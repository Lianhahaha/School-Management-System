import { School } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { SearchInput } from '../../../components/ui/SearchInput';
import { Skeleton } from '../../../components/ui/Skeleton';
import { PAGINATION } from '../../../constants/shared';
import { currentAcademicYear } from '../../../utils/date';
import { groupBy } from '../../../utils/grades';
import { nextPeriodOf } from '../../../utils/schedule';
import { useAuth } from '../../auth/hooks';
import { useClasses } from '../../classes/hooks';
import { useSchedules } from '../../schedules/hooks';
import { HomeroomClassCard } from '../components/HomeroomClassCard';
import { TeachingClassCard } from '../components/TeachingClassCard';
import { useClassSubjects } from '../hooks';

const GRID = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3';

function Group({ id, title, description, children }) {
  return (
    <section aria-labelledby={id} className="mb-8">
      <h2 id={id} className="text-lg font-semibold text-gray-900">
        {title}
      </h2>
      <p className="mt-0.5 mb-4 text-sm text-gray-600">{description}</p>
      {children}
    </section>
  );
}

export default function MyClassesPage() {
  const { me } = useAuth();
  const [search, setSearch] = useState('');
  const academicYear = currentAcademicYear();
  const thisYear = { academicYear, limit: PAGINATION.MAX_LIMIT };
  // No scope filter: the backend returns what the teacher can see (taught subjects plus homeroom classes).
  const classSubjects = useClassSubjects({ ...thisYear, sortBy: 'className', sortOrder: 'asc' });
  const homeroomClasses = useClasses({ ...thisYear, homeroomTeacherId: 'me' });
  const schedules = useSchedules({ ...thisYear, teacherId: 'me' });

  const { teaching, homeroom } = useMemo(() => {
    const subjects = classSubjects.data?.items ?? [];
    const term = search.trim().toLowerCase();
    const matches = (text) => text.toLowerCase().includes(term);
    const slotsBySubject = groupBy(schedules.data?.items ?? [], (slot) => slot.classSubjectId);
    return {
      teaching: subjects
        .filter((subject) => subject.teacherId === me.teacherId)
        .filter((subject) => !term || matches(`${subject.className} ${subject.subjectName}`))
        .map((subject) => ({
          classSubject: subject,
          nextSlot: nextPeriodOf(slotsBySubject.get(subject.id) ?? []),
        })),
      homeroom: (homeroomClasses.data?.items ?? [])
        .filter((schoolClass) => !term || matches(schoolClass.name))
        .map((schoolClass) => ({
          schoolClass,
          classSubjects: subjects.filter((subject) => subject.classId === schoolClass.id),
        })),
    };
  }, [classSubjects.data, homeroomClasses.data, schedules.data, search, me.teacherId]);

  const header = (
    <PageHeader
      title="My classes"
      description={`The subjects you teach and the classes you look after in ${academicYear}.`}
    />
  );

  // The timetable gives each card its next period: without it every card would say "No periods scheduled".
  const failure = classSubjects.error ?? homeroomClasses.error ?? schedules.error;
  if (failure) {
    return (
      <>
        {header}
        <ErrorState
          title="Couldn't load your classes"
          message={failure.message}
          onRetry={() => {
            classSubjects.refetch();
            homeroomClasses.refetch();
            schedules.refetch();
          }}
        />
      </>
    );
  }
  if (classSubjects.isPending || homeroomClasses.isPending || schedules.isPending) {
    return (
      <>
        {header}
        <div role="status" aria-label="Loading your classes" className={GRID}>
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-40" />
          ))}
        </div>
      </>
    );
  }

  const hasAnything =
    classSubjects.data.items.some((subject) => subject.teacherId === me.teacherId) ||
    homeroomClasses.data.items.length > 0;
  if (!hasAnything) {
    return (
      <>
        {header}
        <div className="sheet">
          <EmptyState
            icon={School}
            title="You haven't been assigned to any class yet"
            description="Ask an administrator to assign you to a class."
          />
        </div>
      </>
    );
  }

  return (
    <>
      {header}
      <div className="mb-6">
        <SearchInput value={search} onChange={setSearch} placeholder="Search class or subject" />
      </div>

      <Group
        id="teaching-heading"
        title="Teaching"
        description="Subjects you teach. You can take attendance and grade them."
      >
        {teaching.length === 0 ? (
          <p className="text-sm text-gray-600">
            {search ? 'No teaching assignment matches your search.' : 'You do not teach any subject yet.'}
          </p>
        ) : (
          <div className={GRID}>
            {teaching.map(({ classSubject, nextSlot }) => (
              <TeachingClassCard key={classSubject.id} classSubject={classSubject} nextSlot={nextSlot} />
            ))}
          </div>
        )}
      </Group>

      {(homeroom.length > 0 || homeroomClasses.data.items.length > 0) && (
        <Group
          id="homeroom-heading"
          title="Homeroom"
          description="Classes you are homeroom teacher of. You can see their subjects and students, not change them."
        >
          {homeroom.length === 0 ? (
            <p className="text-sm text-gray-600">No homeroom class matches your search.</p>
          ) : (
            <div className={GRID}>
              {homeroom.map(({ schoolClass, classSubjects: subjects }) => (
                <HomeroomClassCard key={schoolClass.id} schoolClass={schoolClass} classSubjects={subjects} />
              ))}
            </div>
          )}
        </Group>
      )}
    </>
  );
}
