import { isConsecutiveAcademicYear } from '../../constants/shared';
import { currentAcademicYear } from '../../utils/date';
import { schoolYearLabel } from '../enrollments/schoolYears';

/**
 * The choices of the Students page's school-year filter, newest first ("AY 2026-2027"): the years that have
 * classes, plus the current year (the dashboard's "Active enrollments" tile opens the list on it, classes or
 * not) and the year already in the URL, so the select always shows the year the list is filtered by.
 * @param {Array<{ academicYear: string }>} classes
 * @param {string} [selected] the `academicYear` filter, '' when none
 * @returns {Array<{ value: string, label: string }>}
 */
export function classYearOptions(classes, selected = '') {
  const years = new Set([currentAcademicYear(), ...classes.map((schoolClass) => schoolClass.academicYear)]);
  if (isConsecutiveAcademicYear(selected)) years.add(selected);
  return [...years]
    .sort((a, b) => b.localeCompare(a))
    .map((academicYear) => ({ value: academicYear, label: schoolYearLabel(academicYear) }));
}
