import { PageHeader } from '../../../components/layout/PageHeader';
import { ErrorState } from '../../../components/ui/ErrorState';
import { ExportCsvButton } from '../../../components/ui/ExportCsvButton';
import { Skeleton } from '../../../components/ui/Skeleton';
import { SEMESTER_LABELS } from '../../../constants/ui';
import { useListParams } from '../../../hooks/useListParams';
import { fetchAllPages } from '../../../lib/csv';
import { useAuth } from '../../auth/hooks';
import { useSchoolYear } from '../../enrollments/hooks';
import { listGrades } from '../api';
import { GradesBySubject } from '../components/GradesBySubject';
import { PrintReportCardButton, ReportCard } from '../components/ReportCard';
import { SchoolPeriodSelect } from '../components/SchoolPeriodSelect';
import { STUDENT_GRADES_CSV_COLUMNS } from '../csv';
import { semesterFromParam, semesterToParam } from '../periods';

/**
 * A student's own grades for one school year or one semester of it (one picker: "AY 2026-2027 · 1st
 * Semester"), with CSV download and a printable report card of that year's class for the same period. Both
 * choices live in the URL (`academicYear`, `semester`: sem1, sem2 or all for the whole year); the page opens
 * on the year of the student's class (see useSchoolYear) and, in the school year we are in, on the current
 * semester, so the table of its quarters shows (see periods.js).
 */
export default function StudentGradesPage() {
  const { me } = useAuth();
  const list = useListParams({ filters: ['academicYear', 'semester'] });
  const schoolYear = useSchoolYear('me', list.params.academicYear, me.currentEnrollment);
  const { academicYear, className } = schoolYear;
  const semester = semesterFromParam(list.params.semester, academicYear);
  const period = `${academicYear} ${semester ? SEMESTER_LABELS[semester] : 'whole year'}`;

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
              semester={semester}
              onChange={(nextYear, nextSemester) =>
                list.setFilters({ academicYear: nextYear, semester: semesterToParam(nextSemester) })
              }
              className="w-72 print:hidden"
            />
            <ExportCsvButton
              fileName={`my grades ${period}`}
              columns={STUDENT_GRADES_CSV_COLUMNS}
              getRows={() =>
                fetchAllPages(listGrades, {
                  academicYear,
                  ...(semester && { semester }),
                  sortBy: 'assessedOn',
                  sortOrder: 'asc',
                })
              }
            />
            {className && (
              <PrintReportCardButton
                studentId="me"
                academicYear={academicYear}
                semester={semester || undefined}
              />
            )}
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
          semester={semester || undefined}
          notEnrolled={!me.currentEnrollment}
          inClass={Boolean(className)}
          withUpcoming={academicYear === me.currentEnrollment?.academicYear}
        />
      )}
      {className && (
        <ReportCard
          student={{ ...me.profile, firstName: me.firstName, lastName: me.lastName }}
          studentId="me"
          academicYear={academicYear}
          className={className}
          semester={semester || undefined}
        />
      )}
    </>
  );
}
