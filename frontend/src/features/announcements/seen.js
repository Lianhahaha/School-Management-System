/**
 * When this user last opened the announcements page, on this device, as a tiny external store
 * (useSyncExternalStore). It decides which announcements count as "new": the sidebar count and the
 * "New" tag. It is a convenience, not a record: blocked storage simply makes everything new.
 */
import { useSyncExternalStore } from 'react';

const listeners = new Set();
const storageKey = (userId) => `skole-announcements-seen:${userId}`;

function read(userId) {
  try {
    return localStorage.getItem(storageKey(userId));
  } catch {
    return null;
  }
}

/** Records "seen up to now" for `userId` and tells every reader. */
export function markAnnouncementsSeen(userId) {
  try {
    localStorage.setItem(storageKey(userId), new Date().toISOString());
  } catch {
    // storage blocked: nothing to remember
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** ISO timestamp of the last visit, or null when the user has never opened the page here. */
export function useAnnouncementsSeenAt(userId) {
  return useSyncExternalStore(subscribe, () => read(userId));
}

/** An announcement is new when it was published after the last visit and someone else wrote it. */
export function isNewAnnouncement(announcement, seenAt, myUserId) {
  if (announcement.author?.id === myUserId) return false;
  return !seenAt || new Date(announcement.publishedAt) > new Date(seenAt);
}
