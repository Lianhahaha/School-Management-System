import { useCallback, useRef } from 'react';
import { useConfirm } from './useConfirm';

/**
 * "Discard changes?" guard for a modal with a larger form (more than three fields). The form reports
 * whether it is dirty with `trackDirty(isDirty)`; the modal passes `requestClose` to its `onClose`
 * (Escape, backdrop, close button, Cancel) so a dirty form asks first. After a successful save call
 * the plain `onClose`, which never asks.
 *
 *   const { requestClose, trackDirty } = useDiscardConfirm(onClose);
 *   <Modal onClose={requestClose}> <Form trackDirty={trackDirty} /> </Modal>
 *   // in the form: useEffect(() => trackDirty(formState.isDirty), [formState.isDirty, trackDirty]);
 *
 * @param {() => void} onClose closes the modal
 */
export function useDiscardConfirm(onClose) {
  const confirm = useConfirm();
  const isDirty = useRef(false);

  const trackDirty = useCallback((dirty) => {
    isDirty.current = dirty;
  }, []);

  const requestClose = useCallback(async () => {
    if (isDirty.current) {
      const discard = await confirm({
        title: 'Discard changes?',
        description: 'You have changes that are not saved. If you close this form they will be lost.',
        confirmLabel: 'Discard changes',
        cancelLabel: 'Keep editing',
      });
      if (!discard) return;
    }
    isDirty.current = false;
    onClose();
  }, [confirm, onClose]);

  return { requestClose, trackDirty };
}
