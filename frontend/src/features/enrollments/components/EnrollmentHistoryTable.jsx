import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { DataTable } from '../../../components/ui/DataTable';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ENROLLMENT_STATUS_LABELS, ENROLLMENT_STATUS_TONES } from '../../../constants/ui';
import { useConfirm } from '../../../hooks/useConfirm';
import { formatDate } from '../../../utils/date';
import { fullName } from '../../../utils/names';
import { useEnrollments, useSetEnrollmentStatus } from '../hooks';

const CLOSE_ACTIONS = [
  {
    status: 'withdrawn',
    label: 'Withdraw',
    describe: (name, className) =>
      `${name} leaves ${className} and has no class until you enroll them again. This cannot be undone.`,
  },
  {
    status: 'completed',
    label: 'Mark completed',
    describe: (name, className) =>
      `${name} finished ${className}. The enrollment is closed and cannot be reopened.`,
  },
];

/**
 * Every enrollment of one student, newest first: class, academic year, status badge, enrolled and
 * left dates. With `canManage`, an active row offers Withdraw and Mark completed behind a
 * confirmation; closed rows have no actions (transitions are one-way, and `transferred` rows are
 * written only by a transfer).
 *
 * @param {object} props
 * @param {number|string} props.studentId a student id
 * @param {boolean} [props.canManage] show the admin actions (default true)
 */
export function EnrollmentHistoryTable({ studentId, canManage = true }) {
  const { data, isPending, isFetching, error, refetch } = useEnrollments({
    studentId,
    sortBy: 'enrolledOn',
    sortOrder: 'desc',
    limit: 100,
  });
  const setStatus = useSetEnrollmentStatus();
  const confirm = useConfirm();

  const close = async (enrollment, action) => {
    const name = fullName(enrollment.student);
    const ok = await confirm({
      title: `${action.label} ${name}?`,
      description: action.describe(name, enrollment.class.name),
      confirmLabel: action.label,
      tone: action.status === 'withdrawn' ? 'danger' : 'primary',
    });
    if (ok) setStatus.mutate({ id: enrollment.id, status: action.status });
  };

  const columns = [
    { key: 'class', header: 'Class', cell: (row) => row.class.name },
    { key: 'academicYear', header: 'Year', cell: (row) => row.class.academicYear },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <Badge tone={ENROLLMENT_STATUS_TONES[row.status]}>{ENROLLMENT_STATUS_LABELS[row.status]}</Badge>
      ),
    },
    { key: 'enrolledOn', header: 'Since', cell: (row) => formatDate(row.enrolledOn) },
    { key: 'leftOn', header: 'Left', hideBelow: 'md', cell: (row) => formatDate(row.leftOn) },
  ];
  if (canManage) {
    columns.push({
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (row) =>
        row.status === 'active' && (
          <div className="flex justify-end gap-1">
            {CLOSE_ACTIONS.map((action) => (
              <Button
                key={action.status}
                size="sm"
                variant="secondary"
                disabled={setStatus.isPending}
                onClick={() => close(row, action)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        ),
    });
  }

  return (
    <Card padded={false}>
      <DataTable
        label="Enrollment history"
        columns={columns}
        rows={data?.items ?? []}
        rowKey="id"
        isLoading={isPending}
        isFetching={isFetching}
        error={error}
        onRetry={refetch}
        emptyState={
          <EmptyState
            title="Never enrolled"
            description="This student has not been enrolled in any class yet."
          />
        }
      />
    </Card>
  );
}
