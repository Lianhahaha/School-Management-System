import { AuthHeading } from '../../../components/layout/AuthHeading';
import { Tabs } from '../../../components/ui/Tabs';
import { TextLink } from '../../../components/ui/TextLink';
import { useAuth } from '../../auth/hooks';
import { FullNotice } from '../components/FullNotice';
import { StudentNotice } from '../components/StudentNotice';

/**
 * The Privacy Notice, open to everyone (signed in or not): the version for students first, the full
 * notice second. Linked from the sign-up form, the sign-in page, the sidebar and the profile.
 */
export default function PrivacyPage() {
  const { me } = useAuth();

  return (
    <>
      <AuthHeading
        title="Privacy Notice"
        description="How the school uses the personal information in Skole, and what you can ask for."
      />
      <Tabs
        label="Privacy Notice versions"
        tabs={[
          { id: 'students', label: 'For students', content: <StudentNotice /> },
          { id: 'full', label: 'Full notice', content: <FullNotice /> },
        ]}
      />
      <p className="mt-8 text-center text-sm text-gray-600">
        {me ? <TextLink to="/">Back to Skole</TextLink> : <TextLink to="/login">Back to sign in</TextLink>}
      </p>
    </>
  );
}
