import { cx } from '../../utils/cx';

/**
 * Selected-chip colours per option tone. Full class names so that Tailwind can find them.
 * The neutral choice (no tone) is an ink outline; status choices take their soft tone and a ring.
 */
const CHECKED_CLASSES = {
  neutral: 'peer-checked:bg-surface peer-checked:text-gray-900 peer-checked:ring-gray-900',
  gray: 'peer-checked:bg-gray-200 peer-checked:text-gray-900 peer-checked:ring-gray-500',
  green: 'peer-checked:bg-green-50 peer-checked:text-green-700 peer-checked:ring-green-600',
  amber: 'peer-checked:bg-amber-50 peer-checked:text-amber-700 peer-checked:ring-amber-600',
  red: 'peer-checked:bg-red-50 peer-checked:text-red-700 peer-checked:ring-red-600',
  blue: 'peer-checked:bg-blue-50 peer-checked:text-blue-700 peer-checked:ring-blue-600',
  violet: 'peer-checked:bg-violet-50 peer-checked:text-violet-700 peer-checked:ring-violet-600',
};

/**
 * A real radio group (fieldset, legend, native radio inputs) drawn as selectable chips, so the
 * choice is announced correctly and works with the arrow keys. The selected option is marked by
 * weight and a ring as well as colour, never by colour alone.
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
      <div className="flex flex-wrap gap-1.5">
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
                'inline-flex min-h-9 items-center gap-1.5 rounded-control bg-gray-100 px-3.5 text-sm text-gray-700 transition-colors ring-inset hover:bg-gray-200 pointer-coarse:min-h-11',
                'peer-checked:font-semibold peer-checked:ring-2 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gray-900',
                CHECKED_CLASSES[option.tone ?? 'neutral'],
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
