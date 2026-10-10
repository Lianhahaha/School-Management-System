import { Banknote, CircleAlert, CircleCheck, Plus, Receipt, Wallet } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { DataTable } from '../../../components/ui/DataTable';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { StatTile } from '../../../components/ui/StatTile';
import { PAYMENT_METHOD_LABELS } from '../../../constants/ui';
import { useConfirm } from '../../../hooks/useConfirm';
import { useDisclosure } from '../../../hooks/useDisclosure';
import { formatDate } from '../../../utils/date';
import { countOf, formatPeso } from '../../../utils/format';
import { useDeletePayment, useFeeStatement } from '../hooks';
import { RecordPaymentModal } from './RecordPaymentModal';

const amountCell = (row) => <span className="tabular">{formatPeso(row.amount)}</span>;

const FEE_COLUMNS = [
  { key: 'name', header: 'Fee' },
  { key: 'amount', header: 'Amount', align: 'right', cell: amountCell },
];

const PAYMENT_COLUMNS = [
  { key: 'paidOn', header: 'Date', cell: (payment) => formatDate(payment.paidOn) },
  { key: 'receiptNumber', header: 'OR number' },
  { key: 'method', header: 'Method', cell: (payment) => PAYMENT_METHOD_LABELS[payment.method] },
  { key: 'amount', header: 'Amount', align: 'right', primary: true, cell: amountCell },
  { key: 'note', header: 'Note', hideBelow: 'md', cell: (payment) => payment.note ?? '—' },
];

/** What is left to pay (needs attention), nothing (all is well), or how much was paid on top of the fees. */
function BalanceTile({ balance, totalFees }) {
  if (balance > 0) {
    return (
      <StatTile
        label="Balance"
        value={formatPeso(balance)}
        hint="Still to pay"
        icon={CircleAlert}
        mark="oxblood"
      />
    );
  }
  if (balance < 0) {
    return (
      <StatTile label="Overpaid" value={formatPeso(-balance)} hint="Paid more than the fees" icon={Wallet} />
    );
  }
  return (
    <StatTile
      label="Balance"
      value={formatPeso(0)}
      hint={totalFees > 0 ? 'Paid in full' : 'Nothing to pay'}
      icon={CircleCheck}
      mark="sage"
    />
  );
}

/** Why these fees: the class's grade plus the every-grade fees, or the every-grade fees alone. */
function describeClass(schoolClass) {
  return schoolClass
    ? `${schoolClass.name}: the Grade ${schoolClass.gradeLevel} fees and the fees for all grades.`
    : 'Not in a class this school year, so only the fees for all grades apply.';
}

/**
 * A student's fees for one school year: the totals (fees, paid, balance), the fees that apply and the
 * payments, latest first. With `canManage` (admins) a payment can be recorded, and one recorded by mistake
 * removed (payments are never edited).
 *
 * @param {object} props
 * @param {number|'me'} props.studentId
 * @param {string} props.academicYear
 * @param {boolean} [props.canManage]
 */
export function FeeStatement({ studentId, academicYear, canManage = false }) {
  const statement = useFeeStatement({ studentId, academicYear });
  const deletePayment = useDeletePayment();
  const paymentModal = useDisclosure();
  const confirm = useConfirm();

  if (statement.error && !statement.data) {
    return (
      <ErrorState
        title="Couldn't load the fees"
        message={statement.error.message}
        onRetry={statement.refetch}
      />
    );
  }
  if (statement.isPending) {
    return (
      <div className="space-y-6">
        <div className="grid gap-2 sm:gap-4 md:grid-cols-3">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const { data } = statement;

  const removePayment = async (payment) => {
    const ok = await confirm({
      title: `Remove the payment of ${formatPeso(payment.amount)}?`,
      description: `OR ${payment.receiptNumber}, paid ${formatDate(payment.paidOn)}. The balance goes up by this amount. If it was entered wrong, record it again.`,
      confirmLabel: 'Remove payment',
    });
    if (ok) deletePayment.mutate(payment.id);
  };

  const paymentColumns = canManage
    ? [
        ...PAYMENT_COLUMNS,
        {
          key: 'actions',
          header: <span className="sr-only">Actions</span>,
          align: 'right',
          cell: (payment) => (
            <Button
              size="sm"
              variant="dangerGhost"
              onClick={() => removePayment(payment)}
              disabled={deletePayment.isPending}
              aria-label={`Remove the payment with OR ${payment.receiptNumber}`}
            >
              Remove
            </Button>
          ),
        },
      ]
    : PAYMENT_COLUMNS;

  return (
    <div className="space-y-6">
      <div className="grid gap-2 sm:gap-4 md:grid-cols-3">
        <StatTile
          label="Total fees"
          value={formatPeso(data.totalFees)}
          hint={countOf(data.fees.length, 'fee')}
          icon={Receipt}
        />
        <StatTile
          label="Paid"
          value={formatPeso(data.totalPaid)}
          hint={countOf(data.payments.length, 'payment')}
          icon={Banknote}
        />
        <BalanceTile balance={data.balance} totalFees={data.totalFees} />
      </div>

      <Card title="Fees" total={data.fees.length} description={describeClass(data.class)} padded={false}>
        <DataTable
          label="Fees"
          columns={FEE_COLUMNS}
          rows={data.fees}
          isFetching={statement.isFetching}
          emptyState={<EmptyState icon={Receipt} title="No fees set for this school year" />}
        />
      </Card>

      <Card
        title="Payments"
        total={data.payments.length}
        padded={false}
        actions={
          canManage && (
            <Button size="sm" variant="secondary" icon={Plus} onClick={paymentModal.open}>
              Record payment
            </Button>
          )
        }
      >
        <DataTable
          label="Payments"
          columns={paymentColumns}
          rows={data.payments}
          isFetching={statement.isFetching}
          emptyState={<EmptyState icon={Banknote} title="No payments recorded yet" />}
        />
      </Card>

      {canManage && (
        <RecordPaymentModal
          open={paymentModal.isOpen}
          onClose={paymentModal.close}
          studentId={data.studentId}
          academicYear={academicYear}
        />
      )}
    </div>
  );
}
