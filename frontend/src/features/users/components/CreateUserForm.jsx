import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { FormField, FormRootError } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { PasswordInput } from '../../../components/ui/PasswordInput';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';
import { GENDER_OPTIONS, ROLE_OPTIONS } from '../../../constants/ui';
import { applyServerErrors } from '../../../lib/formErrors';
import { CREATE_USER_FIELDS, CREATE_USER_FIELD_MAP, createUserDefaults, createUserSchema } from '../schemas';

function StudentProfileFields({ register, errors }) {
  const profileErrors = errors.profile ?? {};
  return (
    <fieldset className="space-y-4">
      <legend className="mb-2 text-sm font-semibold text-gray-900">Student record</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Student number"
          hint="Leave empty to auto-generate (format STU-YYYY-NNNN)"
          error={profileErrors.studentNumber?.message}
        >
          <Input {...register('profile.studentNumber')} autoComplete="off" />
        </FormField>
        <FormField label="Admission date" error={profileErrors.admissionDate?.message}>
          <Input {...register('profile.admissionDate')} type="date" />
        </FormField>
        <FormField label="Date of birth" error={profileErrors.dateOfBirth?.message}>
          <Input {...register('profile.dateOfBirth')} type="date" />
        </FormField>
        <FormField label="Gender" error={profileErrors.gender?.message}>
          <Select {...register('profile.gender')} options={GENDER_OPTIONS} placeholder="Not specified" />
        </FormField>
        <FormField label="Guardian name" error={profileErrors.guardianName?.message}>
          <Input {...register('profile.guardianName')} autoComplete="off" />
        </FormField>
        <FormField label="Guardian phone" error={profileErrors.guardianPhone?.message}>
          <Input {...register('profile.guardianPhone')} type="tel" autoComplete="off" />
        </FormField>
      </div>
      <FormField label="Address" error={profileErrors.address?.message}>
        <Textarea {...register('profile.address')} rows={2} autoComplete="off" />
      </FormField>
    </fieldset>
  );
}

function TeacherProfileFields({ register, errors }) {
  const profileErrors = errors.profile ?? {};
  return (
    <fieldset className="space-y-4">
      <legend className="mb-2 text-sm font-semibold text-gray-900">Teacher record</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Employee number"
          hint="Leave empty to auto-generate (format EMP-YYYY-NNNN)"
          error={profileErrors.employeeNumber?.message}
        >
          <Input {...register('profile.employeeNumber')} autoComplete="off" />
        </FormField>
        <FormField label="Hire date" error={profileErrors.hireDate?.message}>
          <Input {...register('profile.hireDate')} type="date" />
        </FormField>
        <FormField label="Department" error={profileErrors.department?.message}>
          <Input {...register('profile.department')} autoComplete="off" />
        </FormField>
        <FormField label="Qualification" error={profileErrors.qualification?.message}>
          <Input {...register('profile.qualification')} autoComplete="off" />
        </FormField>
      </div>
    </fieldset>
  );
}

/**
 * Create form for an account of any role (POST /users). The role decides the record section: student
 * and teacher fields, none for an administrator (the `profile` key is not sent for them).
 * `mutation` is useCreateUser(), owned by the modal so its submit button can show the pending state;
 * `trackDirty(isDirty)` lets the modal ask "Discard changes?" before closing.
 */
export function CreateUserForm({ formId, lockedRole, mutation, onClose, trackDirty }) {
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isDirty },
  } = useForm({ resolver: zodResolver(createUserSchema), defaultValues: createUserDefaults(lockedRole) });
  const role = useWatch({ control, name: 'role' });

  useEffect(() => trackDirty(isDirty), [isDirty, trackDirty]);

  const onSubmit = (values) =>
    mutation
      .mutateAsync(values)
      .then(onClose)
      .catch((error) =>
        applyServerErrors(error, setError, {
          fieldMap: CREATE_USER_FIELD_MAP,
          knownFields: CREATE_USER_FIELDS,
        }),
      );

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <FormRootError error={errors.root?.server} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="First name" error={errors.firstName?.message} required>
          <Input {...register('firstName')} autoComplete="off" />
        </FormField>
        <FormField label="Last name" error={errors.lastName?.message} required>
          <Input {...register('lastName')} autoComplete="off" />
        </FormField>
        <FormField label="Email" error={errors.email?.message} required>
          <Input {...register('email')} type="email" autoComplete="off" />
        </FormField>
        <FormField label="Phone" error={errors.phone?.message}>
          <Input {...register('phone')} type="tel" autoComplete="off" />
        </FormField>
        <FormField
          label="Temporary password"
          hint="The user can change it via Forgot password"
          error={errors.password?.message}
          required
        >
          <PasswordInput {...register('password')} autoComplete="new-password" />
        </FormField>
        <FormField label="Role" error={errors.role?.message} required>
          {lockedRole ? (
            <Select value={lockedRole} options={ROLE_OPTIONS} disabled onChange={() => {}} />
          ) : (
            <Select {...register('role')} options={ROLE_OPTIONS} />
          )}
        </FormField>
      </div>
      {role === 'student' && <StudentProfileFields register={register} errors={errors} />}
      {role === 'teacher' && <TeacherProfileFields register={register} errors={errors} />}
    </form>
  );
}
