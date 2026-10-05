/**
 * Announcements and their visibility:
 *   admin   : everything, any status.
 *   teacher : active school-wide notices for teachers or everyone, active notices of visible classes,
 *             plus everything they authored whatever its status.
 *   student : active notices for students or everyone that are school-wide or target their class.
 */
import { ApiError } from '../../utils/ApiError.js';
import { nowSeconds, parseIsoDateTime } from '../../utils/dates.js';
import { resolveMe } from '../../utils/resolveMe.js';
import * as access from '../access/access.service.js';
import { changedList, changesOf, record } from '../activity/activity.service.js';
import * as repo from './announcements.repository.js';

const toAnnouncementShape = (row) => ({
  id: row.id,
  author: {
    id: row.authorId,
    firstName: row.authorFirstName,
    lastName: row.authorLastName,
    role: row.authorRole,
  },
  title: row.title,
  body: row.body,
  audience: row.audience,
  classId: row.classId,
  className: row.className,
  publishedAt: row.publishedAt,
  expiresAt: row.expiresAt,
  status: row.status,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/** `{ sql, params }` limiting rows to what `user` may read, or null for admins. */
function visibilityScope(user) {
  if (access.isAdmin(user)) return null;
  if (access.isTeacher(user)) return repo.teacherVisibility(access.classScope(user, 'a.class_id'), user.id);
  return repo.studentVisibility(user.activeClassId);
}

export async function listAnnouncements(user, listQuery) {
  if (listQuery.status !== undefined && !access.isAdmin(user)) {
    throw ApiError.forbidden('admin_only_filter', 'only administrators can filter announcements by status');
  }
  if (listQuery.classId !== undefined) await access.assertCanViewClass(user, listQuery.classId);
  const query = {
    ...listQuery,
    authorId: resolveMe(user, listQuery.authorId, 'user'),
    status: access.isAdmin(user) ? (listQuery.status ?? 'active') : undefined,
  };
  const { rows, meta } = await repo.listAnnouncements(query, visibilityScope(user));
  return { data: rows.map(toAnnouncementShape), meta };
}

export async function getAnnouncement(user, id) {
  return toAnnouncementShape(
    ApiError.assertFound(await repo.findAnnouncementById(id, visibilityScope(user)), 'announcement', id),
  );
}

/** Newest active announcements visible to `user`, for the dashboards. */
export async function recentAnnouncements(user, limit = 5) {
  return (await repo.findRecentActive(visibilityScope(user), limit)).map(toAnnouncementShape);
}

function assertExpiryAfterPublish(publishedAt, expiresAt) {
  if (expiresAt && expiresAt <= publishedAt) {
    throw ApiError.validation('expiresAt must be after publishedAt', undefined, {
      issues: [{ path: 'body.expiresAt', message: 'must be after publishedAt' }],
    });
  }
}

/** Teachers announce to one of their visible classes only. */
async function assertTeacherTarget(user, classId) {
  if (!access.isTeacher(user)) return;
  if (classId == null) {
    throw ApiError.validation('teachers must target one of their classes', undefined, {
      reason: 'class_required',
      field: 'classId',
    });
  }
  await access.assertCanViewClass(user, classId);
}

export async function createAnnouncement(user, body) {
  await assertTeacherTarget(user, body.classId);
  const publishedAt = body.publishedAt ? parseIsoDateTime(body.publishedAt) : nowSeconds();
  const expiresAt = body.expiresAt ? parseIsoDateTime(body.expiresAt) : null;
  assertExpiryAfterPublish(publishedAt, expiresAt);
  const id = await repo.insertAnnouncement({ ...body, authorId: user.id, publishedAt, expiresAt });
  const announcement = toAnnouncementShape(await repo.findAnnouncementById(id));
  await record({
    action: 'announcement.create',
    entityId: id,
    summary: `Published "${announcement.title}" for ${audienceOf(announcement)}`,
    details: {
      title: announcement.title,
      audience: announcement.audience,
      className: announcement.className,
    },
  });
  return announcement;
}

/** "everyone", "students of Grade 10 - A", ... for the activity log. */
const audienceOf = ({ audience, className }) =>
  `${audience === 'all' ? 'everyone' : audience}${className ? ` of ${className}` : ''}`;

export async function updateAnnouncement(user, id, patch) {
  const existing = ApiError.assertFound(await repo.findAnnouncementById(id), 'announcement', id);
  access.assertIsAuthor(user, existing.authorId);

  const fields = { ...patch };
  if ('publishedAt' in patch) fields.publishedAt = parseIsoDateTime(patch.publishedAt);
  if ('expiresAt' in patch) fields.expiresAt = patch.expiresAt ? parseIsoDateTime(patch.expiresAt) : null;
  if (access.isTeacher(user) && 'classId' in patch) await assertTeacherTarget(user, patch.classId);

  assertExpiryAfterPublish(
    fields.publishedAt ?? existing.publishedAt,
    'expiresAt' in fields ? fields.expiresAt : existing.expiresAt,
  );
  await repo.updateAnnouncement(id, fields);
  const announcement = toAnnouncementShape(await repo.findAnnouncementById(id));
  // The body can be long: the log keeps that it changed, not the text.
  const { body, ...otherFields } = fields;
  const changes = changesOf(existing, otherFields) ?? {};
  if (body !== undefined && body !== existing.body) changes.body = { from: '…', to: '…' };
  if (Object.keys(changes).length) {
    await record({
      action: 'announcement.update',
      entityId: id,
      summary: `Updated the ${changedList(changes)} of "${announcement.title}"`,
      details: { changes },
    });
  }
  return announcement;
}

export async function deleteAnnouncement(user, id) {
  const existing = ApiError.assertFound(await repo.findAnnouncementById(id), 'announcement', id);
  access.assertIsAuthor(user, existing.authorId);
  await repo.deleteAnnouncement(id);
  await record({
    action: 'announcement.delete',
    entityId: id,
    summary: `Deleted the announcement "${existing.title}"`,
    details: { title: existing.title, audience: existing.audience, className: existing.className },
  });
  return { id };
}
