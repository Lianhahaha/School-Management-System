import { useServerWaking } from '../../hooks/useServerWaking';
import { Spinner } from '../ui/Spinner';

/**
 * A floating note at the top of every page while an API request has been waiting several seconds
 * (lib/serverWake). The API runs on a free host that sleeps when nobody uses it, so the first request
 * after a quiet spell can take up to a minute; without this the page just looks stuck. The live region
 * is always mounted, so screen readers announce the note when it appears. Mount it once, near the root.
 */
export function ServerWakeNotice() {
  const isWaking = useServerWaking();

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4"
    >
      {isWaking && (
        <div className="flex max-w-md animate-toast-in items-start gap-3 rounded-[1.25rem] bg-surface px-4 py-3 text-sm shadow-pop">
          <Spinner className="mt-0.5 text-gray-600" />
          <p className="text-gray-700">
            <span className="block font-semibold text-gray-900">Waking up the server…</span>
            Skole runs on a free server that sleeps when nobody is using it. The first load can take up to a
            minute.
          </p>
        </div>
      )}
    </div>
  );
}
