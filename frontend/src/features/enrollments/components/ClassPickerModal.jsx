import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '../../../components/ui/Button';
import { FormField, FormRootError } from '../../../components/ui/FormField';
import { Modal } from '../../../components/ui/Modal';
import { applyServerErrors } from '../../../lib/formErrors';
import { ClassSelect } from '../../classes/components/ClassSelect';
import { classPickDefaults, classPickSchema } from '../schemas';

const FORM_ID = 'class-picker-form';
const FIELDS = ['classId'];

function ClassPickerForm({ student, mutation, onClose, excludeIds }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(classPickSchema), defaultValues: classPickDefaults });

  const onSubmit = (values) =>
    mutation
      .mutateAsync({ studentId: student.id, ...values })
      .then(onClose)
      .catch((error) => applyServerErrors(error, setError, { knownFields: FIELDS }));

  return (
    <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <FormRootError error={errors.root?.server} />
      <FormField label="Class" error={errors.classId?.message} required>
        <ClassSelect {...register('classId')} excludeIds={excludeIds} />
      </FormField>
    </form>
  );
}

/**
 * The modal behind EnrollStudentModal and TransferStudentModal: pick a class for one student and
 * submit. Not used directly by pages. Server errors (already enrolled, same class, ...) show in the
 * form's alert; the success toast comes from the mutation hook.
 *
 * @param {object} props
 * @param {{ id: number }|null} props.student the student row; null while closed
 * @param {boolean} props.open
 * @param {() => void} props.onClose called after success and on cancel
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {string} props.submitLabel
 * @param {{ mutateAsync: Function, isPending: boolean }} props.mutation useEnrollStudent() or useTransferStudent()
 * @param {number[]} [props.excludeIds] classes that cannot be chosen
 */
export function ClassPickerModal({
  student,
  open,
  onClose,
  title,
  description,
  submitLabel,
  mutation,
  excludeIds,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} isLoading={mutation.isPending}>
            {submitLabel}
          </Button>
        </>
      }
    >
      {student && (
        <ClassPickerForm student={student} mutation={mutation} onClose={onClose} excludeIds={excludeIds} />
      )}
    </Modal>
  );
}
