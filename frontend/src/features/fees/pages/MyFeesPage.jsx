import { PageHeader } from '../../../components/layout/PageHeader';
import { FeeStatement } from '../components/FeeStatement';
import { FeeYearSelect } from '../components/FeeYearSelect';
import { useFeeYear } from '../hooks';

/**
 * /student/fees: the signed-in student's fees, payments and balance for one school year, read-only. The year
 * sits in the page header and the URL (`academicYear`) and opens on the current school year.
 */
export default function MyFeesPage() {
  const [academicYear, setAcademicYear] = useFeeYear();
  return (
    <>
      <PageHeader
        title="My fees"
        description="What you pay for the school year, and what you have paid so far."
        actions={<FeeYearSelect value={academicYear} onChange={setAcademicYear} className="w-44" />}
      />
      <FeeStatement studentId="me" academicYear={academicYear} />
    </>
  );
}
