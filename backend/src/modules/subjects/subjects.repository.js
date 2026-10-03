import { query, run } from '../../config/db.js';
import { selectPage } from '../../utils/pagination.js';
import { WhereBuilder, buildSet } from '../../utils/sql.js';

export const SUBJECT_SORT_MAP = { code: 'sub.code', name: 'sub.name', createdAt: 'sub.created_at' };

const COLUMNS = 'sub.id, sub.code, sub.name, sub.description, sub.is_active, sub.created_at, sub.updated_at';
const FROM = 'FROM subjects sub';

export async function findSubjectById(id, conn) {
  return (await query(`SELECT ${COLUMNS} ${FROM} WHERE sub.id = ?`, [id], conn))[0] ?? null;
}

export function listSubjects(listQuery) {
  const where = new WhereBuilder()
    .addSearch(listQuery.search, ['sub.code', 'sub.name'])
    .addIf(listQuery.isActive, 'sub.is_active = ?');
  return selectPage({
    select: COLUMNS,
    from: FROM,
    where,
    listQuery,
    sortMap: SUBJECT_SORT_MAP,
    defaultOrder: 'sub.code ASC',
    tieBreaker: 'sub.id',
  });
}

export async function insertSubject({ code, name, description }) {
  const result = await run('INSERT INTO subjects (code, name, description) VALUES (?, ?, ?)', [
    code,
    name,
    description ?? null,
  ]);
  return result.insertId;
}

const PATCH_COLUMNS = { code: 'code', name: 'name', description: 'description', isActive: 'is_active' };

export async function updateSubject(id, fields) {
  const set = buildSet(PATCH_COLUMNS, fields);
  if (set) await run(`UPDATE subjects SET ${set.sql} WHERE id = ?`, [...set.params, id]);
}

export async function deleteSubject(id) {
  return (await run('DELETE FROM subjects WHERE id = ?', [id])).affectedRows;
}
