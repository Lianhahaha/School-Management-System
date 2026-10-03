import { useSyncExternalStore } from 'react';

/**
 * The backend answers 404 on POST /auth/register when self-registration is switched off
 * (ALLOW_PUBLIC_REGISTRATION=false). There is no endpoint to ask in advance, so the first 404 is
 * remembered here: the register page then shows "registration closed" and the sign-in page hides
 * its "Create an account" link.
 */
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
