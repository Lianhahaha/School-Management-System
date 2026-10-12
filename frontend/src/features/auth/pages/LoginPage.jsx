import { AuthHeading } from '../../../components/layout/AuthHeading';
import { Alert } from '../../../components/ui/Alert';
import { TextLink } from '../../../components/ui/TextLink';
import { LoginForm } from '../components/LoginForm';
import { useAuth } from '../hooks';
import { useRegistrationClosed } from '../registrationClosed';

export default function LoginPage() {
  const { authNotice } = useAuth();
  const isRegistrationClosed = useRegistrationClosed();

  return (
    <>
      <AuthHeading title="Sign in" description="Welcome back. Sign in with your school account." />
      {authNotice && (
        <Alert tone={authNotice.tone} role="status" className="mb-4">
          {authNotice.message}
        </Alert>
      )}
      <LoginForm />
      <div className="mt-6 space-y-2 text-center text-sm text-gray-600">
        <p>
          <TextLink to="/forgot-password">Forgot password?</TextLink>
        </p>
        {!isRegistrationClosed && (
          <p>
            New student? <TextLink to="/register">Create an account</TextLink>
          </p>
        )}
      </div>
    </>
  );
}
