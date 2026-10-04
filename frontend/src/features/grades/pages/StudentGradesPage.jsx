import { PageHeader } from '../../../components/layout/PageHeader';
import { Select } from '../../../components/ui/Select';
import { TERM_OPTIONS } from '../../../constants/ui';
import { useListParams } from '../../../hooks/useListParams';
import { useAuth } from '../../auth/hooks';
import { NotEnrolledState } from '../../enrollments/components/NotEnrolledState';
import { GradesBySubject } from '../components/GradesBySubject';

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
            <Select
              aria-label="Term"
              options={TERM_OPTIONS}
              placeholder="All terms"
              value={term}
              onChange={(event) => list.setFilter('term', event.target.value)}
              className="w-40"
            />
          )
        }
      />
      {me.currentEnrollment ? <GradesBySubject term={term || undefined} /> : <NotEnrolledState />}
    </>
  );
}
