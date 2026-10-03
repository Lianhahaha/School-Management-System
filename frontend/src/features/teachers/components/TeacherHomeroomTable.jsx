import { Link } from 'react-router';
import { Card } from '../../../components/ui/Card';
import { DataTable } from '../../../components/ui/DataTable';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useClasses } from '../../classes/hooks';

const COLUMNS = [
  {
    key: 'name',
    header: 'Class',
    cell: (row) => (
      <Link to={`/admin/classes/${row.id}`} className="font-medium text-brand-700 hover:underline">
        {row.name}
      </Link>
    ),
  },
  { key: 'gradeLevel', header: 'Grade' },
  { key: 'academicYear', header: 'Academic year' },
  { key: 'studentCount', header: 'Students', align: 'right' },
];

/** The classes a teacher is homeroom teacher of. Fetches its own data. */
export function TeacherHomeroomTable({ teacherId }) {
  const { data, isPending, isFetching, error, refetch } = useClasses({
    homeroomTeacherId: teacherId,
    limit: 100,
  });
  return (
    <Card padded={false}>
      <DataTable
        label="Homeroom classes"
        columns={COLUMNS}
        rows={data?.items ?? []}
        rowKey="id"
        isLoading={isPending}
        isFetching={isFetching}
        error={error}
        onRetry={refetch}
        emptyState={
          <EmptyState title="No homeroom classes" description="This teacher is not a homeroom teacher." />
        }
      />
    </Card>
  );
}
