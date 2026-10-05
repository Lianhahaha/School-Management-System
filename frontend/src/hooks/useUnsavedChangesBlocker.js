import { useEffect } from 'react';
import { useBlocker } from 'react-router';
import { useConfirm } from './useConfirm';

/**
 * Asks before the user loses unsaved work, both for in-app navigation to another page
 * (react-router blocker, confirmed with the app's own dialog) and for closing or reloading
 * the tab (the browser's native prompt). By default changing only the query string is not blocked, so a
 * page may keep its own filters in the URL while editing. Pass `includeSearch` when the query string
 * decides what is being edited (the lesson and date of an attendance sheet, the tab that holds a form):
 * leaving it then asks too.
 *
 *   useUnsavedChangesBlocker(isDirty);
 *   useUnsavedChangesBlocker(isDirty, { includeSearch: true });
 *
 * @param {boolean} when true while there are unsaved changes
 * @param {{ includeSearch?: boolean }} [options]
 */
export function useUnsavedChangesBlocker(when, { includeSearch = false } = {}) {
  const confirm = useConfirm();

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      when &&
      (currentLocation.pathname !== nextLocation.pathname ||
        (includeSearch && currentLocation.search !== nextLocation.search)),
  );

  useEffect(() => {
    if (blocker.state !== 'blocked') return undefined;
    let isCurrent = true; // a re-run of this effect (StrictMode) must not act on a stale answer
    confirm({
      title: 'Discard unsaved changes?',
      description: 'You have changes that are not saved. If you leave this page they will be lost.',
      confirmLabel: 'Discard changes',
      cancelLabel: 'Keep editing',
    }).then((discard) => {
      if (!isCurrent) return;
      if (discard) blocker.proceed();
      else blocker.reset();
    });
    return () => {
      isCurrent = false;
    };
  }, [blocker, confirm]);

  useEffect(() => {
    if (!when) return undefined;
    const warnBeforeUnload = (event) => event.preventDefault();
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [when]);
}
