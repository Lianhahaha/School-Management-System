import { PageHeader } from '../../../components/layout/PageHeader';
import { ExportCsvButton } from '../../../components/ui/ExportCsvButton';
import { Select } from '../../../components/ui/Select';
import { TERM_OPTIONS } from '../../../constants/ui';
import { useListParams } from '../../../hooks/useListParams';
import { fetchAllPages } from '../../../lib/csv';
import { useAuth } from '../../auth/hooks';
import { NotEnrolledState } from '../../enrollments/components/NotEnrolledState';
import { listGrades } from '../api';
import { GradesBySubject } from '../components/GradesBySubject';
import { STUDENT_GRADES_CSV_COLUMNS } from '../csv';

/** A student's own grades per subject, optionally for one term. */
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
          me.currentEnrollment && (
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
            </>
          )
        }
      />
      {me.currentEnrollment ? <GradesBySubject term={term || undefined} /> : <NotEnrolledState />}
    </>
  );
}
