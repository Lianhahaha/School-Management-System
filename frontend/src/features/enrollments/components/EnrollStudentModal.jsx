import { fullName } from '../../../utils/names';
import { useEnrollStudent } from '../hooks';
import { ClassPickerModal } from './ClassPickerModal';

/** "Choose the class Ana Cruz joins.", plus the grade an applicant applied for (enrolling admits them). */
function descriptionOf(student) {
  const choose = `Choose the class ${fullName(student)} joins.`;
  const application = student.admission;
  return application && application.status !== 'admitted'
    ? `${choose} They applied for Grade ${application.gradeLevel}; enrolling admits them.`
    : choose;
}

/**
 * Enroll one student who has no active class into a class (POST /enrollments). Used by the students
 * list, the student detail page and the Admissions page (Admit). Closes itself after success; the toast
 * and the list refresh come from useEnrollStudent.
 *
 * @param {object} props
 * @param {{ id: number, firstName: string, lastName: string, admission?: object|null }|null} props.student
 *   the student row; null while closed
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 */
export function EnrollStudentModal({ student, open, onClose }) {
  const mutation = useEnrollStudent();
  return (
    <ClassPickerModal
      student={student}
      open={open}
      onClose={onClose}
      title="Enroll student"
      description={student ? descriptionOf(student) : undefined}
      submitLabel="Enroll"
      mutation={mutation}
    />
  );
}
