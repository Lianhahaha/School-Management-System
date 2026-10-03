import { Link } from 'react-router';
import { Card } from '../../../components/ui/Card';
import { DataTable } from '../../../components/ui/DataTable';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useClassSubjects } from '../../classSubjects/hooks';

const COLUMNS = [
  {
    key: 'class',
    header: 'Class',
    cell: (row) => (
      <Link to={`/admin/classes/${row.classId}`} className="font-medium text-brand-700 hover:underline">
        {row.className}
      </Link>
    ),
  },
  { key: 'subject', header: 'Subject', cell: (row) => `${row.subjectCode} · ${row.subjectName}` },
  { key: 'academicYear', header: 'Academic year' },
];

/** The class-subjects a teacher teaches, each linking to its class. Fetches its own data. */
export function TeacherAssignmentsTable({ teacherId }) {
  const { data, isPending, isFetching, error, refetch } = useClassSubjects({ teacherId, limit: 100 });
  return (
    <Card padded={false}>
      <DataTable
        label="Teaching assignments"
        columns={COLUMNS}
        rows={data?.items ?? []}
        rowKey="id"
        isLoading={isPending}
        isFetching={isFetching}
        error={error}
        onRetry={refetch}
        emptyState={
          <EmptyState
            title="No assignments"
            description="This teacher has not been assigned a subject in any class yet."
          />
        }
      />
    </Card>
  );
}
