import { cx } from '../../utils/cx';

/**
 * Selected-chip colours per option tone. Full class names so that Tailwind can find them.
 * The neutral choice (no tone) is an ink outline; status choices (the attendance sheet) fill with their flat
 * school-palette colour, the same as their badges: no tinted wash.
 */
const CHECKED_CLASSES = {
  neutral: 'peer-checked:bg-surface peer-checked:text-gray-900 peer-checked:ring-gray-900',
  green: 'peer-checked:bg-positive peer-checked:text-white peer-checked:ring-positive',
  oxblood: 'peer-checked:bg-mark-oxblood peer-checked:text-mark-cream peer-checked:ring-mark-oxblood',
  cream: 'peer-checked:bg-mark-cream peer-checked:text-mark-oxblood peer-checked:ring-mark-oxblood/50',
  sage: 'peer-checked:bg-mark-sage peer-checked:text-mark-cream peer-checked:ring-mark-sage',
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
 * @param {boolean} [props.oneRowOnPhone] on a phone the options share one row in equal parts instead of wrapping
 */
export function RadioGroup({
  legend,
  hideLegend = false,
  name,
  options,
  value,
  onChange,
  disabled,
  oneRowOnPhone = false,
  className,
  ...inputProps
}) {
  return (
    <fieldset disabled={disabled} className={className}>
      <legend className={hideLegend ? 'sr-only' : 'mb-1.5 text-sm font-medium text-gray-700'}>
        {legend}
      </legend>
      <div
        className={cx(
          'flex flex-wrap gap-1.5',
          oneRowOnPhone && 'max-sm:grid max-sm:auto-cols-fr max-sm:grid-flow-col',
        )}
      >
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
                oneRowOnPhone && 'max-sm:w-full max-sm:justify-center max-sm:px-1',
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
