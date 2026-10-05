/**
 * Tiny publish/subscribe channel behind the toasts.
 *
 * It exists so code outside React (the TanStack Query caches) can raise a toast, and so
 * components can too, through the same API. ToastProvider is the only subscriber.
 * Components should call `useToast()` rather than importing this module directly.
 */
const listeners = new Set();
let nextId = 1;

function publish(tone, message, detail, action) {
  const toast = { id: nextId++, tone, message, detail, action };
  listeners.forEach((listener) => listener(toast));
}

/** Developers see which API error produced a toast: `[CONFLICT] · request 7f3a…`. */
function describeError(error) {
  if (!import.meta.env.DEV || !error.code) return undefined;
  return [`[${error.code}]`, error.requestId && `request ${error.requestId}`].filter(Boolean).join(' · ');
}

export const toastBus = {
  /** @returns {() => void} unsubscribe */
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /**
   * @param {string} message
   * @param {{ action?: { label: string, onClick: () => void } }} [options] one button in the toast,
   *   such as "Undo"; the toast then stays longer and closes when the button is used
   */
  success: (message, { action } = {}) => publish('success', message, undefined, action),
  info: (message, { action } = {}) => publish('info', message, undefined, action),
  /** @param {Error|string} error an ApiError (its message is shown) or a plain message */
  error(error) {
    if (typeof error === 'string') return publish('error', error);
    return publish('error', error.message || 'Something went wrong.', describeError(error));
  },
};
