/**
 * Notices when the API is waking up. On the free hosting the server sleeps after 15 idle minutes, and the
 * first request after that waits up to a minute while it starts. apiClient runs every request through
 * `trackSlow`; while at least one has been waiting longer than SLOW_AFTER_MS and the server has not answered
 * anything for AWAKE_FOR_MS, `isWaking()` is true and ServerWakeNotice explains the wait. A slow request to a
 * server that answered a moment ago (a large import, say) is just slow, so it shows no notice.
 */
const SLOW_AFTER_MS = 4000;
/** A server that answered this recently is awake (the host puts it to sleep after 15 idle minutes). */
const AWAKE_FOR_MS = 14 * 60_000;

const listeners = new Set();
let slowRequests = 0;
let lastAnswerAt = 0;

const emit = () => listeners.forEach((listener) => listener());

/**
 * Runs `request` (a fetch) and counts it as waking the server from SLOW_AFTER_MS until it settles, unless the
 * server answered recently.
 * @param {() => Promise<Response>} request
 * @returns {Promise<Response>}
 */
export async function trackSlow(request) {
  let isSlow = false;
  const timer = setTimeout(() => {
    if (Date.now() - lastAnswerAt < AWAKE_FOR_MS) return;
    isSlow = true;
    slowRequests += 1;
    emit();
  }, SLOW_AFTER_MS);
  try {
    const response = await request();
    lastAnswerAt = Date.now(); // any HTTP answer, an error status included, means the server is up
    return response;
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
  /** True while a request to a server that may be asleep has been waiting longer than SLOW_AFTER_MS. */
  isWaking: () => slowRequests > 0,
};
