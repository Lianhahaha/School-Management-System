import { GraduationCap } from 'lucide-react';
import { APP_NAME } from '../../constants/ui';
import { cx } from '../../utils/cx';

/** Logo mark and application name. */
export function Brand({ className }) {
  return (
    <div className={cx('flex items-center gap-2', className)}>
      <span className="flex size-9 items-center justify-center rounded-lg bg-brand-600 text-white">
        <GraduationCap className="size-5" aria-hidden="true" />
      </span>
      <span className="text-base font-semibold text-gray-900">{APP_NAME}</span>
    </div>
  );
}
