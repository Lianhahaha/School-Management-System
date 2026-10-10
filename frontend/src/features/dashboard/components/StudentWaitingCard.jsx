import { CircleX, Hourglass } from 'lucide-react';
import { Alert } from '../../../components/ui/Alert';
import { Card } from '../../../components/ui/Card';
import { StepList } from '../../../components/ui/StepList';
import { useAuth } from '../../auth/hooks';

/** Contact details a school needs to reach a student; the profile step is done once all are filled in. */
const CONTACT_FIELDS = (me) => [
  me.phone,
  me.profile?.address,
  me.profile?.guardianName,
  me.profile?.guardianPhone,
];

/** A pending application: the documents the school office still waits for, then the placement. */
function ApplicationSteps({ me, admission }) {
  const steps = [
    { key: 'sent', title: 'Application sent', isDone: true },
    {
      key: 'birthCertificate',
      title: 'Birth certificate received',
      hint: 'Bring your PSA birth certificate to the school office.',
      isDone: admission.birthCertificateReceived,
    },
    {
      key: 'reportCard',
      title: 'Report card received',
      hint: 'Bring the report card (SF9) of your last school year to the school office.',
      isDone: admission.reportCardReceived,
    },
    {
      key: 'placement',
      title: `Placement in a Grade ${admission.gradeLevel} class`,
      hint: `An administrator puts you in a class. Questions? Give the school office your account email: ${me.email}.`,
      isDone: false,
    },
  ];

  return (
    <Card
      icon={Hourglass}
      mark="maroon"
      title="Your application is in"
      description="The school office checks your documents, then places you in a class. Your schedule appears here once you have one."
    >
      <StepList steps={steps} />
    </Card>
  );
}

/**
 * For a student without a class: what happens next instead of an empty dashboard. A self-registered applicant
 * sees their application (the documents the office has received, then the placement) or, once declined, the
 * reason; anyone else (new and waiting, or out of their class) sees what to do meanwhile. Class pages fill in
 * once the enrollment exists; grades and attendance of earlier classes stay on My grades and My attendance.
 */
export function StudentWaitingCard() {
  const { me } = useAuth();
  const admission = me.profile?.admission;

  if (admission?.status === 'pending') return <ApplicationSteps me={me} admission={admission} />;
  if (admission?.status === 'declined') {
    return (
      <Card icon={CircleX} mark="oxblood" title="Your application was declined">
        <div className="space-y-3">
          <Alert tone="error" title="Reason from the school">
            {admission.declineReason}
          </Alert>
          <p className="text-sm text-gray-600">
            Questions? Contact the school office with your account email: {me.email}.
          </p>
        </div>
      </Card>
    );
  }

  const steps = [
    {
      key: 'profile',
      title: 'Complete your profile',
      hint: 'Add your phone, address and guardian so the school can reach you.',
      to: '/profile',
      actionLabel: 'Open profile',
      isDone: CONTACT_FIELDS(me).every(Boolean),
    },
    {
      key: 'announcements',
      title: 'Read the announcements',
      hint: 'News from the school appears there, even before you have a class.',
      to: '/student/announcements',
      actionLabel: 'Read',
      isDone: false,
    },
    {
      key: 'enroll',
      title: 'Wait for your class',
      hint: `An administrator puts you in a class. If it takes long, tell the school office your account email: ${me.email}.`,
      isDone: false,
    },
  ];

  return (
    <Card
      icon={Hourglass}
      mark="maroon"
      title="You're not in a class right now"
      description="Your schedule appears here once an administrator enrolls you. Grades and attendance from earlier classes are on My grades and My attendance."
    >
      <StepList steps={steps} />
    </Card>
  );
}
