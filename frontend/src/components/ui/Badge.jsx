import { cx } from '../../utils/cx';

/*
 * Small status label: a squared-off tag with a firm edge, in three weights instead of a rainbow.
 * The text always carries the meaning; the weight only says how much it matters.
 *   filled  (blue, violet)  a category: Teacher, Grade 10 - A
 *   outline (gray)          off or secondary: Disabled, Not enrolled, Quiz
 *   tinted  (green)         "on": Active, Present, Enrolled, a solid tint so it is found at a glance
 *   tinted  (amber, red)    needs attention: Late, Absent, 3/8 graded
 */
const TONE_CLASSES = {
  gray: 'text-gray-700 ring-gray-400',
  green: 'bg-green-600/20 text-green-700 ring-green-600/55',
  blue: 'bg-gray-200 text-gray-900 ring-gray-300',
  violet: 'bg-gray-200 text-gray-900 ring-gray-300',
  amber: 'bg-amber-500/25 text-amber-700 ring-amber-600/55',
  red: 'bg-red-600/15 text-red-700 ring-red-600/50',
};

/**
 * @param {object} props
 * @param {'gray'|'green'|'amber'|'red'|'blue'|'violet'} [props.tone]
 * Other props (title, aria-*) go to the span.
 */
export function Badge({ tone = 'gray', className, children, ...props }) {
  return (
    <span
      {...props}
      className={cx(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs leading-4 font-semibold whitespace-nowrap ring-1 ring-inset',
        TONE_CLASSES[tone] ?? TONE_CLASSES.gray,
        className,
      )}
    >
      {children}
    </span>
  );
}
