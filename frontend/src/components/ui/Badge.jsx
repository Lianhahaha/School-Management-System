import { cx } from '../../utils/cx';

/*
 * Small status label: a pill, like the buttons, in three weights instead of a rainbow.
 * The text always carries the meaning; the weight only says how much it matters.
 *   filled  (blue, violet)  a category: Teacher, Grade 10 - A
 *   outline (gray)          off or secondary: Disabled, Not enrolled, Quiz
 *   status  (green)         "on": Active, Present, Enrolled, with a solid dot so it is found at a glance
 *   status  (amber, red)    needs attention: Late, Absent, 3/8 graded
 */
const TONE_CLASSES = {
  gray: 'text-gray-600 ring-1 ring-gray-300 ring-inset',
  green: 'bg-green-600/15 text-green-700',
  blue: 'bg-gray-100 text-gray-900',
  violet: 'bg-gray-100 text-gray-900',
  amber: 'bg-amber-500/20 text-amber-700',
  red: 'bg-red-600/12 text-red-700',
};

/** The solid mark of a status tone; categories and the outline weight carry no dot. */
const DOT_CLASSES = {
  green: 'bg-green-600',
  amber: 'bg-amber-500',
  red: 'bg-red-600',
};

/**
 * @param {object} props
 * @param {'gray'|'green'|'amber'|'red'|'blue'|'violet'} [props.tone]
 * @param {boolean} [props.dot] set false when the badge brings its own icon
 * Other props (title, aria-*) go to the span.
 */
export function Badge({ tone = 'gray', dot = true, className, children, ...props }) {
  const dotClass = dot && DOT_CLASSES[tone];

  return (
    <span
      {...props}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs leading-5 font-semibold whitespace-nowrap',
        TONE_CLASSES[tone] ?? TONE_CLASSES.gray,
        dotClass && 'pl-2',
        className,
      )}
    >
      {dotClass && <span className={cx('size-1.5 shrink-0 rounded-full', dotClass)} aria-hidden="true" />}
      {children}
    </span>
  );
}
