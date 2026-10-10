import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '../../../components/ui/Button';
import { FormField, FormRootError } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { GRADE_LEVEL_OPTIONS } from '../../../constants/ui';
import { applyServerErrors } from '../../../lib/formErrors';
import { changedFields } from '../../../utils/forms';
import { schoolYearLabel } from '../../enrollments/schoolYears';
import { useCreateFee, useUpdateFee } from '../hooks';
import { feeDefaults, feeSchema } from '../schemas';

const FORM_ID = 'fee-form';
const FIELDS = ['name', 'gradeLevel', 'amount'];

function FeeForm({ fee, academicYear, mutation, onClose }) {
  const isEdit = Boolean(fee);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, dirtyFields, isDirty },
  } = useForm({ resolver: zodResolver(feeSchema), defaultValues: feeDefaults(fee) });

  const onSubmit = (values) => {
    if (isEdit && !isDirty) return onClose();
    const request = isEdit
      ? mutation.mutateAsync({ id: fee.id, body: changedFields(values, dirtyFields) })
      : mutation.mutateAsync({ academicYear, ...values });
    return request
      .then(onClose)
      .catch((error) => applyServerErrors(error, setError, { knownFields: FIELDS }));
  };

  return (
    <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <FormRootError error={errors.root?.server} />
      <FormField label="Name" error={errors.name?.message} required>
        <Input {...register('name')} maxLength={100} placeholder="Tuition" autoComplete="off" />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Applies to" error={errors.gradeLevel?.message}>
          <Select {...register('gradeLevel')} options={GRADE_LEVEL_OPTIONS} placeholder="All grades" />
        </FormField>
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
      </div>
    </form>
  );
}

/**
 * Add or edit a fee of one school year (admin): its name, the grade it applies to (or every grade) and
 * the amount. A name already used for the same grade that year shows under the field.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} props.academicYear the school year a new fee belongs to
 * @param {object|null} [props.fee] the fee to edit
 */
export function FeeFormModal({ open, onClose, academicYear, fee = null }) {
  const createFee = useCreateFee();
  const updateFee = useUpdateFee();
  const isEdit = Boolean(fee);
  const mutation = isEdit ? updateFee : createFee;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit fee' : 'Add fee'}
      description={schoolYearLabel(fee?.academicYear ?? academicYear)}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} isLoading={mutation.isPending}>
            {isEdit ? 'Save changes' : 'Add fee'}
          </Button>
        </>
      }
    >
      <FeeForm fee={fee} academicYear={academicYear} mutation={mutation} onClose={onClose} />
    </Modal>
  );
}
