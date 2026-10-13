import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import { FormField, FormRootError } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { PasswordInput } from '../../../components/ui/PasswordInput';
import { RadioTiles } from '../../../components/ui/RadioTiles';
import { Select } from '../../../components/ui/Select';
import { TextLink } from '../../../components/ui/TextLink';
import { Textarea } from '../../../components/ui/Textarea';
import { SCHOOL } from '../../../constants/privacy';
import { PRIVACY_NOTICE_VERSION } from '../../../constants/shared';
import { GENDER_OPTIONS, GRADE_LEVEL_OPTIONS } from '../../../constants/ui';
import { applyServerErrors } from '../../../lib/formErrors';
import { useRegister } from '../hooks';
import { REGISTER_FIELDS, registerDefaults, registerSchema } from '../schemas';

const DETAIL_FIELDS = ['phone', 'dateOfBirth', 'gender', 'address'];

/** The two kinds of account the sign-up page creates (`accountType`), each with what happens next. */
const ACCOUNT_TYPES = [
  {
    value: 'student',
    label: 'Student',
    description: 'Apply and pick your class right after signing up.',
  },
  {
    value: 'assistant',
    label: 'Student assistant',
    description: 'Help the school office. An admin or a student assistant approves your request first.',
  },
];

const SUBMIT_LABELS = { student: 'Create account and pick a class', assistant: 'Send request' };

/** The application of a student: the grade applied for, the LRN, the previous school and the guardian. */
function ApplicationFields({ register, errors }) {
  return (
    <section aria-labelledby="register-application" className="space-y-4 border-t border-gray-200 pt-5">
      <div>
        <h2 id="register-application" className="text-base font-semibold text-gray-900">
          Application
        </h2>
        <p className="text-sm text-gray-600">You pick a class of this grade right after signing up.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Grade applying for" error={errors.gradeLevel?.message} required>
          <Select {...register('gradeLevel')} options={GRADE_LEVEL_OPTIONS} placeholder="Choose a grade" />
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
  );
}

/** A student's optional details, folded; a collapsed section must not hide an error, so one opens it. */
function MoreAboutYou({ register, errors }) {
  const hasErrors = DETAIL_FIELDS.some((field) => errors[field]);
  return (
    <details open={hasErrors} className="rounded-tile bg-gray-50 px-4 py-3">
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
  );
}

/**
 * The short notice at the moment of collection (NPC Circular 2023-04) and the consent box, unticked: the
 * law accepts only a clear act of agreeing. The full notice opens in a new tab so the form keeps its input.
 */
function PrivacyConsent({ register, errors }) {
  return (
    <div className="space-y-3 border-t border-gray-200 pt-5">
      <p className="text-sm text-gray-700">
        {SCHOOL.name} uses what you enter to run your account and, once you are enrolled, your school records:
        class, attendance and grades. Your teachers and the school office see them; other students do not.
        They are stored with Google, Render and Aiven, partly outside the Philippines. You can see, correct or
        ask to delete them.{' '}
        <TextLink to="/privacy" target="_blank" rel="noreferrer">
          Read the Privacy Notice
        </TextLink>
      </p>
      <Checkbox
        {...register('privacyConsent')}
        label="I have read the Privacy Notice and agree to the school using my information as it explains."
      />
      {errors.privacyConsent && (
        <p role="alert" className="text-xs text-red-600">
          {errors.privacyConsent.message}
        </p>
      )}
    </div>
  );
}

/**
 * Self-registration, as a student or as a student assistant (the choice at the top):
 *   student    the account fields, an "Application" section (grade applied for, LRN, previous school and
 *              guardian) and an optional, collapsible "More about you"; afterwards the student picks a class
 *              on their dashboard
 *   assistant  the account fields and an optional phone; afterwards the account waits for the school office
 *              (app/guards/RequireAuth shows the waiting screen)
 */
export function RegisterForm() {
  const registration = useRegister();
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(registerSchema), defaultValues: registerDefaults });
  const accountType = useWatch({ control, name: 'accountType' });
  const isAssistant = accountType === 'assistant';

  // confirmPassword and privacyConsent exist only in the form; the endpoint rejects unknown fields and
  // records the version of the notice that was agreed to.
  const onSubmit = ({ confirmPassword: _confirmPassword, privacyConsent: _privacyConsent, ...body }) =>
    registration
      .mutateAsync({ ...body, privacyNoticeVersion: PRIVACY_NOTICE_VERSION })
      .catch((error) => applyServerErrors(error, setError, { knownFields: REGISTER_FIELDS }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <fieldset disabled={registration.isPending} className="space-y-4">
        <FormRootError error={errors.root?.server} />

        <RadioTiles legend="I'm signing up as" options={ACCOUNT_TYPES} {...register('accountType')} />

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

        {isAssistant ? (
          <>
            <FormField label="Phone" hint="Optional." error={errors.phone?.message}>
              <Input {...register('phone')} type="tel" autoComplete="tel" />
            </FormField>
            <Alert tone="info">The school office will review your request and email you.</Alert>
          </>
        ) : (
          <>
            <ApplicationFields register={register} errors={errors} />
            <MoreAboutYou register={register} errors={errors} />
          </>
        )}

        <PrivacyConsent register={register} errors={errors} />

        <Button type="submit" isLoading={registration.isPending} className="w-full">
          {SUBMIT_LABELS[accountType] ?? SUBMIT_LABELS.student}
        </Button>
      </fieldset>
    </form>
  );
}
