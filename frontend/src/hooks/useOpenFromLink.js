import { useEffect } from 'react';
import { useSearchParams } from 'react-router';

/**
 * Opens a page's create dialog when the link asked for it (`?new=1`, for example a dashboard shortcut), then
 * drops the flag from the URL so that Back or a reload does not open the dialog again.
 *   useOpenFromLink(createModal.open);
 * @param {() => void} open stable callback that opens the dialog
 * @param {string} [param] query parameter name
 */
export function useOpenFromLink(open, param = 'new') {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.has(param);

  useEffect(() => {
    if (!requested) return;
    open();
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete(param);
        return next;
      },
      { replace: true },
    );
  }, [requested, open, param, setSearchParams]);
}
