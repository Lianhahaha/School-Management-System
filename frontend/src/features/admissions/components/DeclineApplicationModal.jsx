import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '../../../components/ui/Button';
import { FormField, FormRootError } from '../../../components/ui/FormField';
import { Modal } from '../../../components/ui/Modal';
import { Textarea } from '../../../components/ui/Textarea';
import { applyServerErrors } from '../../../lib/formErrors';
import { fullName } from '../../../utils/names';
import { useDeclineAdmission } from '../hooks';
import { declineDefaults, declineSchema } from '../schemas';

const FORM_ID = 'decline-application-form';
const FIELDS = ['reason'];

function DeclineForm({ student, mutation, onClose }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(declineSchema), defaultValues: declineDefaults });

  const onSubmit = ({ reason }) =>
    mutation
      .mutateAsync({ studentId: student.id, reason })
      .then(onClose)
      .catch((error) => applyServerErrors(error, setError, { knownFields: FIELDS }));

  return (
    <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <FormRootError error={errors.root?.server} />
      <FormField
        label="Reason"
        hint="The applicant reads this on their dashboard. Their account stays, so they can sign in."
        error={errors.reason?.message}
        required
      >
        <Textarea
          {...register('reason')}
          rows={3}
          maxLength={255}
          placeholder="Grade 7 is full for this school year. Please apply again in May."
        />
      </FormField>
    </form>
  );
}

/**
 * Decline a pending application with a reason (admin). Closes itself after success; the toast and the
 * list refresh come from useDeclineAdmission. Enrolling the student later still admits them.
 *
 * @param {object} props
 * @param {object|null} props.student the applicant; null while closed
 * @param {() => void} props.onClose
 */
export function DeclineApplicationModal({ student, onClose }) {
  const mutation = useDeclineAdmission();
  return (
    <Modal
      open={Boolean(student)}
      onClose={onClose}
      title="Decline application"
      description={
        student ? `${fullName(student)} applied for Grade ${student.admission.gradeLevel}.` : undefined
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} variant="danger" isLoading={mutation.isPending}>
            Decline
          </Button>
        </>
      }
    >
      {student && <DeclineForm student={student} mutation={mutation} onClose={onClose} />}
    </Modal>
  );
}
