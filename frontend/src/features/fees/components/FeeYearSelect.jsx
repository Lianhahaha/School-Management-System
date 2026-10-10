import { Select } from '../../../components/ui/Select';
import { academicYearOptions } from '../../../constants/ui';
import { schoolYearLabel } from '../../enrollments/schoolYears';

/** Two school years either side of the current one, newest first: fees are set (and paid) ahead. */
const YEAR_OPTIONS = academicYearOptions().map(({ value }) => ({ value, label: schoolYearLabel(value) }));

/**
 * Picks the school year of a fee list or statement ("AY 2026-2027"); pair it with useFeeYear.
 *
 * @param {object} props
 * @param {string} props.value the academic year shown
 * @param {(academicYear: string) => void} props.onChange
 * @param {string} [props.className]
 */
export function FeeYearSelect({ value, onChange, className }) {
  return (
    <Select
      aria-label="School year"
      options={YEAR_OPTIONS}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={className}
    />
  );
}
