import { Select } from './Select';

/** The placeholder of a picker whose options failed to load, so it never reads as an empty list. */
export const OPTIONS_FAILED_PLACEHOLDER = "Couldn't load the list";

/**
 * A Select whose options come from a query (see createOptionsHook). While the options load the
 * select is disabled, and it is re-mounted once they arrive: a native select cannot hold a value
 * that has no <option> yet, so without the re-mount a preselected value (react-hook-form default or
 * a controlled `value`) would be lost and the form would show a different choice than it submits.
 * When the first load failed (`isError` and no options) it stays disabled and its placeholder says so;
 * opening the form again, or reloading the page, tries again.
 *
 *   const { data, isPending, isError } = useClassOptions();
 *   <OptionSelect {...register('classId')} options={data} isPending={isPending} isError={isError}
 *                 placeholder="Choose a class" />
 *
 * @param {object} props
 * @param {Array<{ value: string, label: string }>} [props.options] undefined while loading or after a failed load
 * @param {boolean} props.isPending the options query is still loading its first result
 * @param {boolean} [props.isError] the options query failed
 * @param {string} [props.placeholder] label of the empty choice
 */
export function OptionSelect({ options, isPending, isError = false, placeholder, disabled, ...props }) {
  const isUnavailable = isError && options === undefined;
  return (
    <Select
      {...props}
      key={isPending ? 'loading' : isUnavailable ? 'unavailable' : 'ready'}
      options={options ?? []}
      placeholder={isUnavailable ? OPTIONS_FAILED_PLACEHOLDER : placeholder}
      disabled={isPending || isUnavailable || disabled}
      aria-busy={isPending || undefined}
    />
  );
}
