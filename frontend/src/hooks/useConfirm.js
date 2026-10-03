import { createContext, useContext } from 'react';

/** Provided by ConfirmProvider (components/ui), which owns the single ConfirmDialog of the app. */
export const ConfirmContext = createContext(null);

/**
 * Promise-based confirmation, so a destructive action reads top to bottom:
 *
 *   const confirm = useConfirm();
 *   const onDelete = async (subject) => {
 *     const ok = await confirm({
 *       title: `Delete ${subject.name}?`,
 *       description: 'This cannot be undone.',
 *       confirmLabel: 'Delete', // name the verb, never "OK"
 *     });
 *     if (ok) deleteSubject.mutate(subject.id);
 *   };
 *
 * Options: title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'danger' | 'primary'.
 * Resolves true on confirm and false on cancel, Escape or backdrop click. Focus starts on Cancel for
 * the danger tone. For a dialog that stays open while the request runs, use <ConfirmDialog> directly.
 *
 * @returns {(options: object) => Promise<boolean>}
 */
export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return confirm;
}
