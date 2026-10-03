import { AuthHeading } from '../../../components/layout/AuthHeading';
import { TextLink } from '../../../components/ui/TextLink';
import { ForgotPasswordForm } from '../components/ForgotPasswordForm';

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthHeading
        title="Reset your password"
        description="Enter your email and we will send you a reset link."
      />
      <ForgotPasswordForm />
      <p className="mt-6 text-center text-sm text-gray-600">
        <TextLink to="/login">Back to sign in</TextLink>
      </p>
    </>
  );
}
