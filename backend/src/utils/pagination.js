/**
 * List helpers shared by every collection endpoint.
 *
 * Sort keys are never interpolated from user input: `sortMap` maps the API
 * field (already validated by zod against the same whitelist) to a fixed SQL
 * expression. LIMIT/OFFSET are integers validated by zod before they get here.
 */
import { query } from '../config/db.js';

/**
 * @param {{ page: number, limit: number, sortBy?: string, sortOrder?: string }} listQuery
 * @param {Record<string, string>} sortMap   API field -> SQL column, e.g. { lastName: 'u.last_name' }
 * @param {string} defaultOrderBy            SQL used when sortBy is omitted, e.g. 'u.last_name ASC, u.first_name ASC'
 * @param {string} tieBreaker                SQL column appended for stable pages, e.g. 's.id'
 */
export function buildListClauses(listQuery, sortMap, defaultOrderBy, tieBreaker) {
  const { page, limit, sortBy, sortOrder } = listQuery;
  let orderBy = defaultOrderBy;
  if (sortBy) {
    const column = sortMap[sortBy];
    if (!column) throw new Error(`sortBy "${sortBy}" is not in the sort map`); // zod guarantees this never happens
    orderBy = `${column} ${sortOrder === 'desc' ? 'DESC' : 'ASC'}`;
  }
  if (tieBreaker && !orderBy.includes(tieBreaker)) orderBy = `${orderBy}, ${tieBreaker} ASC`;
  const offset = (page - 1) * limit;
  return {
    orderBySql: `ORDER BY ${orderBy}`,
    limitSql: `LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
  };
}

export function buildMeta(page, limit, total) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

/**
 * Runs a paginated list: the data query and a COUNT(*) over the same FROM and
 * WHERE, so `meta.total` always honours the filters.
 *
 * @param {object} spec
 * @param {string} spec.select        column list (without the SELECT keyword)
 * @param {string} spec.from          FROM clause including joins ("FROM students s JOIN ...")
 * @param {import('./sql.js').WhereBuilder} spec.where
 * @param {object} spec.listQuery     validated list query
 * @param {Record<string,string>} spec.sortMap
 * @param {string} spec.defaultOrder
 * @param {string} spec.tieBreaker
 * @returns {Promise<{ rows: object[], meta: object }>}
 */
export async function selectPage({ select, from, where, listQuery, sortMap, defaultOrder, tieBreaker }) {
  const { orderBySql, limitSql } = buildListClauses(listQuery, sortMap, defaultOrder, tieBreaker);
  const [rows, [{ total }]] = await Promise.all([
    query(`SELECT ${select} ${from} ${where.sql} ${orderBySql} ${limitSql}`, where.params),
    query(`SELECT COUNT(*) AS total ${from} ${where.sql}`, where.params),
  ]);
  return { rows, meta: buildMeta(listQuery.page, listQuery.limit, total) };
}
