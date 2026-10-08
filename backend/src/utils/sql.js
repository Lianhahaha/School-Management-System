/**
 * Small SQL composition helpers. Values always travel as `?` placeholders;
 * these helpers only assemble clause text.
 */

/** Make `%` and `_` in a search term literal inside LIKE. */
export const escapeLike = (term) => term.replace(/[\\%_]/g, '\\$&');

/** `%term%` with the term escaped; bind as a parameter. */
export const likeParam = (term) => `%${escapeLike(term)}%`;

/** 'WHERE a AND b' or '' when there are no fragments. */
export const whereSql = (fragments) => (fragments.length ? `WHERE ${fragments.join(' AND ')}` : '');

/**
 * Collects WHERE fragments and their parameters together so the data query and
 * the COUNT query always use the same filter.
 */
export class WhereBuilder {
  constructor() {
    this.fragments = [];
    this.params = [];
  }

  /** Add a fragment with its parameters. */
  add(fragment, ...params) {
    this.fragments.push(fragment);
    this.params.push(...params);
    return this;
  }

  /** Add `fragment` only when `value` is defined (undefined means "no filter"). */
  addIf(value, fragment, ...params) {
    if (value !== undefined) this.add(fragment, ...(params.length ? params : [value]));
    return this;
  }

  /** Add a `{ sql, params }` scope fragment (e.g. from access.classScope); null means unrestricted. */
  addScope(scope) {
    if (scope) this.add(scope.sql, ...scope.params);
    return this;
  }

  /** OR-combined LIKE over several columns for a free-text search term. */
  addSearch(term, columns) {
    if (term === undefined) return this;
    const like = likeParam(term);
    this.fragments.push(`(${columns.map((column) => `${column} LIKE ?`).join(' OR ')})`);
    this.params.push(...columns.map(() => like));
    return this;
  }

  get sql() {
    return whereSql(this.fragments);
  }
}

/**
 * Builds the SET list of an UPDATE from a camelCase patch.
 * `columnMap` is the allow-list: API field -> SQL column (qualified when the UPDATE joins tables).
 * Returns `{ sql, params }`, or null when the patch touches no mapped field. A field set to `undefined`
 * is left out (only `null` clears a column), so `{ ...patch, phone: maybePhone }` never wipes by accident.
 */
export function buildSet(columnMap, fields) {
  const sets = [];
  const params = [];
  for (const [key, column] of Object.entries(columnMap)) {
    if (fields[key] !== undefined) {
      sets.push(`${column} = ?`);
      params.push(fields[key]);
    }
  }
  return sets.length ? { sql: sets.join(', '), params } : null;
}

/** Columns that identify a class-subject (class, subject, teacher) in list and detail queries. Aliases: cs, c, sub. */
export const CLASS_SUBJECT_REF_COLUMNS =
  'cs.class_id, c.name AS class_name, c.academic_year, cs.subject_id, sub.name AS subject_name, cs.teacher_id';

/** Joins class_subjects (cs), classes (c) and subjects (sub) from a table alias that has `class_subject_id`. */
export const joinClassSubject = (alias) =>
  `JOIN class_subjects cs ON cs.id = ${alias}.class_subject_id
   JOIN classes c ON c.id = cs.class_id
   JOIN subjects sub ON sub.id = cs.subject_id`;
