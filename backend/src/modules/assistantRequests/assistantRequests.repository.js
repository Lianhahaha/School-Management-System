/**
 * SQL for assistant_requests: one sign-up request per student assistant, keyed by user_id. The per-request
 * status lookup is part of the auth query (users.repository findAuthContextByFirebaseUid).
 */
import { query, run } from '../../config/db.js';
import { selectPage } from '../../utils/pagination.js';
import { WhereBuilder } from '../../utils/sql.js';

export const ASSISTANT_REQUEST_SORT_MAP = {
  requestedAt: 'ar.created_at',
  decidedAt: 'ar.decided_at',
  lastName: 'u.last_name',
};

const COLUMNS = `ar.user_id, u.first_name, u.last_name, u.email, u.phone, u.is_active, ar.status,
  ar.decline_reason, ar.created_at AS requested_at, ar.decided_at, ar.decided_by,
  du.first_name AS decided_by_first_name, du.last_name AS decided_by_last_name`;

const FROM = `FROM assistant_requests ar
  JOIN users u ON u.id = ar.user_id
  LEFT JOIN users du ON du.id = ar.decided_by`;

/** Inserts the pending request of a new student assistant. Runs inside the caller's transaction. */
export async function insertRequest(userId, conn) {
  await run('INSERT INTO assistant_requests (user_id) VALUES (?)', [userId], conn);
}

export async function findRequest(userId, conn) {
  return (await query(`SELECT ${COLUMNS} ${FROM} WHERE ar.user_id = ?`, [userId], conn))[0] ?? null;
}

export function listRequests(listQuery) {
  const where = new WhereBuilder()
    .addSearch(listQuery.search, [
      'u.first_name',
      'u.last_name',
      "CONCAT(u.first_name, ' ', u.last_name)",
      'u.email',
    ])
    .addIf(listQuery.status, 'ar.status = ?');
  return selectPage({
    select: COLUMNS,
    from: FROM,
    where,
    listQuery,
    sortMap: ASSISTANT_REQUEST_SORT_MAP,
    defaultOrder: 'ar.created_at ASC',
    tieBreaker: 'ar.user_id',
  });
}

/**
 * Approves or declines a pending request in one statement, so two decisions at the same moment cannot both
 * apply. Returns false when there is no request, or it is no longer pending.
 */
export async function decidePending(userId, { status, reason = null, decidedBy }) {
  const result = await run(
    `UPDATE assistant_requests SET status = ?, decline_reason = ?, decided_by = ?, decided_at = UTC_TIMESTAMP()
      WHERE user_id = ? AND status = 'pending'`,
    [status, reason, decidedBy, userId],
  );
  return result.affectedRows > 0;
}

/** Deletes the request of an account being deleted. Runs inside its transaction, before the users row goes. */
export async function deleteByUserId(userId, conn) {
  await run('DELETE FROM assistant_requests WHERE user_id = ?', [userId], conn);
}
