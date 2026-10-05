import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '../../../components/ui/Button';
import { FormField, FormRootError } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { useUnsavedChangesBlocker } from '../../../hooks/useUnsavedChangesBlocker';
import { applyServerErrors } from '../../../lib/formErrors';
import { changedFields } from '../../../utils/forms';
import { useUpdateTeacher } from '../hooks';
import { teacherDefaults, updateTeacherSchema } from '../schemas';

const FIELDS = Object.keys(updateTeacherSchema.shape);

/** Edit form of a teacher's profile (PATCH /teachers/:id): sends only the fields that changed. */
export function TeacherProfileForm({ teacher }) {
  const updateTeacher = useUpdateTeacher();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, dirtyFields, isDirty },
  } = useForm({ resolver: zodResolver(updateTeacherSchema), defaultValues: teacherDefaults(teacher) });
  useUnsavedChangesBlocker(isDirty, { includeSearch: true }); // another tab (?tab=) unmounts the form

  const onSubmit = (values) =>
    updateTeacher
      .mutateAsync({ id: teacher.id, body: changedFields(values, dirtyFields) })
      .then((updated) => reset(teacherDefaults(updated)))
      .catch((error) => applyServerErrors(error, setError, { knownFields: FIELDS }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4" aria-label="Teacher profile">
      <FormRootError error={errors.root?.server} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="First name" error={errors.firstName?.message} required>
          <Input {...register('firstName')} autoComplete="off" />
        </FormField>
        <FormField label="Last name" error={errors.lastName?.message} required>
          <Input {...register('lastName')} autoComplete="off" />
        </FormField>
        <FormField label="Email" hint="Email can't be changed.">
          <Input value={teacher.email} readOnly />
        </FormField>
        <FormField label="Phone" error={errors.phone?.message}>
          <Input {...register('phone')} type="tel" autoComplete="off" />
        </FormField>
        <FormField label="Employee number" error={errors.employeeNumber?.message} required>
          <Input {...register('employeeNumber')} autoComplete="off" />
        </FormField>
        <FormField label="Hire date" error={errors.hireDate?.message} required>
          <Input {...register('hireDate')} type="date" />
        </FormField>
        <FormField label="Department" error={errors.department?.message}>
          <Input {...register('department')} autoComplete="off" />
        </FormField>
        <FormField label="Qualification" error={errors.qualification?.message}>
          <Input {...register('qualification')} autoComplete="off" />
        </FormField>
      </div>
      <div className="flex gap-3">
        <Button type="submit" isLoading={updateTeacher.isPending} disabled={!isDirty}>
          Save changes
        </Button>
        <Button variant="ghost" disabled={!isDirty} onClick={() => reset(teacherDefaults(teacher))}>
          Discard changes
        </Button>
      </div>
    </form>
  );
}
