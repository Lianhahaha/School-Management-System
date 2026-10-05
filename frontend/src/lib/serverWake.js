/**
 * Notices when the API is slow to answer. On the free hosting that means it is waking up: the server
 * sleeps after 15 idle minutes, and the first request after that waits up to a minute while it starts.
 * apiClient runs every request through `trackSlow`; while at least one has been waiting longer than
 * SLOW_AFTER_MS, `isWaking()` is true and ServerWakeNotice explains the wait.
 */
const SLOW_AFTER_MS = 4000;

const listeners = new Set();
let slowRequests = 0;

const emit = () => listeners.forEach((listener) => listener());

/**
 * Runs `request` and counts it as slow from SLOW_AFTER_MS until it settles.
 * @template T
 * @param {() => Promise<T>} request
 * @returns {Promise<T>}
 */
export async function trackSlow(request) {
  let isSlow = false;
  const timer = setTimeout(() => {
    isSlow = true;
    slowRequests += 1;
    emit();
  }, SLOW_AFTER_MS);
  try {
    return await request();
  } finally {
    clearTimeout(timer);
    if (isSlow) {
      slowRequests -= 1;
      emit();
    }
  }
}

export const serverWake = {
  /** @returns {() => void} unsubscribe */
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** True while a request has been waiting longer than SLOW_AFTER_MS. */
  isWaking: () => slowRequests > 0,
};
