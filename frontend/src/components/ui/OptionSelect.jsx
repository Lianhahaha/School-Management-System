import { Select } from './Select';

/**
 * A Select whose options come from a query (see createOptionsHook). While the options load the
 * select is disabled, and it is re-mounted once they arrive: a native select cannot hold a value
 * that has no <option> yet, so without the re-mount a preselected value (react-hook-form default or
 * a controlled `value`) would be lost and the form would show a different choice than it submits.
 *
 *   const { data, isPending } = useClassOptions();
 *   <OptionSelect {...register('classId')} options={data} isPending={isPending} placeholder="Choose a class" />
 *
 * @param {object} props
 * @param {Array<{ value: string, label: string }>} [props.options] undefined while loading
 * @param {boolean} props.isPending the options query is still loading its first result
 * @param {string} [props.placeholder] label of the empty choice
 */
export function OptionSelect({ options = [], isPending, disabled, ...props }) {
  return (
    <Select
      {...props}
      key={isPending ? 'loading' : 'ready'}
      options={options}
      disabled={isPending || disabled}
      aria-busy={isPending || undefined}
    />
  );
}
