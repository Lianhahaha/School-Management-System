import { Select } from '../../../components/ui/Select';
import { TERMS } from '../../../constants/shared';
import { TERM_LABELS } from '../../../constants/ui';
import { schoolYearLabel } from '../../enrollments/schoolYears';

/** Within each school year: the whole year, then its semesters. '' is the whole year. */
const PERIODS = [
  { term: '', label: 'Whole year' },
  ...TERMS.map((term) => ({ term, label: TERM_LABELS[term] })),
];

/**
 * One select for the school year and semester, as a school portal shows them: "AY 2026-2027 · 1st Semester",
 * newest year first, each year offering the whole year and its semesters.
 *
 * @param {object} props
 * @param {Array<{ academicYear: string }>} props.years from useSchoolYear
 * @param {string} props.academicYear the year shown
 * @param {string} props.term 'term1' | 'term2' | 'term3', or '' for the whole year
 * @param {(academicYear: string, term: string) => void} props.onChange
 * @param {string} [props.className]
 */
export function SchoolPeriodSelect({ years, academicYear, term, onChange, className }) {
  const options = years.flatMap((year) =>
    PERIODS.map((period) => ({
      value: `${year.academicYear}|${period.term}`,
      label: `${schoolYearLabel(year.academicYear)} · ${period.label}`,
    })),
  );
  return (
    <Select
      aria-label="School year and semester"
      options={options}
      value={`${academicYear}|${term}`}
      onChange={(event) => {
        const [nextYear, nextTerm] = event.target.value.split('|');
        onChange(nextYear, nextTerm);
      }}
      className={className}
    />
  );
}
