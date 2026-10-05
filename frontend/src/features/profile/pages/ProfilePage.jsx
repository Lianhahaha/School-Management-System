import { KeyRound } from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { DescriptionList } from '../../../components/ui/DescriptionList';
import { useToast } from '../../../hooks/useToast';
import { formatDate, isoToYmd } from '../../../utils/date';
import { fullName } from '../../../utils/names';
import { mapFirebaseError } from '../../auth/firebaseErrors';
import { useAuth, useForgotPassword } from '../../auth/hooks';
import { RoleBadge } from '../../users/components/RoleBadge';
import { ContactDetailsForm } from '../components/ContactDetailsForm';
import { RoleDetails } from '../components/RoleDetails';

export default function ProfilePage() {
  const { me } = useAuth();
  const toast = useToast();
  const resetPassword = useForgotPassword();

  const sendResetEmail = () =>
    resetPassword.mutate(me.email, {
      onSuccess: () => toast.success(`Password reset link sent to ${me.email}`),
      onError: (error) =>
        toast.error(mapFirebaseError(error.code, 'Could not send the reset email. Please try again.')),
    });

  return (
    <>
      <PageHeader title="My profile" description="Your account, school record and contact details." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Account">
          <DescriptionList
            items={[
              { label: 'Name', value: fullName(me) },
              { label: 'Email', value: me.email },
              { label: 'Role', value: <RoleBadge role={me.role} /> },
              { label: 'Member since', value: formatDate(isoToYmd(me.createdAt)) },
            ]}
          />
        </Card>

        {me.profile && (
          <Card title="School record" description="Ask your administrator to change these details.">
            <RoleDetails me={me} />
          </Card>
        )}

        <Card title="Contact details" className="lg:col-span-2">
          <ContactDetailsForm me={me} />
        </Card>

        <Card
          title="Security"
          description="Your password is managed by Firebase. We will email you a link to choose a new one."
        >
          <Button
            variant="secondary"
            icon={KeyRound}
            isLoading={resetPassword.isPending}
            onClick={sendResetEmail}
          >
            Email me a reset link
          </Button>
        </Card>
      </div>
    </>
  );
}
