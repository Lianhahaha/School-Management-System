import { Select } from '../../../components/ui/Select';
import { schoolYearLabel } from '../../enrollments/schoolYears';
import { PERIODS } from '../periods';

/**
 * One select for the school year and its period, as a school portal shows them: "AY 2026-2027 · 1st
 * Semester", newest year first, each year offering the whole year and its two semesters. The quarters are not
 * a choice here: the table of a semester has a column for each.
 *
 * @param {object} props
 * @param {Array<{ academicYear: string }>} props.years from useSchoolYear
 * @param {string} props.academicYear the year shown
 * @param {string} props.semester 'sem1' or 'sem2', or '' for the whole year
 * @param {(academicYear: string, semester: string) => void} props.onChange
 * @param {string} [props.className]
 */
export function SchoolPeriodSelect({ years, academicYear, semester, onChange, className }) {
  const options = years.flatMap((year) =>
    PERIODS.map((period) => ({
      value: `${year.academicYear}|${period.semester}`,
      label: `${schoolYearLabel(year.academicYear)} · ${period.label}`,
    })),
  );
  return (
    <Select
      aria-label="School year and semester"
      options={options}
      value={`${academicYear}|${semester}`}
      onChange={(event) => {
        const [nextYear, nextSemester] = event.target.value.split('|');
        onChange(nextYear, nextSemester);
      }}
      className={className}
    />
  );
}
