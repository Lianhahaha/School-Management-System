import { OptionSelect } from '../../../components/ui/OptionSelect';
import { useClassOptions } from '../hooks';

/**
 * Select of classes, labelled "Name · 2026-2027 · 30 students" (the first 100 classes). Works with
 * react-hook-form (`{...register('classId')}`) and as a controlled filter (`value`, `onChange` with the event).
 *
 * @param {object} props
 * @param {object} [props.filters] extra list filters, for example `{ academicYear: '2026-2027' }`
 * @param {number[]} [props.excludeIds] classes to leave out, for example the one a student is moving from
 * @param {string} [props.placeholder] label of the empty choice (default "Choose a class"); pass "All classes" for a filter
 * Every other prop goes to the native <select>.
 */
export function ClassSelect({ filters, excludeIds = [], placeholder = 'Choose a class', ...props }) {
  const { data, isPending } = useClassOptions(filters);
  const options = data?.filter((option) => !excludeIds.includes(option.item.id));
  return <OptionSelect options={options} isPending={isPending} placeholder={placeholder} {...props} />;
}
