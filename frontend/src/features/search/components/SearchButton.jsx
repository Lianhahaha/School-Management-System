import { Search } from 'lucide-react';
import { useEffect } from 'react';
import { useDisclosure } from '../../../hooks/useDisclosure';
import { SearchDialog } from './SearchDialog';

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const SHORTCUT = IS_MAC ? '⌘K' : 'Ctrl K';

/**
 * The top bar's search field look-alike (a button) that opens the search dialog; Ctrl+K (Cmd+K on a
 * Mac) opens it from anywhere. Below `sm` it shrinks to the icon.
 */
export function SearchButton() {
  const dialog = useDisclosure();
  const { open } = dialog;

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        open();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={dialog.open}
        aria-haspopup="dialog"
        aria-keyshortcuts={IS_MAC ? 'Meta+K' : 'Control+K'}
        className="flex h-10 items-center gap-2 rounded-full bg-surface px-3 text-sm text-gray-500 transition-colors hover:text-gray-900 max-sm:size-10 max-sm:justify-center max-sm:px-0 sm:w-64 pointer-coarse:h-11 max-sm:pointer-coarse:size-11"
      >
        <Search className="size-4 shrink-0" aria-hidden="true" />
        <span className="max-sm:sr-only">Search</span>
        <kbd className="ml-auto rounded-md bg-gray-100 px-1.5 font-sans text-xs text-gray-500 max-sm:hidden">
          {SHORTCUT}
        </kbd>
      </button>
      <SearchDialog open={dialog.isOpen} onClose={dialog.close} />
    </>
  );
}
