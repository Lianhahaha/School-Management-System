import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { cx } from '../../utils/cx';

const SIZES = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

/** Where focus goes when the dialog opens: an element marked data-autofocus, else the first field. */
const FIRST_FIELD = '[data-modal-body] :is(input, select, textarea):not([type="hidden"], [disabled])';

/**
 * Modal dialog built on the native <dialog> element (focus trap, Escape, inert background and
 * focus return to the trigger come from the browser).
 *
 * It is fully controlled: it never closes itself. Escape, a click on the backdrop and the close
 * button all call `onClose`, and the parent decides (for example asking "Discard changes?" first)
 * and then sets `open` to false. Children are mounted only while the modal is open, so a form
 * inside it starts fresh each time.
 *
 * A form's submit button usually sits in the footer, outside the <form>; connect them with the
 * `form` attribute:
 *   <Modal open={modal.isOpen} onClose={modal.close} title="Create subject"
 *          footer={<><Button variant="secondary" onClick={modal.close}>Cancel</Button>
 *                    <Button type="submit" form="subject-form">Create</Button></>}>
 *     <form id="subject-form" onSubmit={...} noValidate>...</form>
 *   </Modal>
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} props.title verb and noun, for example "Edit subject"
 * @param {string} [props.description]
 * @param {import('react').ReactNode} [props.footer] action buttons, right-aligned
 * @param {'sm'|'md'|'lg'|'xl'} [props.size]
 */
export function Modal({ open, onClose, title, description, footer, size = 'md', children }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog.open) {
      dialog.showModal();
      (dialog.querySelector('[data-autofocus]') ?? dialog.querySelector(FIRST_FIELD))?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault(); // keep it open until the parent closes it
        onClose();
      }}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose(); // the backdrop is part of the dialog box
      }}
      className={cx(
        'm-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] flex-col rounded-[1.75rem] bg-surface p-0 text-gray-900 shadow-pop backdrop:bg-scrim backdrop:backdrop-blur-md open:flex',
        SIZES[size],
      )}
    >
      {open && (
        <>
          <header className="flex items-start justify-between gap-4 px-6 pt-6 pb-2">
            <div>
              <h2 id={titleId} className="text-xl font-semibold tracking-[-0.01em] text-gray-900">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="mt-1 text-sm text-gray-600">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mt-1 -mr-2 flex size-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-900"
            >
              <X className="size-[1.125rem]" aria-hidden="true" />
            </button>
          </header>
          <div data-modal-body className="overflow-y-auto px-6 py-4">
            {children}
          </div>
          {footer && <footer className="flex flex-wrap justify-end gap-2 px-6 pt-2 pb-6">{footer}</footer>}
        </>
      )}
    </dialog>
  );
}
