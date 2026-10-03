import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '../../../components/ui/Button';
import { FormField, FormRootError } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';
import { GENDER_OPTIONS } from '../../../constants/ui';
import { applyServerErrors } from '../../../lib/formErrors';
import { useRegister } from '../hooks';
import { registerDefaults, registerSchema } from '../schemas';

const KNOWN_FIELDS = Object.keys(registerSchema.shape);
const DETAIL_FIELDS = ['phone', 'dateOfBirth', 'gender', 'address', 'guardianName', 'guardianPhone'];

/** Student self-registration: account fields plus an optional, collapsible "Student details" section. */
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
          <Input {...register('password')} type="password" autoComplete="new-password" />
        </FormField>
        <FormField label="Confirm password" error={errors.confirmPassword?.message} required>
          <Input {...register('confirmPassword')} type="password" autoComplete="new-password" />
        </FormField>

        <details open={hasDetailErrors} className="rounded-lg border border-gray-200 px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-gray-700">
            Student details (optional)
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
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Guardian name" error={errors.guardianName?.message}>
                <Input {...register('guardianName')} />
              </FormField>
              <FormField label="Guardian phone" error={errors.guardianPhone?.message}>
                <Input {...register('guardianPhone')} type="tel" />
              </FormField>
            </div>
          </div>
        </details>

        <Button type="submit" isLoading={registration.isPending} className="w-full">
          Create account
        </Button>
      </fieldset>
    </form>
  );
}
