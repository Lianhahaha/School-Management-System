import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '../../../components/ui/Button';
import { FormField, FormRootError } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { mapFirebaseError } from '../firebaseErrors';
import { useLogin } from '../hooks';
import { loginSchema } from '../schemas';

/**
 * Email and password form. A successful sign-in needs no handling here: AuthProvider notices the
 * Firebase user, loads the account and the guards redirect.
 */
export function LoginForm() {
  const login = useLogin();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  const onSubmit = (values) =>
    login
      .mutateAsync(values)
      .catch((error) => setError('root.server', { message: mapFirebaseError(error.code) }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <fieldset disabled={login.isPending} className="space-y-4">
        <FormRootError error={errors.root?.server} />
        <FormField label="Email" error={errors.email?.message} required>
          <Input {...register('email')} type="email" autoComplete="email" />
        </FormField>
        <FormField label="Password" error={errors.password?.message} required>
          <Input {...register('password')} type="password" autoComplete="current-password" />
        </FormField>
        <Button type="submit" isLoading={login.isPending} className="w-full">
          Sign in
        </Button>
      </fieldset>
    </form>
  );
}
