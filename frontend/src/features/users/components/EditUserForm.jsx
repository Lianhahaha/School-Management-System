import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { FormField, FormRootError } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { applyServerErrors } from '../../../lib/formErrors';
import { changedFields } from '../../../utils/forms';
import { roleLabel } from '../../../utils/roles';
import { useUpdateUser } from '../hooks';
import { updateUserDefaults, updateUserSchema } from '../schemas';

const FIELDS = ['firstName', 'lastName', 'phone'];

/** Edit form of an account: name and phone only (PATCH /users/:id); email and role are read-only. */
export function EditUserForm({ formId, user, onClose }) {
  const updateUser = useUpdateUser();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, dirtyFields },
  } = useForm({ resolver: zodResolver(updateUserSchema), defaultValues: updateUserDefaults(user) });

  const onSubmit = (values) => {
    const body = changedFields(values, dirtyFields);
    if (Object.keys(body).length === 0) return onClose();
    return updateUser
      .mutateAsync({ id: user.id, body })
      .then(onClose)
      .catch((error) => applyServerErrors(error, setError, { knownFields: FIELDS }));
  };

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <FormRootError error={errors.root?.server} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="First name" error={errors.firstName?.message} required>
          <Input {...register('firstName')} autoComplete="off" />
        </FormField>
        <FormField label="Last name" error={errors.lastName?.message} required>
          <Input {...register('lastName')} autoComplete="off" />
        </FormField>
      </div>
      <FormField label="Phone" error={errors.phone?.message}>
        <Input {...register('phone')} type="tel" autoComplete="off" />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Email"
          hint="Email and role can't be changed; deactivate and create a new account instead."
        >
          <Input value={user.email} readOnly />
        </FormField>
        <FormField label="Role">
          <Input value={roleLabel(user.role)} readOnly />
        </FormField>
      </div>
    </form>
  );
}
