import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '../../../components/ui/Button';
import { FormField, FormRootError } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { GRADE_LEVEL_OPTIONS } from '../../../constants/ui';
import { useDiscardConfirm } from '../../../hooks/useDiscardConfirm';
import { applyServerErrors } from '../../../lib/formErrors';
import { changedFields } from '../../../utils/forms';
import { TeacherSelect } from '../../teachers/components/TeacherSelect';
import { useCreateClass, useUpdateClass } from '../hooks';
import { classDefaults, createClassSchema, updateClassSchema } from '../schemas';

const FORM_ID = 'class-form';
const FIELDS = ['name', 'gradeLevel', 'academicYear', 'homeroomTeacherId'];

function ClassForm({ schoolClass, mutation, onClose, trackDirty }) {
  const isEdit = Boolean(schoolClass);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, dirtyFields, isDirty },
  } = useForm({
    resolver: zodResolver(isEdit ? updateClassSchema : createClassSchema),
    defaultValues: classDefaults(schoolClass),
  });

  useEffect(() => trackDirty(isDirty), [isDirty, trackDirty]);

  const onSubmit = (values) => {
    if (isEdit && !isDirty) return onClose(); // nothing to send
    const request = isEdit
      ? mutation.mutateAsync({ id: schoolClass.id, body: changedFields(values, dirtyFields) })
      : mutation.mutateAsync(values);
    return request
      .then(onClose)
      .catch((error) => applyServerErrors(error, setError, { knownFields: FIELDS }));
  };

  return (
    <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <FormRootError error={errors.root?.server} />
      <FormField
        label="Name"
        hint='The name carries the stream, for example "Grade 10 - A".'
        error={errors.name?.message}
        required
      >
        <Input {...register('name')} maxLength={50} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Grade level" error={errors.gradeLevel?.message} required>
          <Select {...register('gradeLevel')} options={GRADE_LEVEL_OPTIONS} placeholder="Choose a grade" />
        </FormField>
        <FormField label="Academic year" error={errors.academicYear?.message} required>
          <Input {...register('academicYear')} placeholder="2026-2027" inputMode="numeric" />
        </FormField>
      </div>
      <FormField label="Homeroom teacher" hint="Optional." error={errors.homeroomTeacherId?.message}>
        <TeacherSelect {...register('homeroomTeacherId')} placeholder="No homeroom teacher" />
      </FormField>
    </form>
  );
}

/**
 * Create or edit a class (admin). Pass `schoolClass` to edit it; without it the modal creates a class.
 * Closes itself after a successful save (the toast and list refresh come from the hooks); a dirty
 * form asks "Discard changes?" before closing.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {object|null} [props.schoolClass] the class row to edit
 */
export function ClassFormModal({ open, onClose, schoolClass = null }) {
  const createClass = useCreateClass();
  const updateClass = useUpdateClass();
  const { requestClose, trackDirty } = useDiscardConfirm(onClose);
  const isEdit = Boolean(schoolClass);
  const mutation = isEdit ? updateClass : createClass;

  return (
    <Modal
      open={open}
      onClose={requestClose}
      title={isEdit ? 'Edit class' : 'Create class'}
      footer={
        <>
          <Button variant="secondary" onClick={requestClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} isLoading={mutation.isPending}>
            {isEdit ? 'Save changes' : 'Create class'}
          </Button>
        </>
      }
    >
      <ClassForm schoolClass={schoolClass} mutation={mutation} onClose={onClose} trackDirty={trackDirty} />
    </Modal>
  );
}
