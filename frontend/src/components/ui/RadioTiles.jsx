import { cx } from '../../utils/cx';

/**
 * A real radio group (fieldset, legend, native radio inputs) drawn as squared tiles: a title and a line or
 * two of detail per option, for choices that need a sentence (the kind of account on the sign-up page, a
 * section with its seats). The chosen tile gets an ink ring and the sheet colour; a disabled one fades and
 * cannot be picked. Arrow keys move between the options, as in any radio group.
 *
 * Controlled: pass `value` and `onChange` (change event). Uncontrolled / react-hook-form: spread
 * `register('accountType')` and omit `value`. Option values are strings, like every radio value.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.legend accessible name of the group
 * @param {boolean} [props.hideLegend] keep the legend for screen readers only
 * @param {string} props.name shared by every radio of the group
 * @param {Array<{ value: string, label: import('react').ReactNode, description?: import('react').ReactNode, disabled?: boolean }>} props.options
 * @param {string} [props.gridClassName] columns of the tiles, e.g. 'sm:grid-cols-2'
 */
export function RadioTiles({
  legend,
  hideLegend = false,
  name,
  options,
  value,
  onChange,
  disabled,
  className,
  gridClassName,
  ...inputProps
}) {
  return (
    <fieldset disabled={disabled} className={className}>
      <legend className={hideLegend ? 'sr-only' : 'mb-1.5 text-sm font-medium text-gray-700'}>
        {legend}
      </legend>
      <div className={cx('grid gap-2', gridClassName)}>
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
              disabled={option.disabled}
              className="peer sr-only"
              {...inputProps}
            />
            <span
              className={cx(
                'grid h-full gap-0.5 rounded-tile bg-gray-50 px-4 py-3 ring-1 ring-gray-200 transition-colors ring-inset',
                'hover:bg-gray-100 peer-disabled:hover:bg-gray-50',
                'peer-checked:bg-surface peer-checked:ring-2 peer-checked:ring-gray-900',
                'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gray-900',
              )}
            >
              <span className="text-sm font-semibold text-gray-900">{option.label}</span>
              {option.description && <span className="text-xs text-gray-600">{option.description}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
