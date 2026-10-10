/**
 * In-app notifications: a short message to the person something happened to. Other services call the
 * notify* helpers after a change succeeded; like the activity log they are best effort, so a failed write is
 * reported in the server log and never fails the request. Nobody is notified of their own action.
 *
 *   student   a grade recorded or changed, an absence or late mark, a new class, a declined application
 *   teacher   a lesson to teach, a homeroom class
 *   admin     a student signed up on their own and sent an application (marked read for every admin once
 *             the student is enrolled or the application declined, since nothing is left to do)
 */
import { logger } from '../../utils/logger.js';
import { currentUser } from '../../utils/requestContext.js';
import * as repo from './notifications.repository.js';

/** `text` cut to `max` characters (whole code points) with an ellipsis, so a long name cannot overflow a column. */
const fit = (text, max) => {
  if (text == null) return text;
  const chars = [...text];
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : text;
};

/** Inserts the notes `[{ userId, type, title, body?, link? }]`, leaving out the caller's own. Never throws. */
async function notify(notes) {
  const actorId = currentUser()?.id;
  try {
    await repo.insertMany(
      notes
        .filter((note) => note.userId && note.userId !== actorId)
        // title VARCHAR(200), body VARCHAR(300): names in titles can be up to 100 characters each.
        .map((note) => ({ ...note, title: fit(note.title, 200), body: fit(note.body, 300) })),
    );
  } catch (error) {
    logger.error('could not write notifications', { count: notes.length, error: String(error) });
  }
}

/** Notes keyed by studentId: `[{ studentId, type, title, body?, link? }]`. Never throws. */
export async function notifyStudents(notes) {
  if (!notes.length) return;
  try {
    const userIds = await repo.findStudentUserIds([...new Set(notes.map((note) => note.studentId))]);
    await notify(notes.map(({ studentId, ...note }) => ({ ...note, userId: userIds.get(studentId) })));
  } catch (error) {
    logger.error('could not write notifications', { error: String(error) });
  }
}

/** One note to a teacher. Never throws. */
export async function notifyTeacher(teacherId, note) {
  try {
    await notify([{ ...note, userId: await repo.findTeacherUserId(teacherId) }]);
  } catch (error) {
    logger.error('could not write notifications', { error: String(error) });
  }
}

/** One note to every active administrator. Never throws. */
export async function notifyAdmins(note) {
  try {
    await notify((await repo.findActiveAdminIds()).map((userId) => ({ ...note, userId })));
  } catch (error) {
    logger.error('could not write notifications', { error: String(error) });
  }
}

/** The page a sign-up notification opens: the new student's record. */
export const signupLink = (studentId) => `/admin/students/${studentId}`;

/**
 * The students now have a class, or their application was declined: their sign-up notes are done for every
 * admin. Never throws.
 */
export async function resolveSignups(studentIds) {
  try {
    await repo.markReadByLink('signup', studentIds.map(signupLink));
  } catch (error) {
    logger.error('could not mark sign-up notifications read', { error: String(error) });
  }
}

const toNotificationShape = (row) => ({
  id: row.id,
  type: row.type,
  title: row.title,
  body: row.body,
  link: row.link,
  isRead: row.readAt !== null,
  readAt: row.readAt,
  createdAt: row.createdAt,
});

export async function listMine(user, listQuery) {
  const { rows, meta } = await repo.listForUser(user.id, listQuery);
  return { data: rows.map(toNotificationShape), meta };
}

export async function unreadCount(user) {
  return { count: await repo.countUnread(user.id) };
}

/** Marks the caller's notifications read: `ids`, or all of them. Other users' ids are simply not touched. */
export async function markRead(user, ids) {
  return { updated: await repo.markRead(user.id, ids) };
}

/** Deletes the notifications of an account being deleted (inside its transaction). */
export const deleteForUser = (userId, conn) => repo.deleteForUser(userId, conn);
