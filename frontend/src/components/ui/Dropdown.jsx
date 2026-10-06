import { Ellipsis } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import { cx } from '../../utils/cx';

const ITEM_HEIGHT = 40; // px, matches `min-h-10` on the items
const MENU_PADDING = 8; // px, vertical padding of the menu
const GAP = 4; // px between trigger and menu
const MENU_ITEM = '[role="menuitem"]:not(:disabled)';

/**
 * Where the menu goes: below the trigger, or above it when it would not fit, aligned to the
 * trigger's right or left edge. Fixed coordinates, so it is not clipped by a scrolling table.
 */
function placeMenu(trigger, itemCount, align) {
  const rect = trigger.getBoundingClientRect();
  const menuHeight = itemCount * ITEM_HEIGHT + MENU_PADDING;
  const fitsBelow = window.innerHeight - rect.bottom >= menuHeight + GAP;
  return {
    ...(fitsBelow ? { top: rect.bottom + GAP } : { bottom: window.innerHeight - rect.top + GAP }),
    ...(align === 'right' ? { right: window.innerWidth - rect.right } : { left: rect.left }),
  };
}

/**
 * Menu button for row actions and the user menu. Keyboard: Enter, Space or ArrowDown on the trigger
 * opens it and focuses the first item; ArrowUp/ArrowDown/Home/End move; Escape closes and returns
 * focus to the trigger; Tab closes. It closes on outside click, scroll and resize.
 *
 *   <Dropdown label={`Actions for ${fullName(student)}`} items={[
 *     { label: 'Edit', icon: Pencil, onClick: () => setEditing(student) },
 *     { label: 'View', to: `/admin/students/${student.id}` },
 *     { label: 'Delete', icon: Trash2, danger: true, onClick: () => onDelete(student) },
 *   ]} />
 *
 * @param {object} props
 * @param {string} props.label accessible name of the trigger button; include any visible text of a custom trigger
 * @param {Array<{ label: string, onClick?: () => void, to?: string, icon?: import('react').ElementType,
 *   danger?: boolean, disabled?: boolean }>} props.items an item has either `onClick` or `to`
 * @param {import('react').ReactNode} [props.trigger] content of the trigger button (default: three dots)
 * @param {'left'|'right'} [props.align] which edge of the trigger the menu lines up with
 */
export function Dropdown({ label, items, trigger, align = 'right', className }) {
  const [position, setPosition] = useState(null); // null while closed
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();
  const isOpen = position !== null;

  const close = useCallback((restoreFocus = true) => {
    setPosition(null);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const open = () => setPosition(placeMenu(triggerRef.current, items.length, align));

  useEffect(() => {
    if (!isOpen) return undefined;
    const closeOnOutsideClick = (event) => {
      const isInside = menuRef.current?.contains(event.target) || triggerRef.current?.contains(event.target);
      if (!isInside) close(false);
    };
    const closeQuietly = () => close(false);
    menuRef.current?.querySelector(MENU_ITEM)?.focus();
    document.addEventListener('pointerdown', closeOnOutsideClick);
    window.addEventListener('scroll', closeQuietly, true);
    window.addEventListener('resize', closeQuietly);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      window.removeEventListener('scroll', closeQuietly, true);
      window.removeEventListener('resize', closeQuietly);
    };
  }, [isOpen, close]);

  function onMenuKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') {
      close(); // focus returns to the trigger, then Tab moves on from there
    } else {
      const focusable = [...menuRef.current.querySelectorAll(MENU_ITEM)];
      const current = focusable.indexOf(document.activeElement);
      const target = {
        ArrowDown: (current + 1) % focusable.length,
        ArrowUp: (current - 1 + focusable.length) % focusable.length,
        Home: 0,
        End: focusable.length - 1,
      }[event.key];
      if (target === undefined) return;
      event.preventDefault();
      focusable[target].focus();
    }
  }

  const itemClasses = (item) =>
    cx(
      'flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
      item.danger ? 'text-red-700 hover:bg-red-50' : 'text-gray-800 hover:bg-gray-100',
    );

  const itemContent = (item) => (
    <>
      {item.icon && <item.icon className="size-4 shrink-0" aria-hidden="true" />}
      {item.label}
    </>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !isOpen) {
            event.preventDefault();
            open();
          }
        }}
        className={cx(
          'inline-flex min-h-10 min-w-10 items-center justify-center gap-2 rounded-control px-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 pointer-coarse:min-h-11 pointer-coarse:min-w-11',
          className,
        )}
      >
        {trigger ?? <Ellipsis className="size-5" aria-hidden="true" />}
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={label}
            style={position}
            onKeyDown={onMenuKeyDown}
            className="fixed z-50 min-w-52 rounded-[1.25rem] bg-surface p-1.5 shadow-pop"
          >
            {items.map((item) =>
              item.to ? (
                <Link
                  key={item.label}
                  to={item.to}
                  role="menuitem"
                  className={itemClasses(item)}
                  onClick={() => close(false)}
                >
                  {itemContent(item)}
                </Link>
              ) : (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  className={itemClasses(item)}
                  onClick={() => {
                    close(); // before the action, so a modal it opens returns focus to the trigger
                    item.onClick();
                  }}
                >
                  {itemContent(item)}
                </button>
              ),
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
