import { GraduationCap } from 'lucide-react';
import { EmptyState } from '../../../components/ui/EmptyState';

/**
 * What every class-dependent student page shows while the student has no active enrollment
 * (`me.currentEnrollment` is null). The page must not fire its class queries in that case.
 */
export function NotEnrolledState() {
  return (
    <EmptyState
      icon={GraduationCap}
      title="You're not enrolled in a class yet"
      description="Your school administrator will enroll you."
    />
  );
}
