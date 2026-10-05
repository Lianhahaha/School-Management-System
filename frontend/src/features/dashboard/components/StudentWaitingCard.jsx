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

/**
 * For a student without a class: what an administrator does next and what the student can do
 * meanwhile, instead of an empty dashboard. Class pages fill in once the enrollment exists.
 */
export function StudentWaitingCard() {
  const { me } = useAuth();
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
      hint: `An administrator puts you in a class. If it takes long, tell the school office you signed up as ${me.email}.`,
      isDone: false,
    },
  ];

  return (
    <Card
      title="You're not in a class yet"
      description="Your timetable, attendance and grades appear here once an administrator enrolls you."
    >
      <StepList steps={steps} />
    </Card>
  );
}
