import { useSyncExternalStore } from 'react';
import { serverWake } from '../lib/serverWake';

/** True while an API request has been waiting several seconds: the free server is waking up. */
export function useServerWaking() {
  return useSyncExternalStore(serverWake.subscribe, serverWake.isWaking);
}
