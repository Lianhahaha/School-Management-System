import { Select } from '../../../components/ui/Select';
import { schoolYearLabel } from '../schoolYears';

/**
 * Picks one of a student's school years ("AY 2026-2027"), newest first. No "all years" choice: a page shows
 * one school year at a time.
 *
 * @param {object} props
 * @param {Array<{ academicYear: string }>} props.years from useSchoolYear
 * @param {string} props.value the academic year shown
 * @param {(academicYear: string) => void} props.onChange
 * @param {string} [props.className]
 */
export function SchoolYearSelect({ years, value, onChange, className }) {
  return (
    <Select
      aria-label="School year"
      options={years.map(({ academicYear }) => ({
        value: academicYear,
        label: schoolYearLabel(academicYear),
      }))}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={className}
    />
  );
}
