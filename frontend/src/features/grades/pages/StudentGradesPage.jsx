import { PageHeader } from '../../../components/layout/PageHeader';
import { ErrorState } from '../../../components/ui/ErrorState';
import { ExportCsvButton } from '../../../components/ui/ExportCsvButton';
import { Skeleton } from '../../../components/ui/Skeleton';
import { TERMS } from '../../../constants/shared';
import { TERM_LABELS } from '../../../constants/ui';
import { useListParams } from '../../../hooks/useListParams';
import { fetchAllPages } from '../../../lib/csv';
import { useAuth } from '../../auth/hooks';
import { useSchoolYear } from '../../enrollments/hooks';
import { listGrades } from '../api';
import { GradesBySubject } from '../components/GradesBySubject';
import { PrintReportCardButton, ReportCard } from '../components/ReportCard';
import { SchoolPeriodSelect } from '../components/SchoolPeriodSelect';
import { STUDENT_GRADES_CSV_COLUMNS } from '../csv';

/**
 * A student's own grades for one school year, optionally one semester (one picker: "AY 2026-2027 · 1st
 * Semester"), with CSV download and a printable report card of that year's class. Both choices live in the URL
 * (`academicYear`, `term`); the page opens on the year of the student's class (see useSchoolYear).
 */
export default function StudentGradesPage() {
  const { me } = useAuth();
  const list = useListParams({ filters: ['academicYear', 'term'] });
  const schoolYear = useSchoolYear('me', list.params.academicYear, me.currentEnrollment);
  const { academicYear, className } = schoolYear;
  const term = TERMS.includes(list.params.term) ? list.params.term : '';
  const period = `${academicYear} ${term ? TERM_LABELS[term] : 'whole year'}`;

  return (
    <>
      <PageHeader
        title="My grades"
        description="Your results per subject."
        actions={
          <>
            <SchoolPeriodSelect
              years={schoolYear.years}
              academicYear={academicYear}
              term={term}
              onChange={(nextYear, nextTerm) => list.setFilters({ academicYear: nextYear, term: nextTerm })}
              className="w-72 print:hidden"
            />
            <ExportCsvButton
              fileName={`my grades ${period}`}
              columns={STUDENT_GRADES_CSV_COLUMNS}
              getRows={() =>
                fetchAllPages(listGrades, {
                  academicYear,
                  ...(term && { term }),
                  sortBy: 'assessedOn',
                  sortOrder: 'asc',
                })
              }
            />
            {className && <PrintReportCardButton />}
          </>
        }
      />
      {schoolYear.error && (
        <ErrorState
          title="Couldn't load your school years"
          message={schoolYear.error.message}
          onRetry={schoolYear.refetch}
        />
      )}
      {schoolYear.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <GradesBySubject
          academicYear={academicYear}
          term={term || undefined}
          notEnrolled={!me.currentEnrollment}
          withUpcoming={academicYear === me.currentEnrollment?.academicYear}
        />
      )}
      {className && (
        <ReportCard
          student={{ ...me, studentNumber: me.profile?.studentNumber }}
          studentId="me"
          academicYear={academicYear}
          className={className}
          term={term || undefined}
        />
      )}
    </>
  );
}
