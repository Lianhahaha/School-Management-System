import { AuthHeading } from '../../../components/layout/AuthHeading';
import { TextLink } from '../../../components/ui/TextLink';
import { RegisterForm } from '../components/RegisterForm';
import { RegistrationClosed } from '../components/RegistrationClosed';
import { useRegistrationClosed } from '../registrationClosed';

export default function RegisterPage() {
  const isRegistrationClosed = useRegistrationClosed();

  return (
    <>
      <AuthHeading
        title="Create your account"
        description="Apply as a student. Sign in any time to see where your application stands."
      />
      {isRegistrationClosed ? <RegistrationClosed /> : <RegisterForm />}
      <p className="mt-6 text-center text-sm text-gray-600">
        Already have an account? <TextLink to="/login">Sign in</TextLink>
      </p>
    </>
  );
}
