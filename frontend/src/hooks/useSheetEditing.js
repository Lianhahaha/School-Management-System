import { useUnsavedChangesBlocker } from './useUnsavedChangesBlocker';

/**
 * What the editable sheets (grades, attendance) share around a save. Each sheet keeps its draft and its saved
 * copy itself; this hook:
 *   - asks before the user leaves with unsaved edits (useUnsavedChangesBlocker);
 *   - reads a refused save: `isStale` when someone saved the sheet after it was opened (409 `sheet_changed`),
 *     `canReload` when reloading is the way out (that, or students on the sheet left the class);
 *   - `reload()` fetches the sheet again and hands the fresh copy to `adopt`, which drops the edits.
 *
 *   const { isStale, canReload, reload } = useSheetEditing({
 *     isDirty: canSave && hasEdits, saveError, onReload, adopt, includeSearch: true,
 *   });
 *   {canReload && <SheetSaveAlert message="..." onReload={reload} />}
 *
 * @param {object} options
 * @param {boolean} options.isDirty true while there are edits the user could save
 * @param {(Error & { details?: object }) | null | undefined} options.saveError the last refused save
 * @param {() => Promise<{ data?: object }>} options.onReload refetches the sheet (the query's refetch)
 * @param {(sheet: object) => void} options.adopt makes a sheet from the server the saved state
 * @param {boolean} [options.includeSearch] the query string decides what is edited (see useUnsavedChangesBlocker)
 */
export function useSheetEditing({ isDirty, saveError, onReload, adopt, includeSearch = false }) {
  useUnsavedChangesBlocker(isDirty, { includeSearch });

  const isStale = saveError?.details?.reason === 'sheet_changed';
  return {
    isStale,
    canReload: isStale || Boolean(saveError?.details?.invalidStudentIds),
    reload: () => onReload().then(({ data }) => data && adopt(data)),
  };
}
