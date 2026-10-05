import { cx } from '../../utils/cx';

/*
 * Small status label: a squared-off tag with a hairline edge, in three weights instead of a rainbow.
 * The text always carries the meaning; the weight only says how much it matters.
 *   filled  (green, blue, violet)  the normal "on" state or a category: Active, Teacher, Grade 10 - A
 *   outline (gray)                 off or secondary: Disabled, Not enrolled, Quiz
 *   tinted  (amber, red)           needs attention: Late, Absent, 3/8 graded
 */
const TONE_CLASSES = {
  gray: 'text-gray-600 ring-gray-300',
  green: 'bg-gray-100 text-gray-900 ring-gray-200',
  blue: 'bg-gray-100 text-gray-900 ring-gray-200',
  violet: 'bg-gray-100 text-gray-900 ring-gray-200',
  amber: 'bg-amber-50 text-amber-700 ring-current/25',
  red: 'bg-red-50 text-red-700 ring-current/25',
};

/**
 * @param {object} props
 * @param {'gray'|'green'|'amber'|'red'|'blue'|'violet'} [props.tone]
 */
export function Badge({ tone = 'gray', className, children }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs leading-4 font-medium whitespace-nowrap ring-1 ring-inset',
        TONE_CLASSES[tone] ?? TONE_CLASSES.gray,
        className,
      )}
    >
      {children}
    </span>
  );
}
