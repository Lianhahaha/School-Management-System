import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '../../../components/ui/Button';
import { FormField, FormRootError } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { PasswordInput } from '../../../components/ui/PasswordInput';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';
import { GENDER_OPTIONS, GRADE_LEVEL_OPTIONS } from '../../../constants/ui';
import { applyServerErrors } from '../../../lib/formErrors';
import { useRegister } from '../hooks';
import { registerDefaults, registerSchema } from '../schemas';

const KNOWN_FIELDS = Object.keys(registerSchema.shape);
const DETAIL_FIELDS = ['phone', 'dateOfBirth', 'gender', 'address'];

/**
 * Student self-registration, which is also the application to the school: the account fields, an
 * "Application" section (grade applied for, previous school, LRN and guardian) and an optional, collapsible
 * "More about you" section.
 */
export function RegisterForm() {
  const registration = useRegister();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(registerSchema), defaultValues: registerDefaults });

  // confirmPassword exists only in the form; the endpoint rejects unknown fields.
  const onSubmit = ({ confirmPassword: _confirmPassword, ...body }) =>
    registration
      .mutateAsync(body)
      .catch((error) => applyServerErrors(error, setError, { knownFields: KNOWN_FIELDS }));

  // A collapsed section must not hide an error: open it as soon as one of its fields has one.
  const hasDetailErrors = DETAIL_FIELDS.some((field) => errors[field]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <fieldset disabled={registration.isPending} className="space-y-4">
        <FormRootError error={errors.root?.server} />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="First name" error={errors.firstName?.message} required>
            <Input {...register('firstName')} autoComplete="given-name" />
          </FormField>
          <FormField label="Last name" error={errors.lastName?.message} required>
            <Input {...register('lastName')} autoComplete="family-name" />
          </FormField>
        </div>
        <FormField label="Email" error={errors.email?.message} required>
          <Input {...register('email')} type="email" autoComplete="email" />
        </FormField>
        <FormField label="Password" hint="At least 8 characters." error={errors.password?.message} required>
          <PasswordInput {...register('password')} autoComplete="new-password" />
        </FormField>
        <FormField label="Confirm password" error={errors.confirmPassword?.message} required>
          <PasswordInput {...register('confirmPassword')} autoComplete="new-password" />
        </FormField>

        <section aria-labelledby="register-application" className="space-y-4 border-t border-gray-200 pt-5">
          <div>
            <h2 id="register-application" className="text-base font-semibold text-gray-900">
              Application
            </h2>
            <p className="text-sm text-gray-600">The school office checks it and places you in a class.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Grade applying for" error={errors.gradeLevel?.message} required>
              <Select
                {...register('gradeLevel')}
                options={GRADE_LEVEL_OPTIONS}
                placeholder="Choose a grade"
              />
            </FormField>
            <FormField label="LRN" hint="12 digits, if you have one." error={errors.lrn?.message}>
              <Input {...register('lrn')} inputMode="numeric" autoComplete="off" />
            </FormField>
          </div>
          <FormField label="Previous school" hint="Optional." error={errors.previousSchool?.message}>
            <Input {...register('previousSchool')} maxLength={150} autoComplete="off" />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Guardian name" error={errors.guardianName?.message} required>
              <Input {...register('guardianName')} autoComplete="off" />
            </FormField>
            <FormField label="Guardian phone" error={errors.guardianPhone?.message} required>
              <Input {...register('guardianPhone')} type="tel" autoComplete="off" />
            </FormField>
          </div>
        </section>

        <details open={hasDetailErrors} className="rounded-[1.25rem] bg-gray-50 px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-gray-700">
            More about you (optional)
          </summary>
          <div className="mt-4 space-y-4">
            <FormField label="Phone" error={errors.phone?.message}>
              <Input {...register('phone')} type="tel" autoComplete="tel" />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Date of birth" error={errors.dateOfBirth?.message}>
                <Input {...register('dateOfBirth')} type="date" autoComplete="bday" />
              </FormField>
              <FormField label="Gender" error={errors.gender?.message}>
                <Select {...register('gender')} options={GENDER_OPTIONS} placeholder="Prefer not to say" />
              </FormField>
            </div>
            <FormField label="Address" error={errors.address?.message}>
              <Textarea {...register('address')} rows={2} autoComplete="street-address" />
            </FormField>
          </div>
        </details>

        <Button type="submit" isLoading={registration.isPending} className="w-full">
          Create account and apply
        </Button>
      </fieldset>
    </form>
  );
}
