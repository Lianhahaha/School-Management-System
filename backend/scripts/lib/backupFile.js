/**
 * The format of a backup file, shared by scripts/backup.js (writes it) and scripts/restore.js (loads it).
 *
 * A backup is plain SQL that the mysql client can load into an empty database as it is. It starts with the
 * HEADER line and ends with the FOOTER line (`-- Backup complete: <tables> tables, <rows> rows`), so a file cut
 * short is refused instead of half-loaded. Every statement ends with ";" at the end of a line and holds no
 * other line ending in ";" (row values are escaped, so they never contain a line break), which lets the
 * restore split the file into statements without parsing SQL.
 */
import path from 'node:path';
import { env } from '../../src/config/env.js';

export const HEADER = '-- Skole backup';
export const FOOTER = '-- Backup complete:';

/** The repository's root folder (the parent of backend/). */
export const repoRoot = path.resolve(env.backendRoot, '..');

/** `-- Backup complete: 21 tables, 1234 rows` */
export const footerLine = (tables, rows) => `${FOOTER} ${tables} tables, ${rows} rows`;

/** `{ tables, rows }` from a footer line, or null when the line is not one. */
export function parseFooter(line) {
  const match = /^-- Backup complete: (\d+) tables, (\d+) rows$/.exec(line.trim());
  return match ? { tables: Number(match[1]), rows: Number(match[2]) } : null;
}

/** True when `target` is `folder` or lies inside it (case-insensitive on Windows, as path.relative is). */
export function isInside(folder, target) {
  const relative = path.relative(folder, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

/** Session settings a backup switches off for the load and puts back at the end. */
export const LOAD_SETTINGS = `SET NAMES utf8mb4;
SET @OLD_FOREIGN_KEY_CHECKS = @@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS = 0;
SET @OLD_UNIQUE_CHECKS = @@UNIQUE_CHECKS, UNIQUE_CHECKS = 0;
SET @OLD_SQL_MODE = @@SQL_MODE, SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';
SET @OLD_TIME_ZONE = @@TIME_ZONE, TIME_ZONE = '+00:00';`;

export const RESTORE_SETTINGS = `SET FOREIGN_KEY_CHECKS = @OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS = @OLD_UNIQUE_CHECKS;
SET SQL_MODE = @OLD_SQL_MODE;
SET TIME_ZONE = @OLD_TIME_ZONE;`;
