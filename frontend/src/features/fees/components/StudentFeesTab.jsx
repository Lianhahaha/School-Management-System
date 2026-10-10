import { useFeeYear } from '../hooks';
import { FeeStatement } from './FeeStatement';
import { FeeYearSelect } from './FeeYearSelect';

/**
 * The Fees tab of a student's page (admin): one school year's statement, where payments are recorded and
 * removed. The year is in the URL and opens on the current school year.
 *
 * @param {object} props
 * @param {number} props.studentId
 */
export function StudentFeesTab({ studentId }) {
  const [academicYear, setAcademicYear] = useFeeYear();
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <FeeYearSelect value={academicYear} onChange={setAcademicYear} className="w-44" />
      </div>
      <FeeStatement studentId={studentId} academicYear={academicYear} canManage />
    </div>
  );
}
