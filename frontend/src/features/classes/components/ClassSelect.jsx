import { OptionSelect } from '../../../components/ui/OptionSelect';
import { currentAcademicYear } from '../../../utils/date';
import { useAuth } from '../../auth/hooks';
import { useClassOptions } from '../hooks';

/**
 * Select of classes, labelled "Name · 2026-2027 · 30 students" (newest academic year first). Works with
 * react-hook-form (`{...register('classId')}`) and as a controlled filter (`value`, `onChange` with the
 * event). A teacher gets only the classes they can see (they teach a subject there or are its homeroom
 * teacher): the API limits the list with `visible=true`.
 *
 * @param {object} props
 * @param {object} [props.filters] extra list filters, for example `{ academicYear: '2026-2027' }`
 * @param {number[]} [props.excludeIds] classes to leave out, for example the one a student is moving from
 * @param {boolean} [props.fromCurrentYear] only classes of the current or a later academic year: the API
 *   refuses to enroll or transfer a student into a past year's class
 * @param {string} [props.placeholder] label of the empty choice (default "Choose a class"); pass "All classes" for a filter
 * Every other prop goes to the native <select>.
 */
export function ClassSelect({
  filters,
  excludeIds = [],
  fromCurrentYear = false,
  placeholder = 'Choose a class',
  ...props
}) {
  const { role } = useAuth();
  const classes = useClassOptions(role === 'teacher' ? { ...filters, visible: true } : filters);

  const firstYear = currentAcademicYear();
  const isOffered = ({ item }) =>
    !excludeIds.includes(item.id) && (!fromCurrentYear || item.academicYear >= firstYear);
  const options = classes.data?.filter(isOffered);

  return (
    <OptionSelect options={options} isPending={classes.isPending} placeholder={placeholder} {...props} />
  );
}
