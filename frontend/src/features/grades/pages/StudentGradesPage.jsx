import { PageHeader } from '../../../components/layout/PageHeader';
import { ExportCsvButton } from '../../../components/ui/ExportCsvButton';
import { Select } from '../../../components/ui/Select';
import { TERM_OPTIONS } from '../../../constants/ui';
import { useListParams } from '../../../hooks/useListParams';
import { fetchAllPages } from '../../../lib/csv';
import { useAuth } from '../../auth/hooks';
import { listGrades } from '../api';
import { GradesBySubject } from '../components/GradesBySubject';
import { PrintReportCardButton, ReportCard } from '../components/ReportCard';
import { STUDENT_GRADES_CSV_COLUMNS } from '../csv';

/**
 * A student's own grades per subject, optionally for one term, with CSV download and a printable report card.
 * Grades of earlier classes stay visible while the student is not in a class; the report card needs one.
 */
export default function StudentGradesPage() {
  const { me } = useAuth();
  const list = useListParams({ filters: ['term'] });
  const { term } = list.params;

  return (
    <>
      <PageHeader
        title="My grades"
        description="Your results per subject."
        actions={
          <>
            <Select
              aria-label="Term"
              options={TERM_OPTIONS}
              placeholder="All terms"
              value={term}
              onChange={(event) => list.setFilter('term', event.target.value)}
              className="w-40 print:hidden"
            />
            <ExportCsvButton
              fileName={`my grades ${term || 'all terms'}`}
              columns={STUDENT_GRADES_CSV_COLUMNS}
              getRows={() =>
                fetchAllPages(listGrades, { ...(term && { term }), sortBy: 'assessedOn', sortOrder: 'asc' })
              }
            />
            {me.currentEnrollment && <PrintReportCardButton />}
          </>
        }
      />
      <GradesBySubject term={term || undefined} notEnrolled={!me.currentEnrollment} />
      {me.currentEnrollment && (
        <ReportCard
          student={{ ...me, studentNumber: me.profile?.studentNumber }}
          enrollment={me.currentEnrollment}
          studentId="me"
          term={term || undefined}
        />
      )}
    </>
  );
}
