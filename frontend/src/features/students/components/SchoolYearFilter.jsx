import { Select } from '../../../components/ui/Select';
import { useClassOptions } from '../../classes/hooks';
import { classYearOptions } from '../yearOptions';

/**
 * The Students page's school-year filter: the students whose class is of that year (see classYearOptions for
 * the choices). The years come from the class picker's list, the same cached request as the "All classes"
 * filter beside it; until it arrives the current year and the year in the URL are already offered.
 *
 * @param {object} props
 * @param {string} props.value the `academicYear` filter, '' for any year
 * @param {(event: import('react').ChangeEvent<HTMLSelectElement>) => void} props.onChange
 */
export function SchoolYearFilter({ value, onChange }) {
  const classes = useClassOptions();
  const options = classYearOptions(classes.data?.map((option) => option.item) ?? [], value);
  return (
    <Select
      aria-label="Filter by school year"
      value={value}
      onChange={onChange}
      options={options}
      placeholder="Any school year"
    />
  );
}
