import { useCallback, useState } from 'react';

/**
 * Open/closed state for modals, drawers and menus.
 *   const modal = useDisclosure();
 *   <Button onClick={modal.open}>Add</Button>
 *   <Modal open={modal.isOpen} onClose={modal.close} ... />
 * @param {boolean} [initiallyOpen]
 * @returns {{ isOpen: boolean, open: () => void, close: () => void, toggle: () => void }}
 */
export function useDisclosure(initiallyOpen = false) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((current) => !current), []);
  return { isOpen, open, close, toggle };
}
