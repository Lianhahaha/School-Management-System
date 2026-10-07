import { cx } from '../../utils/cx';

/*
 * Small status label: a squared-off tag with a firm edge, in three weights instead of a rainbow.
 * The text always carries the meaning; the weight only says how much it matters.
 *   filled  (blue, violet)  a category: Teacher, Grade 10 - A
 *   outline (gray)          off or secondary: Disabled, Not enrolled, Quiz
 *   positive (green)        "on": Active, Present, Enrolled, a deep green fill
 *   solid   (amber, red)    needs attention: Late, Absent, 3/8 graded
 *   oxblood                 something new to look at: New
 */
const TONE_CLASSES = {
  gray: 'text-gray-700 ring-gray-400',
  green: 'badge-positive text-white ring-black/5',
  blue: 'bg-gray-200 text-gray-900 ring-gray-300',
  violet: 'bg-gray-200 text-gray-900 ring-gray-300',
  amber: 'bg-solid-amber text-accent-ink ring-black/10',
  red: 'bg-solid-red text-white ring-black/10',
  oxblood: 'bg-mark-oxblood text-mark-cream ring-white/10',
};

/**
 * @param {object} props
 * @param {'gray'|'green'|'amber'|'red'|'blue'|'violet'|'oxblood'} [props.tone]
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
