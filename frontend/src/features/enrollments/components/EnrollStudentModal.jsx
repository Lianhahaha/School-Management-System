import { fullName } from '../../../utils/names';
import { useEnrollStudent } from '../hooks';
import { ClassPickerModal } from './ClassPickerModal';

/**
 * Enroll one student who has no active class into a class (POST /enrollments). Used by the students
 * list and the student detail page. Closes itself after success; the toast and the list refresh come
 * from useEnrollStudent.
 *
 * @param {object} props
 * @param {{ id: number, firstName: string, lastName: string }|null} props.student the student row; null while closed
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
      description={student ? `Choose the class ${fullName(student)} joins.` : undefined}
      submitLabel="Enroll"
      mutation={mutation}
    />
  );
}
