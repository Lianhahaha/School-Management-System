import { cx } from '../../utils/cx';

/**
 * Native select. `onChange` receives the change event, exactly like Input, so it works with
 * react-hook-form's `register` and with filters:
 *   <Select {...register('role')} options={ROLE_OPTIONS} placeholder="Choose a role" />
 *   <Select value={list.params.classId} onChange={(e) => list.setFilter('classId', e.target.value)} ... />
 *
 * @param {object} props
 * @param {Array<{ value: string|number, label: string, disabled?: boolean }>} props.options
 * @param {string} [props.placeholder] adds a first option with the empty value, for "none" or "all"
 */
export function Select({ options, placeholder, className, ref, ...props }) {
  return (
    <select ref={ref} className={cx('form-control', className)} {...props}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
