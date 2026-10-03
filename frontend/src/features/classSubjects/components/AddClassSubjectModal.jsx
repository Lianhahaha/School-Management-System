import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '../../../components/ui/Button';
import { FormField, FormRootError } from '../../../components/ui/FormField';
import { Modal } from '../../../components/ui/Modal';
import { applyServerErrors } from '../../../lib/formErrors';
import { SubjectSelect } from '../../subjects/components/SubjectSelect';
import { TeacherSelect } from '../../teachers/components/TeacherSelect';
import { useCreateClassSubject } from '../hooks';
import { addClassSubjectSchema, classSubjectDefaults } from '../schemas';

const FORM_ID = 'add-class-subject-form';
const FIELDS = ['subjectId', 'teacherId'];

function AddClassSubjectForm({ classId, excludeSubjectIds, mutation, onClose }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(addClassSubjectSchema), defaultValues: classSubjectDefaults() });

  const onSubmit = (values) =>
    mutation
      .mutateAsync({ classId, ...values })
      .then(onClose)
      .catch((error) => applyServerErrors(error, setError, { knownFields: FIELDS }));

  return (
    <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <FormRootError error={errors.root?.server} />
      <FormField label="Subject" error={errors.subjectId?.message} required>
        <SubjectSelect {...register('subjectId')} excludeIds={excludeSubjectIds} />
      </FormField>
      <FormField label="Teacher" error={errors.teacherId?.message} required>
        <TeacherSelect {...register('teacherId')} />
      </FormField>
    </form>
  );
}

/**
 * Add a subject to a class together with the teacher who teaches it (POST /class-subjects): a
 * class-subject is the teacher assignment, so there is no subject without a teacher. Admin only.
 * Subjects the class already has are not offered; retired subjects never are.
 *
 * @param {object} props
 * @param {number} props.classId
 * @param {string} [props.className] shown in the description
 * @param {number[]} [props.excludeSubjectIds] subject ids the class already has
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 */
export function AddClassSubjectModal({ classId, className, excludeSubjectIds = [], open, onClose }) {
  const mutation = useCreateClassSubject();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add subject"
      description={className ? `Choose a subject for ${className} and who teaches it.` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} isLoading={mutation.isPending}>
            Add subject
          </Button>
        </>
      }
    >
      <AddClassSubjectForm
        classId={classId}
        excludeSubjectIds={excludeSubjectIds}
        mutation={mutation}
        onClose={onClose}
      />
    </Modal>
  );
}
