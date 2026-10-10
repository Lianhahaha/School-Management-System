import { Plus, Wallet } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/ui/DataTable';
import { EmptyState } from '../../../components/ui/EmptyState';
import { FilterBar } from '../../../components/ui/FilterBar';
import { PAGINATION } from '../../../constants/shared';
import { useConfirm } from '../../../hooks/useConfirm';
import { useDisclosure } from '../../../hooks/useDisclosure';
import { formatPeso } from '../../../utils/format';
import { schoolYearLabel } from '../../enrollments/schoolYears';
import { FeeFormModal } from '../components/FeeFormModal';
import { FeeYearSelect } from '../components/FeeYearSelect';
import { useDeleteFee, useFeeYear, useFees } from '../hooks';

const appliesTo = (fee) => (fee.gradeLevel === null ? 'All grades' : `Grade ${fee.gradeLevel}`);

/**
 * /admin/fees: what the school charges in one school year (see useFeeYear), each fee for one grade or for
 * every grade, with the sum of the list below the table. One page of 100 holds any real school year's fees,
 * so the list is not paginated.
 */
export default function FeesPage() {
  const [academicYear, setAcademicYear] = useFeeYear();
  const { data, isPending, isFetching, error, refetch } = useFees({
    academicYear,
    limit: PAGINATION.MAX_LIMIT,
  });
  const deleteFee = useDeleteFee();
  const confirm = useConfirm();
  const createModal = useDisclosure();
  const [editing, setEditing] = useState(null);
  const fees = data?.items ?? [];

  const onDelete = async (fee) => {
    const ok = await confirm({
      title: `Delete ${fee.name} (${appliesTo(fee)})?`,
      description: `It is taken off the fee statements of ${schoolYearLabel(fee.academicYear)}. Payments already recorded stay.`,
      confirmLabel: 'Delete fee',
    });
    if (ok) deleteFee.mutate(fee.id);
  };

  const columns = [
    { key: 'name', header: 'Name' },
    { key: 'appliesTo', header: 'Applies to', cell: appliesTo },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (fee) => <span className="tabular">{formatPeso(fee.amount)}</span>,
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (fee) => (
        <div className="flex justify-end gap-1">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setEditing(fee)}
            aria-label={`Edit ${fee.name}`}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="dangerGhost"
            onClick={() => onDelete(fee)}
            disabled={deleteFee.isPending}
            aria-label={`Delete ${fee.name}`}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const addButton = (
    <Button icon={Plus} onClick={createModal.open}>
      Add fee
    </Button>
  );

  return (
    <>
      <PageHeader
        total={data?.meta.total}
        title="Fees"
        description="What students pay each school year, for one grade or for all grades."
        actions={addButton}
      />

      <FilterBar>
        <FeeYearSelect value={academicYear} onChange={setAcademicYear} className="sm:w-48" />
      </FilterBar>

      <DataTable
        label={`Fees of ${schoolYearLabel(academicYear)}`}
        columns={columns}
        rows={fees}
        isLoading={isPending}
        isFetching={isFetching}
        error={error}
        onRetry={refetch}
        emptyState={
          <EmptyState
            icon={Wallet}
            title={`No fees set for ${schoolYearLabel(academicYear)} yet`}
            description="Add what students pay this school year, for one grade or for all grades."
            action={addButton}
          />
        }
      />

      <FeeFormModal open={createModal.isOpen} onClose={createModal.close} academicYear={academicYear} />
      <FeeFormModal
        open={editing !== null}
        onClose={() => setEditing(null)}
        academicYear={academicYear}
        fee={editing}
      />
    </>
  );
}
