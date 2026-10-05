import { useSyncExternalStore } from 'react';
import { installPrompt } from '../lib/installPrompt';

/** `{ canInstall, install }`: whether the browser offers to install Skole, and the action that asks it to. */
export function useInstallPrompt() {
  const canInstall = useSyncExternalStore(installPrompt.subscribe, installPrompt.canInstall);
  return { canInstall, install: installPrompt.install };
}
