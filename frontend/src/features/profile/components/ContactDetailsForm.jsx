import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '../../../components/ui/Button';
import { FormField, FormRootError } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Textarea } from '../../../components/ui/Textarea';
import { applyServerErrors } from '../../../lib/formErrors';
import { useUpdateMe } from '../../auth/hooks';
import { contactDefaults, contactSchema } from '../../auth/schemas';

const STUDENT_FIELDS = ['phone', 'address', 'guardianName', 'guardianPhone'];
const OTHER_FIELDS = ['phone'];

/**
 * Editable contact details, saved with PATCH /auth/me. Everybody can edit a phone number; students
 * also their address and guardian details. Only the fields the user changed are sent, and the button
 * stays disabled until something changed.
 */
export function ContactDetailsForm({ me }) {
  const isStudent = me.role === 'student';
  const renderedFields = isStudent ? STUDENT_FIELDS : OTHER_FIELDS;
  const updateMe = useUpdateMe();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, dirtyFields, isDirty },
  } = useForm({ resolver: zodResolver(contactSchema), defaultValues: contactDefaults(me) });

  const onSubmit = (values) => {
    const patch = Object.fromEntries(Object.keys(dirtyFields).map((field) => [field, values[field]]));
    return updateMe
      .mutateAsync(patch)
      .then((account) => reset(contactDefaults(account)))
      .catch((error) => applyServerErrors(error, setError, { knownFields: renderedFields }));
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <FormRootError error={errors.root?.server} />
      <FormField label="Phone" error={errors.phone?.message}>
        <Input {...register('phone')} type="tel" autoComplete="tel" />
      </FormField>
      {isStudent && (
        <>
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
        </>
      )}
      <Button type="submit" isLoading={updateMe.isPending} disabled={!isDirty}>
        Save changes
      </Button>
    </form>
  );
}
