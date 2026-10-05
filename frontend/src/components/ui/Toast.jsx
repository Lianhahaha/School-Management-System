import { useCallback, useEffect, useState } from 'react';
import { toastBus } from '../../lib/toastBus';
import { Alert } from './Alert';

const DURATION_MS = { success: 4000, info: 4000, error: 8000 };
/** A toast with a button (Undo) stays long enough to reach it with the keyboard. */
const ACTION_DURATION_MS = 10000;
const MAX_VISIBLE = 5;

function ToastItem({ toast, onDismiss }) {
  useEffect(() => {
    const duration = toast.action ? ACTION_DURATION_MS : DURATION_MS[toast.tone];
    const timer = setTimeout(() => onDismiss(toast.id), duration);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  return (
    <Alert
      tone={toast.tone}
      onDismiss={() => onDismiss(toast.id)}
      className="pointer-events-auto animate-toast-in rounded-[1.25rem] shadow-pop backdrop-blur-sm"
    >
      {toast.message}
      {toast.detail && <span className="mt-0.5 block text-xs opacity-80">{toast.detail}</span>}
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            onDismiss(toast.id);
            toast.action.onClick();
          }}
          className="link mt-1 block text-sm"
        >
          {toast.action.label}
        </button>
      )}
    </Alert>
  );
}

/**
 * Renders the toasts raised through `useToast()` / `toastBus` (success and info for 4 s, errors for 8 s,
 * a toast with an action button such as Undo for 10 s).
 * Two live regions are always present: errors are announced assertively (role="alert"), everything
 * else politely (role="status"). Mount it once, near the root.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  useEffect(
    () => toastBus.subscribe((toast) => setToasts((current) => [...current, toast].slice(-MAX_VISIBLE))),
    [],
  );

  const dismiss = useCallback((id) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);

  const renderToasts = (isError) =>
    toasts
      .filter((toast) => (toast.tone === 'error') === isError)
      .map((toast) => <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />);

  return (
    <>
      {children}
      {/* Above the phone tab bar; bottom-right from `lg` up. */}
      <div className="pointer-events-none fixed inset-x-4 bottom-28 z-50 flex flex-col gap-2 sm:left-auto sm:w-96 lg:bottom-5">
        <div role="status" aria-live="polite" className="flex flex-col gap-2">
          {renderToasts(false)}
        </div>
        <div role="alert" className="flex flex-col gap-2">
          {renderToasts(true)}
        </div>
      </div>
    </>
  );
}
