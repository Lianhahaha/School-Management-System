import { cx } from '../../utils/cx';

/** Selected-pill colours per option tone. Full class names so that Tailwind can find them. */
const CHECKED_CLASSES = {
  brand: 'peer-checked:border-brand-600 peer-checked:bg-brand-50 peer-checked:text-brand-700',
  gray: 'peer-checked:border-gray-500 peer-checked:bg-gray-100 peer-checked:text-gray-800',
  green: 'peer-checked:border-green-600 peer-checked:bg-green-50 peer-checked:text-green-700',
  amber: 'peer-checked:border-amber-600 peer-checked:bg-amber-50 peer-checked:text-amber-700',
  red: 'peer-checked:border-red-600 peer-checked:bg-red-50 peer-checked:text-red-700',
  blue: 'peer-checked:border-blue-600 peer-checked:bg-blue-50 peer-checked:text-blue-700',
  violet: 'peer-checked:border-violet-600 peer-checked:bg-violet-50 peer-checked:text-violet-700',
};

/**
 * A real radio group (fieldset, legend, native radio inputs) drawn as selectable pills, so the
 * choice is announced correctly and works with the arrow keys. The selected option is marked by
 * weight and border as well as colour, never by colour alone.
 *
 * Controlled: pass `value` and `onChange` (change event). Uncontrolled / react-hook-form: spread
 * `register('gender')` and omit `value`.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.legend accessible name of the group
 * @param {boolean} [props.hideLegend] keep the legend for screen readers only (dense rows)
 * @param {string} props.name shared by every radio of the group
 * @param {Array<{ value: string, label: import('react').ReactNode, tone?: string }>} props.options
 */
export function RadioGroup({
  legend,
  hideLegend = false,
  name,
  options,
  value,
  onChange,
  disabled,
  className,
  ...inputProps
}) {
  return (
    <fieldset disabled={disabled} className={className}>
      <legend className={hideLegend ? 'sr-only' : 'mb-1.5 text-sm font-medium text-gray-700'}>
        {legend}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="cursor-pointer has-disabled:cursor-not-allowed has-disabled:opacity-60"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === undefined ? undefined : value === option.value}
              onChange={onChange}
              className="peer sr-only"
              {...inputProps}
            />
            <span
              className={cx(
                'inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700',
                'peer-checked:font-semibold peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600 hover:bg-gray-50',
                CHECKED_CLASSES[option.tone ?? 'brand'],
              )}
            >
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
