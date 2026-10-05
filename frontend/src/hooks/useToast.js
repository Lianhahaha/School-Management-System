import { toastBus } from '../lib/toastBus';

/**
 * The toast API for components:
 *   const toast = useToast();
 *   toast.success('Liam Cruz enrolled in Grade 7 - A'); // name the object that changed
 *   toast.info('Signed out');
 *   toast.success('Grade cleared', { action: { label: 'Undo', onClick: restore } });
 *   toast.error(apiError); // shows error.message (plus code and request id in development)
 *
 * Toasts are rendered by ToastProvider; the same API is available outside React as `toastBus`.
 */
export function useToast() {
  return toastBus;
}
