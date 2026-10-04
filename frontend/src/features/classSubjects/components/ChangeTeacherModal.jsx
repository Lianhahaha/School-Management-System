import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '../../../components/ui/Button';
import { FormField, FormRootError } from '../../../components/ui/FormField';
import { Modal } from '../../../components/ui/Modal';
import { ERROR_CODES } from '../../../constants/shared';
import { applyServerErrors } from '../../../lib/formErrors';
import { ScheduleConflictList } from '../../schedules/components/ScheduleConflictList';
import { TeacherSelect } from '../../teachers/components/TeacherSelect';
import { useReassignClassSubject } from '../hooks';
import { classSubjectDefaults, reassignClassSubjectSchema } from '../schemas';

const FORM_ID = 'change-teacher-form';

function ChangeTeacherForm({ classSubject, mutation, onClose }) {
  const [conflicts, setConflicts] = useState(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(reassignClassSubjectSchema),
    defaultValues: classSubjectDefaults(classSubject),
  });

  const onSubmit = ({ teacherId }) => {
    if (teacherId === classSubject.teacherId) return onClose(); // same teacher: nothing to change
    setConflicts(null);
    return mutation
      .mutateAsync({ id: classSubject.id, teacherId })
      .then(onClose)
      .catch((error) => {
        if (error?.code === ERROR_CODES.SCHEDULE_CONFLICT) {
          setConflicts(error.details?.conflicts ?? []);
          return;
        }
        applyServerErrors(error, setError, { knownFields: ['teacherId'] });
      });
  };

  return (
    <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <FormRootError error={errors.root?.server} />
      {conflicts && (
        <ScheduleConflictList message="This teacher already teaches at these times" conflicts={conflicts} />
      )}
      <FormField
        label="Teacher"
        hint="Attendance and grades recorded so far stay with the subject."
        error={errors.teacherId?.message}
        required
      >
        <TeacherSelect {...register('teacherId')} />
      </FormField>
    </form>
  );
}

/**
 * Change who teaches a subject of a class (PATCH /class-subjects/:id). Admin only.
 *
 * @param {object} props
 * @param {object|null} props.classSubject the class-subject row; null while closed
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 */
export function ChangeTeacherModal({ classSubject, open, onClose }) {
  const mutation = useReassignClassSubject();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change teacher"
      description={
        classSubject ? `Who teaches ${classSubject.subjectName} in ${classSubject.className}?` : undefined
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} isLoading={mutation.isPending}>
            Change teacher
          </Button>
        </>
      }
    >
      {classSubject && (
        <ChangeTeacherForm classSubject={classSubject} mutation={mutation} onClose={onClose} />
      )}
    </Modal>
  );
}
