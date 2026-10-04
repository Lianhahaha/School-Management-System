import { useSyncExternalStore } from 'react';

/**
 * When self-registration is switched off (ALLOW_PUBLIC_REGISTRATION=false) the backend refuses
 * POST /auth/register with `details.reason` REGISTRATION_DISABLED. There is no endpoint to ask in
 * advance, so the first refusal is remembered here: the register page then shows "registration
 * closed" and the sign-in page hides its "Create an account" link.
 */
export const REGISTRATION_DISABLED = 'registration_disabled';

const listeners = new Set();
let isClosed = false;

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function markRegistrationClosed() {
  isClosed = true;
  listeners.forEach((listener) => listener());
}

export function useRegistrationClosed() {
  return useSyncExternalStore(subscribe, () => isClosed);
}
