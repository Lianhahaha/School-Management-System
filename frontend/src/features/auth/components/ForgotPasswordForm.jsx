import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { FormField, FormRootError } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { mapFirebaseError } from '../firebaseErrors';
import { useForgotPassword } from '../hooks';
import { forgotSchema } from '../schemas';

/** Asks for an email and sends the Firebase reset link. The success message is the same for every email. */
export function ForgotPasswordForm() {
  const forgotPassword = useForgotPassword();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(forgotSchema), defaultValues: { email: '' } });

  const onSubmit = ({ email }) =>
    forgotPassword.mutateAsync(email).catch((error) =>
      setError('root.server', {
        message: mapFirebaseError(error.code, 'Could not send the reset email. Please try again.'),
      }),
    );

  if (forgotPassword.isSuccess) {
    return (
      <Alert tone="success" role="status">
        If an account exists for {forgotPassword.variables}, a reset link has been sent. Check your inbox.
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <fieldset disabled={forgotPassword.isPending} className="space-y-4">
        <FormRootError error={errors.root?.server} />
        <FormField label="Email" error={errors.email?.message} required>
          <Input {...register('email')} type="email" autoComplete="email" />
        </FormField>
        <Button type="submit" isLoading={forgotPassword.isPending} className="w-full">
          Send reset link
        </Button>
      </fieldset>
    </form>
  );
}
