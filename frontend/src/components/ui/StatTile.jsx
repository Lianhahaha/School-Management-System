import { Link } from 'react-router';
import { TONE_CLASSES } from '../../constants/ui';
import { cx } from '../../utils/cx';

/**
 * Key figure with a label, for dashboards. Pass `to` to make the whole tile a link.
 * @param {object} props
 * @param {string} props.label
 * @param {import('react').ReactNode} props.value
 * @param {string} [props.hint] small text under the value
 * @param {import('react').ElementType} [props.icon] lucide icon
 * @param {'gray'|'green'|'amber'|'red'|'blue'|'violet'} [props.tone] colour of the icon
 * @param {string} [props.to] route to open on click
 */
export function StatTile({ label, value, hint, icon: Icon, tone = 'blue', to }) {
  const classes = 'flex items-start gap-4 rounded-card border border-gray-200 bg-white p-5 shadow-card';
  const content = (
    <>
      {Icon && (
        <span
          className={cx('flex size-11 shrink-0 items-center justify-center rounded-lg', TONE_CLASSES[tone])}
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-sm text-gray-600">{label}</p>
        <p className="mt-0.5 text-2xl font-semibold text-gray-900">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
      </div>
    </>
  );

  return to ? (
    <Link to={to} className={cx(classes, 'transition-shadow hover:shadow-md')}>
      {content}
    </Link>
  ) : (
    <div className={classes}>{content}</div>
  );
}
