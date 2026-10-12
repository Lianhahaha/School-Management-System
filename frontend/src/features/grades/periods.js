/**
 * The school year's periods as a student's pages offer them, and how a period reads: a school year is shown
 * whole or as one of its two semesters, and the quarters of a semester are the columns of the table, not a
 * choice of their own. A semester is 'sem1' or 'sem2'; '' is the whole school year, as in the props of the
 * components, and the API's `semester` filter is simply left out for it.
 */
import { SEMESTERS, TERMS } from '../../constants/shared';
import { SEMESTER_LABELS, TERM_SHORT_LABELS } from '../../constants/ui';
import { currentAcademicYear, currentSemester } from '../../utils/date';
import { schoolYearLabel } from '../enrollments/schoolYears';

/** The URL's value (`semester=all`) for the whole school year: a missing one means "the default" instead. */
export const WHOLE_YEAR_PARAM = 'all';

/** What a school year can be shown as, in the order of the picker: the whole year, then each semester. */
export const PERIODS = Object.freeze([
  { semester: '', label: 'Whole year' },
  ...SEMESTERS.map((semester) => ({ semester, label: SEMESTER_LABELS[semester] })),
]);

/**
 * The period a school year opens on: its current semester while it is the school year we are in (so the
 * table of quarters shows), the whole year for any other, which is over (or has not begun).
 * @param {string} academicYear '2026-2027'
 * @returns {string} 'sem1', 'sem2' or '' for the whole year
 */
export const defaultSemester = (academicYear) =>
  academicYear === currentAcademicYear() ? currentSemester() : '';

/**
 * The period a page shows from its `semester` URL value: 'sem1' or 'sem2' as given, 'all' for the whole year,
 * and the school year's default (defaultSemester) for a missing or unknown value.
 * @param {string | null | undefined} param
 * @param {string} academicYear the school year shown
 * @returns {string} 'sem1', 'sem2' or '' for the whole year
 */
export function semesterFromParam(param, academicYear) {
  if (param === WHOLE_YEAR_PARAM) return '';
  if (param && SEMESTERS.includes(param)) return param;
  return defaultSemester(academicYear);
}

/**
 * The URL value of a period, the reverse of semesterFromParam. The whole year is written out (`all`), so
 * choosing it in the school year we are in is not undone by that year's default.
 * @param {string} semester 'sem1', 'sem2' or '' for the whole year
 */
export const semesterToParam = (semester) => semester || WHOLE_YEAR_PARAM;

/**
 * A period in words, as the picker and the table headings write it: 'AY 2026-2027 · 1st Semester',
 * 'AY 2026-2027 · Whole year'.
 * @param {string} academicYear
 * @param {string} semester 'sem1', 'sem2' or '' for the whole year
 */
export const periodTitle = (academicYear, semester) =>
  `${schoolYearLabel(academicYear)} · ${semester ? SEMESTER_LABELS[semester] : 'Whole year'}`;

/**
 * The grade columns of a period, between the subject and its final grade: the four quarters of a semester,
 * or the two semesters of the whole year. Each reads its grade off a summary row of that period, which has
 * `quarters` (a semester's) or `semesters` (the whole year's; see utils/grades subjectRows); null when it has
 * none.
 * @param {string} semester 'sem1', 'sem2' or '' for the whole year
 * @returns {Array<{ key: string, header: string,
 *   gradeOf: (row: { quarters?: Record<string, number|null>, semesters?: Record<string, number|null> }) => number | null }>}
 */
export const gradeColumnsOf = (semester) =>
  semester
    ? TERMS.map((term) => ({
        key: term,
        header: TERM_SHORT_LABELS[term],
        gradeOf: (row) => row.quarters?.[term] ?? null,
      }))
    : SEMESTERS.map((name) => ({
        key: name,
        header: SEMESTER_LABELS[name],
        gradeOf: (row) => row.semesters?.[name] ?? null,
      }));
