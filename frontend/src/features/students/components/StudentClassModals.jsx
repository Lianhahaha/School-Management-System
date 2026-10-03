import { Button } from '../../../components/ui/Button';
import { EnrollStudentModal } from '../../enrollments/components/EnrollStudentModal';
import { TransferStudentModal } from '../../enrollments/components/TransferStudentModal';

/**
 * The class action of a student row: "Enroll" while the student has no active class, "Transfer"
 * otherwise. Pass the clicked student to `onSelect`; render <StudentClassModals> once per page.
 */
export function StudentClassButton({ student, onSelect, variant = 'secondary' }) {
  const label = student.currentEnrollment ? 'Transfer' : 'Enroll';
  return (
    <Button
      size="sm"
      variant={variant}
      onClick={() => onSelect(student)}
      aria-label={`${label} ${student.firstName} ${student.lastName}`}
    >
      {label}
    </Button>
  );
}

/**
 * The enroll and transfer dialogs of the students pages, driven by one selected student: the
 * transfer dialog opens for a student who has an active class, the enroll dialog for one who has not.
 *
 * @param {object} props
 * @param {object|null} props.student the selected student row (as returned by useStudents); null = closed
 * @param {() => void} props.onClose
 */
export function StudentClassModals({ student, onClose }) {
  const isTransfer = Boolean(student?.currentEnrollment);
  return (
    <>
      <EnrollStudentModal student={student} open={Boolean(student) && !isTransfer} onClose={onClose} />
      <TransferStudentModal student={student} open={Boolean(student) && isTransfer} onClose={onClose} />
    </>
  );
}
