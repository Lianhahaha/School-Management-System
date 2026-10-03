import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '../../../components/ui/Button';
import { FormField, FormRootError } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';
import { GENDER_OPTIONS } from '../../../constants/ui';
import { useUnsavedChangesBlocker } from '../../../hooks/useUnsavedChangesBlocker';
import { applyServerErrors } from '../../../lib/formErrors';
import { changedFields } from '../../../utils/forms';
import { useUpdateStudent } from '../hooks';
import { studentDefaults, updateStudentSchema } from '../schemas';

const FIELDS = Object.keys(updateStudentSchema.shape);

/** Edit form of a student's profile (PATCH /students/:id): sends only the fields that changed. */
export function StudentProfileForm({ student }) {
  const updateStudent = useUpdateStudent();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, dirtyFields, isDirty },
  } = useForm({ resolver: zodResolver(updateStudentSchema), defaultValues: studentDefaults(student) });
  useUnsavedChangesBlocker(isDirty);

  const onSubmit = (values) =>
    updateStudent
      .mutateAsync({ id: student.id, body: changedFields(values, dirtyFields) })
      .then((updated) => reset(studentDefaults(updated)))
      .catch((error) => applyServerErrors(error, setError, { knownFields: FIELDS }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4" aria-label="Student profile">
      <FormRootError error={errors.root?.server} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="First name" error={errors.firstName?.message} required>
          <Input {...register('firstName')} autoComplete="off" />
        </FormField>
        <FormField label="Last name" error={errors.lastName?.message} required>
          <Input {...register('lastName')} autoComplete="off" />
        </FormField>
        <FormField label="Email" hint="Email can't be changed.">
          <Input value={student.email} readOnly />
        </FormField>
        <FormField label="Phone" error={errors.phone?.message}>
          <Input {...register('phone')} type="tel" autoComplete="off" />
        </FormField>
        <FormField label="Student number" error={errors.studentNumber?.message} required>
          <Input {...register('studentNumber')} autoComplete="off" />
        </FormField>
        <FormField label="Admission date" error={errors.admissionDate?.message} required>
          <Input {...register('admissionDate')} type="date" />
        </FormField>
        <FormField label="Date of birth" error={errors.dateOfBirth?.message}>
          <Input {...register('dateOfBirth')} type="date" />
        </FormField>
        <FormField label="Gender" error={errors.gender?.message}>
          <Select {...register('gender')} options={GENDER_OPTIONS} placeholder="Not specified" />
        </FormField>
        <FormField label="Guardian name" error={errors.guardianName?.message}>
          <Input {...register('guardianName')} autoComplete="off" />
        </FormField>
        <FormField label="Guardian phone" error={errors.guardianPhone?.message}>
          <Input {...register('guardianPhone')} type="tel" autoComplete="off" />
        </FormField>
      </div>
      <FormField label="Address" error={errors.address?.message}>
        <Textarea {...register('address')} rows={2} autoComplete="off" />
      </FormField>
      <div className="flex gap-3">
        <Button type="submit" isLoading={updateStudent.isPending} disabled={!isDirty}>
          Save changes
        </Button>
        <Button variant="ghost" disabled={!isDirty} onClick={() => reset(studentDefaults(student))}>
          Discard changes
        </Button>
      </div>
    </form>
  );
}
