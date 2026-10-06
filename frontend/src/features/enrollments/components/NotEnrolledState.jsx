import { GraduationCap } from 'lucide-react';
import { Alert } from '../../../components/ui/Alert';
import { EmptyState } from '../../../components/ui/EmptyState';

/**
 * What a class-dependent student page shows while the student has no active enrollment
 * (`me.currentEnrollment` is null): a new student waiting for a class, or one who has left theirs.
 * The page must not fire its class queries in that case.
 */
export function NotEnrolledState() {
  return (
    <EmptyState
      icon={GraduationCap}
      title="You're not in a class right now"
      description="Your school administrator enrolls you in a class. Your timetable, attendance and grades appear here once you are."
    />
  );
}

/**
 * The note above a student's own history (grades, attendance) while they are not in a class: the records
 * of earlier classes stay visible, but nothing new is added until they are enrolled again.
 */
export function NotInClassNote({ children }) {
  return (
    <Alert tone="info">
      {children}
    </Alert>
  );
}
