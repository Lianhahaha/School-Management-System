import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '../../../components/ui/Button';
import { FormField, FormRootError } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { PAYMENT_METHOD_OPTIONS } from '../../../constants/ui';
import { useDiscardConfirm } from '../../../hooks/useDiscardConfirm';
import { applyServerErrors } from '../../../lib/formErrors';
import { todayYmd } from '../../../utils/date';
import { schoolYearLabel } from '../../enrollments/schoolYears';
import { useRecordPayment } from '../hooks';
import { paymentDefaults, paymentSchema } from '../schemas';

const FORM_ID = 'payment-form';
const FIELDS = ['amount', 'paidOn', 'method', 'receiptNumber', 'note'];

function PaymentForm({ studentId, academicYear, mutation, onClose, trackDirty }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm({ resolver: zodResolver(paymentSchema), defaultValues: paymentDefaults() });

  useEffect(() => trackDirty(isDirty), [isDirty, trackDirty]);

  const onSubmit = (values) =>
    mutation
      .mutateAsync({ studentId, academicYear, ...values })
      .then(onClose)
      .catch((error) => applyServerErrors(error, setError, { knownFields: FIELDS }));

  return (
    <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <FormRootError error={errors.root?.server} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Amount (₱)" error={errors.amount?.message} required>
          <Input
            {...register('amount')}
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            className="tabular"
          />
        </FormField>
        <FormField label="Paid on" error={errors.paidOn?.message} required>
          <Input {...register('paidOn')} type="date" max={todayYmd()} />
        </FormField>
        <FormField label="Method" error={errors.method?.message} required>
          <Select {...register('method')} options={PAYMENT_METHOD_OPTIONS} />
        </FormField>
        <FormField
          label="OR number"
          hint="The official receipt."
          error={errors.receiptNumber?.message}
          required
        >
          <Input {...register('receiptNumber')} maxLength={30} autoComplete="off" />
        </FormField>
      </div>
      <FormField label="Note" hint="Optional." error={errors.note?.message}>
        <Input {...register('note')} maxLength={255} autoComplete="off" />
      </FormField>
    </form>
  );
}

/**
 * Records what a student paid towards one school year's fees (admin), with the official receipt (OR)
 * number. A payment cannot be edited afterwards, only removed, so a dirty form asks before closing.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {number} props.studentId
 * @param {string} props.academicYear
 */
export function RecordPaymentModal({ open, onClose, studentId, academicYear }) {
  const recordPayment = useRecordPayment();
  const { requestClose, trackDirty } = useDiscardConfirm(onClose);

  return (
    <Modal
      open={open}
      onClose={requestClose}
      title="Record payment"
      description={`Towards the fees of ${schoolYearLabel(academicYear)}`}
      footer={
        <>
          <Button variant="secondary" onClick={requestClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} isLoading={recordPayment.isPending}>
            Record payment
          </Button>
        </>
      }
    >
      <PaymentForm
        studentId={studentId}
        academicYear={academicYear}
        mutation={recordPayment}
        onClose={onClose}
        trackDirty={trackDirty}
      />
    </Modal>
  );
}
