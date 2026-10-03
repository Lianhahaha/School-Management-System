/** Joins class names, skipping falsy values: cx('a', isOn && 'b', undefined) -> 'a b'. */
export function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}
