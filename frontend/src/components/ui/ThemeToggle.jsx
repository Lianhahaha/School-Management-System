import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { cx } from '../../utils/cx';

/**
 * Light / dark switch: a capsule whose round knob rides to the side of the active theme and
 * carries its icon. It is a real switch (role="switch", aria-checked = dark theme on). Below `sm` it
 * folds into a square icon button like the bell, so the phone top bar fits.
 */
export function ThemeToggle({ className }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const Icon = isDark ? Moon : Sun;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Dark theme"
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={toggleTheme}
      className={cx(
        'relative inline-flex h-9 w-16 shrink-0 items-center rounded-full bg-gray-200 p-1 transition-colors hover:bg-gray-300',
        'max-sm:size-10 max-sm:justify-center max-sm:rounded-control max-sm:bg-transparent max-sm:p-0 max-sm:text-gray-700 max-sm:hover:bg-gray-100 max-sm:pointer-coarse:size-11',
        // On touch screens an invisible margin around the drawn switch takes the tap (44 px tall).
        'pointer-coarse:after:absolute pointer-coarse:after:-inset-1 pointer-coarse:after:content-[""]',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          'flex size-7 items-center justify-center rounded-full bg-surface text-gray-900 shadow-[0_1px_3px_rgb(24_24_27/0.2)] transition-transform duration-200 ease-out-soft',
          isDark && 'translate-x-7',
          'max-sm:translate-x-0 max-sm:bg-transparent max-sm:text-current max-sm:shadow-none',
        )}
      >
        <Icon className="size-4 max-sm:size-5" />
      </span>
    </button>
  );
}
